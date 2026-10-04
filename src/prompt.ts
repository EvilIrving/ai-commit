import type { AIConfig } from './config.js';
import { getPromptConfig } from './rc-config.js';

/** How much of the diff is sent to the model. */
const DIFF_BUDGET = 8000;

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
  const lang = getPromptConfig(config).language;

  if (lang?.toLowerCase().startsWith('en')) {
    return DEFAULT_SYSTEM_PROMPTS.en;
  }

  return DEFAULT_SYSTEM_PROMPTS.zh;
}

/**
 * Whether the generated message should be Chinese.
 * A `.ai-commitrc` that names a language wins; without one, Chinese is the default.
 */
function isChinese(config?: AIConfig): boolean {
  const lang = getPromptConfig(config).language;
  if (lang) {
    return lang.toLowerCase().startsWith('zh');
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
  const body = truncateDiff(diff, DIFF_BUDGET);

  const prompt = useChinese
    ? `基于下面的 git diff 生成中文的提交信息：\n\n## Git 信息\n- 分支：${branch}\n${lastCommit ? `- 上次提交：${lastCommit}` : ''}\n\n## 变更文件\n${filesSummary}\n\n## 代码差异\n\`\`\`diff\n${body}\n\`\`\``
    : `Based on the following git diff, generate a commit message:\n\n## Git Information\n- Branch: ${branch}\n${lastCommit ? `- Last commit: ${lastCommit}` : ''}\n\n## Changed Files\n${filesSummary}\n\n## Diff\n\`\`\`diff\n${body}\n\`\`\``;

  return prompt;
}

/**
 * Extract changed files from diff
 */
function extractChangedFiles(diff: string): string[] {
  const files = new Set<string>();

  for (const line of diff.split('\n')) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match) {
      files.add(match[2]);
    }
  }

  return [...files];
}

/**
 * Truncate a diff to a budget without dropping whole files.
 *
 * Cutting at a fixed character count silently drops every file past the limit, so a change whose
 * substance is in the later files produces a message about the wrong thing. The budget is instead
 * spread over the files, and whatever does not fit is named in a trailing note so the model knows
 * more files were touched.
 */
export function truncateDiff(diff: string, budget: number): string {
  if (diff.length <= budget) return diff;

  const sections = diff.split(/^(?=diff --git )/m).filter((section) => section.trim());
  const perFile = Math.floor(budget / Math.max(sections.length, 1));
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const section of sections) {
    const path = section.match(/^diff --git a\/.+ b\/(.+)$/m)?.[1];
    if (section.length <= perFile) {
      kept.push(section);
      continue;
    }
    if (perFile < 200) {
      // Too little room to show anything useful from this file; name it instead.
      if (path) dropped.push(path);
      continue;
    }
    kept.push(`${section.slice(0, perFile)}\n... (this file is truncated)\n`);
    if (path) dropped.push(`${path} (partial)`);
  }

  const note = dropped.length
    ? `\n\n## Files with omitted or partial diffs\n${dropped.map((f) => `- ${f}`).join('\n')}`
    : '';

  return kept.join('') + note;
}

/**
 * Render custom user template with variables
 */
function renderUserTemplate(template: string, context: { diff: string; branch: string; lastCommit?: string }): string {
  let result = template;

  // Replace {{diff}} - truncate if too long
  const truncatedDiff = truncateDiff(context.diff, DIFF_BUDGET);
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
