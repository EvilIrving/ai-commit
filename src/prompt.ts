import type { AIConfig } from './config';
import { getPromptConfig } from './rc-config';

export interface PromptContext {
  diff: string;
  branch: string;
  lastCommit?: string;
  config: AIConfig;
}

/**
 * Build prompt for commit message generation
 */
export function buildPrompt(context: PromptContext): string {
  const { diff, branch, lastCommit, config } = context;
  
  // Load prompt config from .ai-commitrc if not in config
  const promptConfig = getPromptConfig(config);
  const userTemplate = config?.userPromptTemplate || promptConfig.userPromptTemplate;
  
  // If custom template is provided, use it
  if (userTemplate) {
    return renderUserTemplate(userTemplate, { diff, branch, lastCommit });
  }
  
  // Extract changed files from diff for scope suggestions
  const changedFiles = extractChangedFiles(diff);
  const filesSummary = summarizeFiles(changedFiles);

  let prompt = `Generate a git commit message for the following changes:

## Git Information
- Branch: ${branch}
${lastCommit ? `- Last commit: ${lastCommit}` : ''}

## Changed Files
${filesSummary}

## Diff
\`\`\`diff
${diff.substring(0, 8000)}${diff.length > 8000 ? '\n... (truncated)' : ''}
\`\`\`

Please generate a concise, descriptive commit message following Conventional Commits format.`;

  return prompt;
}

/**
 * Extract changed files from diff
 */
function extractChangedFiles(diff: string): string[] {
  const files: string[] = [];
  const lines = diff.split('\n');
  
  for (const line of lines) {
    // Match file headers in diff: diff --git a/path/to/file b/path/to/file
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match) {
      files.push(match[2]);
    }
    // Match new file: new file mode
    const newFileMatch = line.match(/^new file mode \d+$/);
    if (newFileMatch) {
      // Next few lines might contain the new file path
      const idx = lines.indexOf(line);
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const fileMatch = lines[i].match(/^--- \/dev\/null$/);
        if (fileMatch) continue;
        const createMatch = lines[i].match(/^\+\+\+ b\/(.+)$/);
        if (createMatch) {
          files.push(createMatch[1]);
          break;
        }
      }
    }
  }
  
  return [...new Set(files)];
}

/**
 * Render custom user template with variables
 */
function renderUserTemplate(template: string, context: { diff: string; branch: string; lastCommit?: string }): string {
  let result = template;
  
  // Replace {{diff}} - truncate if too long
  const truncatedDiff = context.diff.substring(0, 8000) + (context.diff.length > 8000 ? '\n... (truncated)' : '');
  result = result.replace(/\{\{diff\}\}/g, truncatedDiff);
  
  // Replace {{branch}}
  result = result.replace(/\{\{branch\}\}/g, context.branch);
  
  // Replace {{lastCommit}}
  result = result.replace(/\{\{lastCommit\}\}/g, context.lastCommit || '');
  
  return result;
}

/**
 * Summarize changed files into a brief description
 */
function summarizeFiles(files: string[]): string {
  if (files.length === 0) {
    return '- (no staged changes detected)';
  }

  // Group files by directory
  const dirs: Record<string, string[]> = {};
  
  for (const file of files) {
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts[0] : '.';
    if (!dirs[dir]) {
      dirs[dir] = [];
    }
    dirs[dir].push(file);
  }

  // Build summary
  const lines: string[] = [];
  
  for (const [dir, dirFiles] of Object.entries(dirs)) {
    if (dir === '.') {
      lines.push(`- Root: ${dirFiles.join(', ')}`);
    } else {
      const fileCount = dirFiles.length;
      if (fileCount <= 3) {
        lines.push(`- ${dir}/: ${dirFiles.map(f => f.split('/').pop()).join(', ')}`);
      } else {
        lines.push(`- ${dir}/: ${fileCount} files`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Get system prompt - allows override via config or .ai-commitrc
 */
export function getSystemPrompt(config?: AIConfig): string {
  const promptConfig = getPromptConfig(config);
  const systemPrompt = config?.systemPrompt || promptConfig.systemPrompt;
  
  if (systemPrompt) {
    return systemPrompt;
  }
  
  return `You are a helpful assistant that generates git commit messages.

Requirements:
1. Generate concise, descriptive commit messages following Conventional Commits format
2. Format: <type>(<scope>): <description>
3. Types: feat, fix, docs, chore, refactor, perf, test, style, build, ci, revert
4. Keep description under 72 characters when possible
5. Use imperative mood ("add feature" not "added feature")
6. Don't end with period
7. If the diff contains multiple unrelated changes, separate them with semicolons

Examples:
- feat(auth): add login validation
- fix: handle null pointer in user service
- docs(readme): update installation instructions
- chore(deps): upgrade dependencies to latest versions
- refactor(utils): extract common validation logic

Output ONLY the commit message, nothing else.`;
}
