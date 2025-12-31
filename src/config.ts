import { config } from 'dotenv';

/**
 * Load configuration from environment variables and .env file
 */
export interface AIConfig {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
}

export function loadConfig(configPath?: string): AIConfig {
  // Load .env file if exists
  if (!configPath) {
    configPath = process.env.CONFIG_PATH || '.env';
  }
  
  try {
    config({ path: configPath });
  } catch {
    // Ignore if .env doesn't exist
  }

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const apiBaseUrl = process.env.AI_API_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4';

  if (!apiKey) {
    throw new Error('AI_API_KEY is not set. Please configure your API key in .env file or environment variable.');
  }

  return {
    apiKey,
    apiBaseUrl,
    model,
  };
}

/**
 * Check if AI is properly configured
 */
export function isConfigured(): boolean {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  return !!apiKey;
}
