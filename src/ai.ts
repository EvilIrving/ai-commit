import OpenAI from 'openai';
import type { AIConfig } from './config.js';
import { getSystemPrompt } from './prompt.js';

export interface AIServiceAdapter {
  generate(prompt: string, config: AIConfig): Promise<string>;
}

/** The error text is built from either a plain Error or an API error object. */
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
  return /reasoning/.test(message)
    || /unknown parameter/.test(message)
    || /unrecognized (request )?argument/.test(message)
    || /unexpected keyword/.test(message)
    || /extra fields? not permitted/.test(message)
    || /unsupported parameter/.test(message);
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
    try {
      const response = await this.createResponse(config.model, prompt, config);
      return cleanCommitMessage(response.output_text);
    } catch (error) {
      throw new Error(`AI API ${describeApiError(error)}`);
    }
  }

  private async createResponse(
    model: string,
    prompt: string,
    config: AIConfig
  ): Promise<OpenAI.Responses.Response> {
    const request: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      instructions: getSystemPrompt(config),
      input: prompt,
      reasoning: { effort: config.reasoningEffort },
    };

    try {
      return await this.client.responses.create(request);
    } catch (error) {
      // Endpoints that predate the reasoning parameter reject it; retry without it once.
      const status = (error as { status?: number }).status;
      if (status !== 400 && !isUnsupportedParameterError(error)) {
        throw error;
      }
      const { reasoning: _reasoning, ...withoutReasoning } = request;
      return this.client.responses.create(withoutReasoning);
    }
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
