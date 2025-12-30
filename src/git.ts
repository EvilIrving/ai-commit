import { execSync } from 'child_process';

/**
 * Execute git command and return output
 */
function gitExec(args: string): string {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Get staged git diff (--cached)
 */
export function getGitDiff(): string {
  const diff = gitExec('diff --cached');
  
  // If no cached diff, try getting all staged changes
  if (!diff) {
    const diffNoIndex = gitExec('diff --cached --no-index /dev/null . 2>/dev/null || git diff --cached');
    return diffNoIndex || '';
  }
  
  return diff;
}

/**
 * Get current branch name
 */
export function getCurrentBranch(): string {
  // Try rev-parse first (most reliable)
  let branch = gitExec('rev-parse --abbrev-ref HEAD');
  
  if (!branch) {
    // Fallback to symbolic-ref
    branch = gitExec('symbolic-ref --short HEAD');
  }
  
  if (!branch) {
    // Last resort: extract from status
    const status = gitExec('status');
    const match = status.match(/On branch (.+)/);
    branch = match ? match[1] : 'unknown';
  }
  
  return branch;
}

/**
 * Get last commit message (optional)
 */
export function getLastCommit(): string {
  try {
    return gitExec('log -1 --pretty=%B');
  } catch {
    return '';
  }
}

/**
 * Get git status summary
 */
export function getGitStatus(): string {
  return gitExec('status --porcelain');
}

/**
 * Get list of changed files
 */
export function getChangedFiles(): string[] {
  const status = getGitStatus();
  if (!status) return [];
  
  return status
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Parse porcelain format: XY filename
      const match = line.match(/^[MADRC]\s+(.+)$/);
      return match ? match[1] : line.trim();
    });
}
