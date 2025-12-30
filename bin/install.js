#!/usr/bin/env node

/**
 * Install git hooks for ai-commit
 * This script sets up simple-git-hooks to automatically generate commit messages
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function installHooks() {
  console.log('[ai-commit] Setting up git hooks...');

  try {
    // Check if simple-git-hooks is installed
    try {
      execSync('npm list simple-git-hooks --depth=0', { encoding: 'utf-8' });
    } catch {
      console.log('[ai-commit] Installing simple-git-hooks...');
      execSync('npm install --save-dev simple-git-hooks', { stdio: 'inherit' });
    }

    // Check package.json
    const packageJsonPath = './package.json';
    if (!existsSync(packageJsonPath)) {
      console.error('[ai-commit] Error: No package.json found in current directory');
      process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Update simple-git-hooks config
    if (!packageJson['simple-git-hooks']) {
      packageJson['simple-git-hooks'] = {};
    }

    packageJson['simple-git-hooks']['prepare-commit-msg'] = 'npx ai-commit';

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    console.log('[ai-commit] Updated package.json with simple-git-hooks configuration');

    // Try to run simple-git-hooks to install the actual git hooks
    try {
      execSync('npx simple-git-hooks', { encoding: 'utf-8' });
      console.log('[ai-commit] Git hooks installed successfully!');
    } catch {
      console.log('[ai-commit] Note: Git hooks will be installed when you run npm install');
    }

  } catch (error) {
    console.error('[ai-commit] Error setting up hooks:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

installHooks();
