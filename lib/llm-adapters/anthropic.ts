import type { LlmAdapter, ChatMessage, ChatOptions, ChatCompletion, ProviderRates } from './types';
import { ServiceError } from '../../services/errors';
import { parseSSE } from './sse';

const BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const RATES: Record<string, ProviderRates> = {
  'claude-3-5-sonnet': { in: 3.00,  out: 15.00 },
  'claude-3-5-haiku':  { in: 0.80,  out: 4.00  },
  'claude-3-opus':     { in: 15.00, out: 75.00 },
};

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ServiceError('anthropic_no_key', 500, 'ANTHROPIC_API_KEY is not set');
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    'x-api-key': apiKey(),
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
  };
}

function splitSystemMessages(messages: ChatMessage[]): { system: string | undefined; userMessages: ChatMessage[] } {
  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
  const userMessages = messages.filter(m => m.role !== 'system');
  return {
    system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
    userMessages,
  };
}

export const anthropicAdapter: LlmAdapter = {
  name: 'anthropic',

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatCompletion> {
    const model = opts.model ?? 'claude-3-5-haiku';
    const { system, userMessages } = splitSystemMessages(messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: userMessages,
      ...(system && { system }),
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    };

    const resp = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('anthropic_chat_error', resp.status, (err as any)?.error?.message ?? `Anthropic chat failed: ${resp.status}`);
    }

    const data = await resp.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const textBlock = data.content.find(b => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      tokensIn: data.usage.input_tokens,
      tokensOut: data.usage.output_tokens,
      model: data.model,
    };
  },

  async *streamChat(messages: ChatMessage[], opts: ChatOptions): AsyncIterable<string> {
    const model = opts.model ?? 'claude-3-5-haiku';
    const { system, userMessages } = splitSystemMessages(messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: userMessages,
      stream: true,
      ...(system && { system }),
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    };

    const resp = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('anthropic_stream_error', resp.status, (err as any)?.error?.message ?? `Anthropic stream failed: ${resp.status}`);
    }

yield* parseSSE(resp, (payload) => {
      const event = JSON.parse(payload) as { type: string; delta?: { type: string; text?: string } };
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        return { chunks: [event.delta.text] };
      }
      return {};
    });
  },

  async embed(_text: string | string[], _opts?: { model?: string }): Promise<number[][]> {
    throw new ServiceError('embed_unsupported', 501, 'Anthropic does not provide embeddings API; use OpenAI or another provider for embed()');
  },

  async transcribe(_audio: Blob | ArrayBuffer, _opts?: { model?: string; language?: string }): Promise<string> {
    throw new ServiceError('transcribe_unsupported', 501, 'Anthropic does not provide transcription API; use OpenAI or another provider for transcribe()');
  },

  ratesPerMillionTokens(model: string): ProviderRates {
    return RATES[model] ?? { in: 0, out: 0 };
  },
};