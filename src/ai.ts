import OpenAI from 'openai';
import type { AIConfig } from './config.js';
import { getSystemPrompt } from './prompt.js';

export interface AIServiceAdapter {
  generate(prompt: string, config: AIConfig): Promise<string>;
}

function extractText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const message = response.choices[0]?.message;
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: string }).text || '');
        }
        return '';
      })
      .join('');
    if (text.trim()) return text;
  }
  const refusal = (message as { refusal?: string } | undefined)?.refusal;
  if (refusal && refusal.trim()) {
    throw new Error(`AI refused: ${refusal.trim()}`);
  }
  throw new Error('No response from AI');
}

export function cleanCommitMessage(content: string): string {
  let text = content.replace(/\r\n/g, '\n').trim();

  const fenced = text.match(/^```(?:[\w-]+)?\s*\n([\s\S]*?)\n```$/);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  } else {
    text = text.replace(/^```(?:[\w-]+)?\s*\n?/, '').replace(/\n?```$/, '').trim();
  }

  text = text.replace(/^["']|["']$/g, '').trim();
  text = text.replace(/^(commit message|提交信息)\s*[:：]\s*/i, '');
  if (!text) {
    throw new Error('AI returned an empty commit message');
  }
  return text;
}

function isUnsupportedParameterError(error: unknown): boolean {
  const message = describeApiError(error).toLowerCase();
  return /reasoning_effort/.test(message)
    || /unknown parameter/.test(message)
    || /unrecognized (request )?argument/.test(message)
    || /unexpected keyword/.test(message)
    || /extra fields? not permitted/.test(message)
    || /unsupported parameter/.test(message);
}

function describeApiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : String(error);
  }

  const apiError = error as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const status = apiError.status ? `HTTP ${apiError.status}` : 'request failed';
  const message = apiError.error?.message || apiError.message || 'unknown error';
  return `${status}: ${message}`;
}

export class OpenAIAdapter implements AIServiceAdapter {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl: string, timeoutMs: number, apiVersion?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: timeoutMs,
      defaultQuery: apiVersion ? { 'api-version': apiVersion } : undefined,
    });
  }

  async generate(prompt: string, config: AIConfig): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSystemPrompt(config),
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const response = await this.createCompletion(config.model, messages, true);
      return cleanCommitMessage(extractText(response));
    } catch (error) {
      throw new Error(`AI API ${describeApiError(error)}`);
    }
  }

  private async createCompletion(
    model: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    preferNoReasoning: boolean
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
    };

    if (preferNoReasoning) {
      try {
        return await this.client.chat.completions.create({
          ...request,
          reasoning_effort: 'none',
        } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
      } catch (error) {
        const status = (error as { status?: number }).status;
        const canRetryWithoutReasoning = status === 400 || isUnsupportedParameterError(error);
        if (!canRetryWithoutReasoning) {
          throw error;
        }
      }
    }

    return this.client.chat.completions.create(request);
  }
}

export function createAIService(config: AIConfig): AIServiceAdapter {
  return new OpenAIAdapter(
    config.apiKey,
    config.apiBaseUrl,
    config.timeoutMs,
    config.apiVersion
  );
}

export async function generateCommitMessage(
  prompt: string,
  config: AIConfig
): Promise<string> {
  const service = createAIService(config);
  return service.generate(prompt, config);
}
