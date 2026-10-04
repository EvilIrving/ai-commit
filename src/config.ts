import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { config } from 'dotenv';

export interface AIConfig {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: number;
  reasoningEffort: ReasoningEffort;
  apiVersion?: string;
}

/** Accepted by the Responses API. `none` turns reasoning off entirely. */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
];

function parseReasoningEffort(raw: string | undefined): ReasoningEffort {
  const value = raw?.trim().toLowerCase();
  if (value && (REASONING_EFFORTS as readonly string[]).includes(value)) {
    return value as ReasoningEffort;
  }
  return 'low';
}

function gitRoot(): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

function loadEnvFiles(explicitPath?: string): void {
  const cwd = process.cwd();
  const root = gitRoot();
  const home = homedir();
  // Highest-priority file first. dotenv never overrides real environment variables.
  const files = [
    explicitPath,
    cwd ? join(cwd, '.env') : '',
    root && root !== cwd ? join(root, '.env') : '',
    home ? join(home, '.ai-commit.env') : '',
  ].filter((filePath): filePath is string => Boolean(filePath));

  for (const filePath of files) {
    if (existsSync(filePath)) {
      config({ path: filePath });
    }
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (/^https?:\/\/api\.openai\.com$/i.test(trimmed)) {
    return `${trimmed}/v1`;
  }
  return trimmed;
}

function parseTimeout(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30_000;
  }
  return Math.min(parsed, 120_000);
}

export function loadConfig(configPath?: string): AIConfig {
  const explicitPath = configPath || process.env.CONFIG_PATH;
  loadEnvFiles(explicitPath);

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const apiBaseUrl = normalizeBaseUrl(
    process.env.AI_API_BASE_URL
    || process.env.OPENAI_BASE_URL
    || process.env.OPENAI_API_BASE
    || 'https://api.openai.com/v1'
  );
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const timeoutMs = parseTimeout(process.env.AI_TIMEOUT_MS);
  const reasoningEffort = parseReasoningEffort(
    process.env.AI_REASONING_EFFORT || process.env.OPENAI_REASONING_EFFORT
  );
  const apiVersion = process.env.OPENAI_API_VERSION || process.env.AZURE_OPENAI_API_VERSION;

  if (!apiKey) {
    throw new Error(
      'AI_API_KEY is not set. Put it in the repo .env, ~/.ai-commit.env, or the environment.'
    );
  }

  return {
    apiKey,
    apiBaseUrl,
    model,
    timeoutMs,
    reasoningEffort,
    apiVersion: apiVersion || undefined,
  };
}

export function redactConfig(aiConfig: AIConfig): Record<string, string | number | undefined> {
  const key = aiConfig.apiKey;
  const redactedKey = key.length <= 8
    ? '(set)'
    : `${key.slice(0, 3)}…${key.slice(-4)}`;

  return {
    apiKey: redactedKey,
    apiBaseUrl: aiConfig.apiBaseUrl,
    model: aiConfig.model,
    timeoutMs: aiConfig.timeoutMs,
    reasoningEffort: aiConfig.reasoningEffort,
    apiVersion: aiConfig.apiVersion,
  };
}
