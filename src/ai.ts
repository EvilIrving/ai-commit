import OpenAI from 'openai';
import type { AIConfig } from './config';
import { getSystemPrompt } from './prompt';

/**
 * AI Service Adapter Interface
 * Allows easy extension for different AI providers
 */
export interface AIServiceAdapter {
  generate(prompt: string, config: AIConfig): Promise<string>;
}

/**
 * OpenAI-compatible adapter (works with OpenAI, Azure, and many self-hosted models)
 */
export class OpenAIAdapter implements AIServiceAdapter {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  async generate(prompt: string, config: AIConfig): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(config),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Clean up the response - remove quotes, extra whitespace
    return this.cleanResponse(content);
  }

  private getSystemPrompt(config?: AIConfig): string {
    return getSystemPrompt(config);
  }

  private cleanResponse(content: string): string {
    return content
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^```[\s\S]*?```$/gm, '') // Remove code blocks
      .split('\n')[0] // Take first line only
      .trim();
  }
}

/**
 * DashScope (Alibaba Qwen) adapter
 */
export class DashScopeAdapter implements AIServiceAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, config: AIConfig): Promise<string> {
    const systemPrompt = getSystemPrompt(config);
    
    const response = await fetch(`${this.baseUrl}/api/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        parameters: {
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`DashScope API error: ${response.statusText}`);
    }

    const data = await response.json() as { output?: { text: string }; choices?: Array<{ message: { content: string } }> };
    const content = data.output?.text || data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    return content.trim().split('\n')[0].trim();
  }
}

/**
 * Factory function to create appropriate adapter based on config
 */
export function createAIService(config: AIConfig): AIServiceAdapter {
  const baseUrl = config.apiBaseUrl.toLowerCase();
  
  // Detect provider based on base URL or model
  if (baseUrl.includes('dashscope') || config.model.includes('qwen')) {
    return new DashScopeAdapter(config.apiKey, config.apiBaseUrl);
  }
  
  // Default to OpenAI-compatible adapter
  return new OpenAIAdapter(config.apiKey, config.apiBaseUrl);
}

/**
 * Generate commit message using AI
 */
export async function generateCommitMessage(
  prompt: string,
  config: AIConfig
): Promise<string> {
  const service = createAIService(config);
  return service.generate(prompt, config);
}
