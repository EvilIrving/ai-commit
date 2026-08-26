import { execFileSync } from 'child_process';

function gitExec(args: string[]): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch {
    return '';
  }
}

export function getGitDiff(): string {
  return gitExec(['diff', '--cached']);
}

export function getCurrentBranch(): string {
  let branch = gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);

  if (!branch) {
    branch = gitExec(['symbolic-ref', '--short', 'HEAD']);
  }

  if (!branch) {
    const status = gitExec(['status']);
    const match = status.match(/On branch (.+)/);
    branch = match ? match[1] : 'unknown';
  }

  return branch;
}

export function getLastCommit(): string {
  return gitExec(['log', '-1', '--pretty=%B']);
}

export function getGitStatus(): string {
  return gitExec(['status', '--porcelain']);
}

export function getChangedFiles(): string[] {
  const status = getGitStatus();
  if (!status) return [];

  return status
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^[MADRC]\s+(.+)$/);
      return match ? match[1] : line.trim();
    });
}
