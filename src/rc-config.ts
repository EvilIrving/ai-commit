import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { AIConfig } from './config';

export interface AIPromptConfig {
  systemPrompt?: string;
  userPromptTemplate?: string;
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

  // Also check for prompt-specific env overrides
  return {
    systemPrompt: process.env.AI_SYSTEM_PROMPT || undefined,
    userPromptTemplate: process.env.AI_USER_PROMPT_TEMPLATE || undefined,
  };
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
      };
    } else {
      // YAML format
      const config = yaml.load(content) as Record<string, unknown>;
      return {
        systemPrompt: config.systemPrompt as string || config.system_prompt as string,
        userPromptTemplate: config.userPromptTemplate as string || config.user_prompt_template as string || config.promptTemplate as string || config.prompt_template as string,
      };
    }
  } catch (error) {
    console.error(`Failed to load config file: ${filePath}`);
    return {};
  }
}

/**
 * Get combined config with environment variables taking precedence
 */
export function getPromptConfig(config?: AIConfig): AIPromptConfig {
  const rcConfig = loadRcConfig(config);
  
  // Environment variables override config file
  return {
    systemPrompt: process.env.AI_SYSTEM_PROMPT || rcConfig.systemPrompt,
    userPromptTemplate: process.env.AI_USER_PROMPT_TEMPLATE || rcConfig.userPromptTemplate,
  };
}
