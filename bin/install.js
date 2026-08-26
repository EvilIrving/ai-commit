#!/usr/bin/env node

/**
 * Install git hooks for ai-commit
 * This script sets up simple-git-hooks to automatically generate commit messages
 * Supports npm, pnpm, and yarn
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, realpathSync } from 'fs';
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
  
  // Default to npm if none found
  return managers[2];
}

async function installHooks() {
  console.log('[ai-commit] Setting up git hooks...');

  try {
    // Get the absolute path to the ai-commit script
    const aiCommitPath = realpathSync(join(__dirname, 'ai-commit.js'));

    // Detect package manager
    const pm = detectPackageManager();
    console.log(`[ai-commit] Detected package manager: ${pm.name}`);

    // Check package.json in current directory
    const packageJsonPath = './package.json';
    if (!existsSync(packageJsonPath)) {
      console.error('[ai-commit] Error: No package.json found in current directory');
      process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Check if simple-git-hooks is already installed
    let simpleGitHooksInstalled = false;
    if (packageJson.devDependencies && packageJson.devDependencies['simple-git-hooks']) {
      simpleGitHooksInstalled = true;
      console.log('[ai-commit] simple-git-hooks is already installed');
    }

    // Update simple-git-hooks config
    if (!packageJson['simple-git-hooks']) {
      packageJson['simple-git-hooks'] = {};
    }

    packageJson['simple-git-hooks']['prepare-commit-msg'] = `node ${aiCommitPath} "$@"`;

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    console.log('[ai-commit] Updated package.json with simple-git-hooks configuration');

    // Install simple-git-hooks if not already installed
    if (!simpleGitHooksInstalled) {
      console.log(`[ai-commit] Installing simple-git-hooks with ${pm.name}...`);
      
      const installCmd = pm.name === 'yarn' 
        ? [pm.bin, ...pm.installArgs, 'simple-git-hooks']
        : [pm.bin, ...pm.installArgs, 'simple-git-hooks'];
      
      const result = spawnSync(installCmd[0], installCmd.slice(1), { 
        encoding: 'utf-8', 
        stdio: 'inherit'
      });
      
      if (result.status !== 0) {
        console.error('[ai-commit] Failed to install simple-git-hooks');
        console.log('[ai-commit] Please run manually: ' + installCmd.join(' '));
        process.exit(1);
      }
      
      console.log('[ai-commit] simple-git-hooks installed successfully');
    }

    // Try to run simple-git-hooks to install the actual git hooks
    try {
      console.log('[ai-commit] Creating git hooks...');
      
      let result;
      if (pm.name === 'pnpm') {
        // Use pnpm exec for pnpm
        result = execSync('pnpm exec simple-git-hooks', { encoding: 'utf-8' });
      } else if (pm.name === 'yarn') {
        result = execSync('yarn simple-git-hooks', { encoding: 'utf-8' });
      } else {
        result = execSync('npx simple-git-hooks', { encoding: 'utf-8' });
      }
      
      console.log('[ai-commit] Git hooks installed successfully!');
      if (result && result.trim()) console.log(result);
    } catch (error) {
      console.log('[ai-commit] Note: Git hooks will be installed when you run ' + pm.name + ' install');
      console.log('[ai-commit] Or manually run: pnpm exec simple-git-hooks');
    }

    // Verify hooks were created
    const hooksDir = '.git/hooks';
    const prepareCommitMsg = join(hooksDir, 'prepare-commit-msg');
    if (existsSync(prepareCommitMsg)) {
      console.log('[ai-commit] ✓ Hook file created: .git/hooks/prepare-commit-msg');
    } else {
      console.log('[ai-commit] Warning: Hook file not found');
    }

  } catch (error) {
    console.error('[ai-commit] Error setting up hooks:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

installHooks();
