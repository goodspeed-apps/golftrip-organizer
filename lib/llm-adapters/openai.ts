import type { LlmAdapter, ChatMessage, ChatOptions, ChatCompletion, ProviderRates } from './types';
import { ServiceError } from '../../services/errors';
import { parseSSE } from './sse';

const BASE = 'https://api.openai.com/v1';

const RATES: Record<string, ProviderRates> = {
  'gpt-4o-mini':               { in: 0.15,  out: 0.60  },
  'gpt-4o':                    { in: 2.50,  out: 10.00 },
  'text-embedding-3-small':    { in: 0.02,  out: 0     },
  // whisper-1 is billed per audio minute, not per token
  'whisper-1':                 { in: 0,     out: 0     },
};

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ServiceError('openai_no_key', 500, 'OPENAI_API_KEY is not set');
  return key;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' };
}

export const openaiAdapter: LlmAdapter = {
  name: 'openai',

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatCompletion> {
    const model = opts.model ?? 'gpt-4o-mini';
    const body: Record<string, unknown> = {
      model,
      messages,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
    };

    const resp = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('openai_chat_error', resp.status, (err as any)?.error?.message ?? `OpenAI chat failed: ${resp.status}`);
    }

    const data = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0].message.content,
      tokensIn: data.usage.prompt_tokens,
      tokensOut: data.usage.completion_tokens,
      model: data.model,
    };
  },

  async *streamChat(messages: ChatMessage[], opts: ChatOptions): AsyncIterable<string> {
    const model = opts.model ?? 'gpt-4o-mini';
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
    };

    const resp = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('openai_stream_error', resp.status, (err as any)?.error?.message ?? `OpenAI stream failed: ${resp.status}`);
    }

yield* parseSSE(resp, (payload) => {
      if (payload === '[DONE]') return { done: true };
      const chunk = JSON.parse(payload) as { choices: Array<{ delta: { content?: string } }> };
      const content = chunk.choices[0]?.delta?.content;
      return content ? { chunks: [content] } : {};
    });
  },

  async embed(text: string | string[], opts?: { model?: string }): Promise<number[][]> {
    const model = opts?.model ?? 'text-embedding-3-small';
    const input = Array.isArray(text) ? text : [text];

    const resp = await fetch(`${BASE}/embeddings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ model, input }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('openai_embed_error', resp.status, (err as any)?.error?.message ?? `OpenAI embed failed: ${resp.status}`);
    }

    const data = await resp.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map(d => d.embedding);
  },

  async transcribe(audio: Blob | ArrayBuffer, opts?: { model?: string; language?: string }): Promise<string> {
    const model = opts?.model ?? 'whisper-1';
    const blob = audio instanceof Blob ? audio : new Blob([audio]);

    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', model);
    if (opts?.language) form.append('language', opts.language);

    const resp = await fetch(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new ServiceError('openai_transcribe_error', resp.status, (err as any)?.error?.message ?? `OpenAI transcribe failed: ${resp.status}`);
    }

    const data = await resp.json() as { text: string };
    return data.text;
  },

  ratesPerMillionTokens(model: string): ProviderRates {
    return RATES[model] ?? { in: 0, out: 0 };
  },
};
