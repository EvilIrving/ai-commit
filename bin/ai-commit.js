#!/usr/bin/env node

/**
 * AI Commit Message Generator CLI
 * 
 * Usage: ai-commit [options]
 * 
 * Options:
 *   --dry-run      Show generated message without writing
 *   --verbose      Show detailed debug information
 *   --help         Show this help message
 *   setup          Set up git hooks for ai-commit
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, openSync, closeSync, realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect package manager
function detectPackageManager() {
  const managers = [
    { name: 'pnpm', versionArgs: ['--version'], installArgs: ['add', '--save-dev'], bin: 'pnpm' },
    { name: 'yarn', versionArgs: ['--version'], installArgs: ['add', '--dev'], bin: 'yarn' },
    { name: 'npm', versionArgs: ['--version'], installArgs: ['install', '--save-dev'], bin: 'npm' },
  ];

  for (const manager of managers) {
    try {
      execSync(manager.name + ' ' + manager.versionArgs.join(' '), { encoding: 'utf-8' });
      return manager;
    } catch {
      // Continue to next manager
    }
  }
  return managers[2];
}

// Setup git hooks
async function setupHooks() {
  console.log('[ai-commit] Setting up git hooks...');
  
  const projectRoot = process.cwd();
  const packageJsonPath = join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    console.error('[ai-commit] Error: No package.json found in current directory');
    process.exit(1);
  }
  
  // Get the absolute path to this ai-commit script
  const aiCommitPath = realpathSync(join(__dirname, 'ai-commit.js'));
  
  const pm = detectPackageManager();
  console.log(`[ai-commit] Detected package manager: ${pm.name}`);
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  
  // Check if simple-git-hooks is installed
  let simpleGitHooksInstalled = false;
  if (packageJson.devDependencies && packageJson.devDependencies['simple-git-hooks']) {
    simpleGitHooksInstalled = true;
    console.log('[ai-commit] simple-git-hooks is already installed');
  }
  
  // Update simple-git-hooks config
  if (!packageJson['simple-git-hooks']) {
    packageJson['simple-git-hooks'] = {};
  }
  
  // Use the script path directly (not through simple-git-hooks to ensure args are passed)
  packageJson['simple-git-hooks']['prepare-commit-msg'] = `node ${aiCommitPath} "$@"`;
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('[ai-commit] Updated package.json with simple-git-hooks configuration');
  
  // Install simple-git-hooks if needed
  if (!simpleGitHooksInstalled) {
    console.log(`[ai-commit] Installing simple-git-hooks with ${pm.name}...`);
    const installCmd = pm.name === 'yarn'
      ? [pm.bin, ...pm.installArgs, 'simple-git-hooks']
      : [pm.bin, ...pm.installArgs, 'simple-git-hooks'];
    
    spawnSync(installCmd[0], installCmd.slice(1), {
      encoding: 'utf-8',
      stdio: 'inherit',
      cwd: projectRoot
    });
  }
  
  // Run simple-git-hooks to create actual hooks
  try {
    console.log('[ai-commit] Creating git hooks...');
    let result;
    if (pm.name === 'pnpm') {
      result = execSync('pnpm exec simple-git-hooks', { encoding: 'utf-8', cwd: projectRoot });
    } else if (pm.name === 'yarn') {
      result = execSync('yarn simple-git-hooks', { encoding: 'utf-8', cwd: projectRoot });
    } else {
      result = execSync('npx simple-git-hooks', { encoding: 'utf-8', cwd: projectRoot });
    }
    console.log('[ai-commit] Git hooks installed successfully!');
    if (result && result.trim()) console.log(result);
  } catch (error) {
    console.log('[ai-commit] Note: Git hooks will be installed when you run ' + pm.name + ' install');
  }
  
  // Verify
  const hooksFile = join(projectRoot, '.git/hooks/prepare-commit-msg');
  if (existsSync(hooksFile)) {
    console.log('[ai-commit] ✓ Hook file created: .git/hooks/prepare-commit-msg');
  }
}

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const isHelp = args.includes('--help');
const isSetup = args.includes('setup');

// Get commit message file path
// Git prepare-commit-msg hook passes the path as first argument
// Fall back to .git/COMMIT_EDITMSG if not provided
const commitMsgFile = args[0] || join(process.cwd(), '.git/COMMIT_EDITMSG');

if (isHelp) {
  console.log(`
AI Commit Message Generator

Usage:
  npx ai-commit [options]

Options:
  --dry-run      Show generated message without writing to file
  --verbose      Show detailed debug information
  --help         Show this help message
  setup          Set up git hooks for ai-commit

Configuration (via .env or environment variables):
  AI_API_KEY          API key for AI service
  AI_API_BASE_URL     Base URL for API endpoint
  AI_MODEL            Model name (e.g., qwen, gpt-4)
`.trim());
  process.exit(0);
}

if (isSetup) {
  await setupHooks();
  process.exit(0);
}

// Check if commit message file already has content (meaning user provided message)
// Git creates the file with default comments, so we need to check for actual user content
if (commitMsgFile && existsSync(commitMsgFile)) {
  const existingContent = readFileSync(commitMsgFile, 'utf-8').trim();
  
  // Check if file only contains git default comments (lines starting with #)
  const hasUserContent = existingContent.split('\n').some(line => !line.trim().startsWith('#'));
  
  if (existingContent && hasUserContent && !isDryRun) {
    if (isVerbose) {
      console.log('[ai-commit] Commit message already exists, skipping generation');
    }
    process.exit(0);
  }
}

async function main() {
  try {
    // Load configuration
    const { loadConfig } = await import('../dist/config.js');
    const { getGitDiff, getCurrentBranch, getLastCommit } = await import('../dist/git.js');
    const { generateCommitMessage } = await import('../dist/ai.js');
    const { buildPrompt } = await import('../dist/prompt.js');

    const config = loadConfig();

    if (isVerbose) {
      console.log('[ai-commit] Config loaded:', JSON.stringify(config, null, 2));
    }

    // Get git information
    if (isVerbose) console.log('[ai-commit] Fetching git information...');
    
    const [diff, branch, lastCommit] = await Promise.all([
      getGitDiff(),
      getCurrentBranch(),
      getLastCommit()
    ]);

    if (!diff || diff.trim() === '') {
      console.log('[ai-commit] No staged changes detected. Skipping AI generation.');
      process.exit(0);
    }

    if (isVerbose) {
      console.log('[ai-commit] Branch:', branch);
      console.log('[ai-commit] Diff length:', diff.length, 'characters');
      if (lastCommit) console.log('[ai-commit] Last commit:', lastCommit);
    }

    // Build prompt and generate message
    const prompt = buildPrompt({ diff, branch, lastCommit, config });

    if (isVerbose) {
      console.log('[ai-commit] Prompt built successfully');
    }

    console.log('[ai-commit] Generating commit message...');
    
    const commitMessage = await generateCommitMessage(prompt, config);

    if (isDryRun) {
      console.log('\n=== Generated Commit Message (Dry Run) ===\n');
      console.log(commitMessage);
      console.log('\n==========================================\n');
      process.exit(0);
    }

    // Write to commit message file
    if (commitMsgFile && existsSync(commitMsgFile)) {
      const fullMessage = `${commitMessage}\n`;
      const fd = openSync(commitMsgFile, 'w');
      writeFileSync(fd, fullMessage);
      closeSync(fd);
      console.log('[ai-commit] Commit message generated and written.');
    } else {
      console.log('[ai-commit] Warning: Could not determine commit message file path.');
      console.log('[ai-commit] Generated message:');
      console.log(commitMessage);
    }

  } catch (error) {
    // On any error, don't block the commit - just warn
    console.error('[ai-commit] Warning: Failed to generate commit message:', error instanceof Error ? error.message : error);
    if (isVerbose && error instanceof Error) {
      console.error('[ai-commit] Stack trace:', error.stack);
    }
    // Exit silently to allow commit to proceed
    process.exit(0);
  }
}

main();
