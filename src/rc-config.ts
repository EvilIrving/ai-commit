import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { AIConfig } from './config.js';

export interface AIPromptConfig {
  systemPrompt?: string;
  userPromptTemplate?: string;
  language?: string;
}

/**
 * Find and load .ai-commitrc config file
 * Searches in: current directory, home directory, or path specified by AI_COMMITRC_PATH
 */
export function loadRcConfig(config?: AIConfig): AIPromptConfig {
  // Check for explicit path first
  const explicitPath = process.env.AI_COMMITRC_PATH;
  if (explicitPath) {
    return loadRcFile(explicitPath);
  }

  // Search order: current dir -> home dir
  const searchPaths = [
    '.ai-commitrc',
    '.ai-commitrc.yml',
    '.ai-commitrc.yaml',
    '.ai-commitrc.json',
  ];

  // Check current directory
  for (const filename of searchPaths) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      return loadRcFile(filePath);
    }
  }

  // Check home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    for (const filename of searchPaths) {
      const filePath = path.join(homeDir, filename);
      if (fs.existsSync(filePath)) {
        return loadRcFile(filePath);
      }
    }
  }

  return {};
}

/**
 * Load and parse a config file
 */
function loadRcFile(filePath: string): AIPromptConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      const config = JSON.parse(content);
      return {
        systemPrompt: config.systemPrompt || config.system_prompt,
        userPromptTemplate: config.userPromptTemplate || config.user_prompt_template || config.promptTemplate || config.prompt_template,
        language: config.language || config.lang || config.language,
      };
    } else {
      // YAML format
      const config = yaml.load(content) as Record<string, unknown>;
      return {
        systemPrompt: config.systemPrompt as string || config.system_prompt as string,
        userPromptTemplate: config.userPromptTemplate as string || config.user_prompt_template as string || config.promptTemplate as string || config.prompt_template as string,
        language: config.language as string || config.lang as string,
      };
    }
  } catch (error) {
    console.error(`Failed to load config file: ${filePath}`);
    return {};
  }
}

/**
 * Get prompt config from .ai-commitrc file
 */
export function getPromptConfig(config?: AIConfig): AIPromptConfig {
  return loadRcConfig(config);
}

/**
 * Check if .ai-commitrc config file exists
 */
export function hasRcConfig(): boolean {
  // Check for explicit path first
  const explicitPath = process.env.AI_COMMITRC_PATH;
  if (explicitPath) {
    return fs.existsSync(explicitPath);
  }

  // Search order: current dir -> home dir
  const searchPaths = [
    '.ai-commitrc',
    '.ai-commitrc.yml',
    '.ai-commitrc.yaml',
    '.ai-commitrc.json',
  ];

  // Check current directory
  for (const filename of searchPaths) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      return true;
    }
  }

  // Check home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    for (const filename of searchPaths) {
      const filePath = path.join(homeDir, filename);
      if (fs.existsSync(filePath)) {
        return true;
      }
    }
  }

  return false;
}
