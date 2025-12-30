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
 */

import { readFileSync, existsSync, writeFileSync, openSync, closeSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const isHelp = args.includes('--help');

// Get commit message file path from git (passed as first argument to prepare-commit-msg hook)
const commitMsgFile = args.find(arg => !arg.startsWith('-')) || process.env.GIT_PARAMS || '';

if (isHelp) {
  console.log(`
AI Commit Message Generator

Usage:
  npx ai-commit [options]

Options:
  --dry-run      Show generated message without writing to file
  --verbose      Show detailed debug information
  --help         Show this help message

Configuration (via .env or environment variables):
  AI_API_KEY          API key for AI service
  AI_API_BASE_URL     Base URL for API endpoint
  AI_MODEL            Model name (e.g., qwen, gpt-4)
  AI_TEMPERATURE      Temperature for generation (0-2, default 0.3)
  AI_MAX_TOKENS       Max tokens for response (default 100)
  `.trim());
  process.exit(0);
}

// Check if commit message file already has content (meaning user provided message)
if (commitMsgFile && existsSync(commitMsgFile)) {
  const existingContent = readFileSync(commitMsgFile, 'utf-8').trim();
  if (existingContent && !isDryRun) {
    if (isVerbose) {
      console.log('[ai-commit] Commit message already exists, skipping generation');
    }
    process.exit(0);
  }
}

async function main() {
  try {
    // Load configuration
    const { loadConfig } = await import('./dist/config.js');
    const { getGitDiff, getCurrentBranch, getLastCommit } = await import('./dist/git.js');
    const { generateCommitMessage } = await import('./dist/ai.js');
    const { buildPrompt } = await import('./dist/prompt.js');

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
