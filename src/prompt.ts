import type { AIConfig } from './config.js';
import { getPromptConfig, hasRcConfig } from './rc-config.js';

export interface PromptContext {
  diff: string;
  branch: string;
  lastCommit?: string;
  config: AIConfig;
}

// Default system prompts in English and Chinese
export const DEFAULT_SYSTEM_PROMPTS = {
  en: `You are a git commit message generator. Strictly follow these rules:
1. Output format: <type>: <title> or <type>: <title>\n\n<body>
2. type must be one of: feat|fix|docs|chore|style|refactor|perf|test
3. title must be concise, not exceeding 80 characters
4. body is optional, only add when diff content is complex and needs explanation
5. If body is needed, list changes in bullet points, each point concise
6. Output plain text, do not use code formatting markers`,

  zh: `你是一个 git 提交信息生成器。严格遵守以下规则：
1. 输出格式：<type>: <title> 或 <type>: <title>\n\n<body>
2. type 必须从以下选项中选择：feat|fix|docs|chore|style|refactor|perf|test
3. title 必须简短精炼，不超过 80 个字符
4. body 是可选的，仅在 diff 内容复杂、需要补充说明时添加
5. 如果需要 body，应将变更内容分点列出，每个要点简洁明了
6. 输出纯文本，不要使用代码格式标记`,
};

/**
 * Get the default system prompt based on language preference
 * If no .ai-commitrc config exists, default to Chinese
 */
function getDefaultSystemPrompt(config?: AIConfig): string {
  const promptConfig = getPromptConfig(config);
  const lang = promptConfig.language;

  if (lang) {
    // If language is specified in config, use it
    if (lang.toLowerCase().startsWith('en')) {
      return DEFAULT_SYSTEM_PROMPTS.en;
    }
    if (lang.toLowerCase().startsWith('zh')) {
      return DEFAULT_SYSTEM_PROMPTS.zh;
    }
  }

  // If no config file exists, default to Chinese
  if (!hasRcConfig()) {
    return DEFAULT_SYSTEM_PROMPTS.zh;
  }

  // Default to Chinese for unspecified
  return DEFAULT_SYSTEM_PROMPTS.zh;
}

/**
 * Get the language for user prompt
 * If no .ai-commitrc config exists, default to Chinese
 */
function isChinese(config?: AIConfig): boolean {
  const promptConfig = getPromptConfig(config);
  const lang = promptConfig.language;

  if (lang) {
    return lang.toLowerCase().startsWith('zh');
  }

  // If no config file exists, default to Chinese
  if (!hasRcConfig()) {
    return true;
  }

  return true;
}

/**
 * Build prompt for commit message generation
 */
export function buildPrompt(context: PromptContext): string {
  const { diff, branch, lastCommit, config } = context;

  // Load prompt config from .ai-commitrc
  const promptConfig = getPromptConfig(config);
  const userTemplate = promptConfig.userPromptTemplate;

  // If custom template is provided, use it
  if (userTemplate) {
    return renderUserTemplate(userTemplate, { diff, branch, lastCommit });
  }

  // Extract changed files from diff for scope suggestions
  const changedFiles = extractChangedFiles(diff);
  const filesSummary = summarizeFiles(changedFiles);

  const useChinese = isChinese(config);

  let prompt = useChinese
    ? `基于下面的 git diff 生成中文的提交信息：\n\n## Git 信息\n- 分支：${branch}\n${lastCommit ? `- 上次提交：${lastCommit}` : ''}\n\n## 变更文件\n${filesSummary}\n\n## 代码差异\n\`\`\`diff\n${diff.substring(0, 8000)}${diff.length > 8000 ? '\n... (已截断)' : ''}\n\`\`\``
    : `Based on the following git diff, generate a commit message:\n\n## Git Information\n- Branch: ${branch}\n${lastCommit ? `- Last commit: ${lastCommit}` : ''}\n\n## Changed Files\n${filesSummary}\n\n## Diff\n\`\`\`diff\n${diff.substring(0, 8000)}${diff.length > 8000 ? '\n... (truncated)' : ''}\n\`\`\``;

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
 * Get system prompt - allows override via .ai-commitrc file
 */
export function getSystemPrompt(config?: AIConfig): string {
  const promptConfig = getPromptConfig(config);
  const systemPrompt = promptConfig.systemPrompt;

  if (systemPrompt) {
    return systemPrompt;
  }

  return getDefaultSystemPrompt(config);
}
