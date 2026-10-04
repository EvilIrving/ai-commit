import OpenAI from 'openai';
import type { AIConfig } from './config.js';
import { getSystemPrompt } from './prompt.js';

export interface AIServiceAdapter {
  generate(prompt: string, config: AIConfig): Promise<string>;
}

/** True when the endpoint does not serve the path at all, as opposed to rejecting the body. */
function isMissingEndpoint(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return status === 404 || status === 405;
}

/**
 * Pull the answer text out of a Responses API reply.
 *
 * The `output_text` convenience field is only filled in by the SDK's own `parse()` helper, so an
 * ordinary `responses.create()` call leaves it undefined (DeepSeek does not send it at all). The
 * text therefore has to be read from the `output` array: every `message` item's `output_text`
 * parts, in order, skipping the `reasoning` items that reasoning models emit alongside them.
 */
function extractResponseText(response: OpenAI.Responses.Response): string {
  const chunks: string[] = [];

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text) {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('').trim();
}

/** The same text, from a Chat Completions reply. */
function extractChatText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const message = response.choices[0]?.message;

  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }
  if (message?.refusal?.trim()) {
    throw new Error(`the model refused: ${message.refusal.trim()}`);
  }
  return '';
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
      const text = await this.complete(prompt, config);
      if (!text) throw new Error('the model returned no text');
      return cleanCommitMessage(text);
    } catch (error) {
      throw new Error(`AI API ${describeApiError(error)}`);
    }
  }

  /**
   * Ask for the message, preferring the Responses API and falling back to Chat Completions.
   *
   * A 404 or 405 means the endpoint does not serve `/responses` at all, which is common for
   * self-hosted and third-party gateways. Those still speak `/chat/completions`, so the same
   * request is retried there rather than failing the commit.
   */
  private async complete(prompt: string, config: AIConfig): Promise<string> {
    try {
      return extractResponseText(await this.createResponse(config.model, prompt, config));
    } catch (error) {
      if (!isMissingEndpoint(error)) throw error;
      return extractChatText(await this.createCompletion(config.model, prompt, config));
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
      if (isMissingEndpoint(error)) throw error;
      // Endpoints that predate the reasoning parameter reject it; retry without it once.
      const status = (error as { status?: number }).status;
      if (status !== 400 && !isUnsupportedParameterError(error)) {
        throw error;
      }
      const { reasoning: _reasoning, ...withoutReasoning } = request;
      return this.client.responses.create(withoutReasoning);
    }
  }

  private async createCompletion(
    model: string,
    prompt: string,
    config: AIConfig
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: [
        { role: 'system', content: getSystemPrompt(config) },
        { role: 'user', content: prompt },
      ],
    };

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
