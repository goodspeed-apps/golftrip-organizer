/**
 * GAS Template, LLM Service
 *
 * Multi-provider LLM facade. Resolves the active adapter from gasConfig.llm.provider,
 * reserves a worst-case cost estimate via the cluster-2 consume_cost RPC before
 * each call, then reconciles to actual usage with a single delta call after.
 *
 * Dependencies: @supabase/supabase-js
 */

import { supabase } from '../lib/supabase';
import { gasConfig } from '../gas.config';
import { ServiceError } from './errors';
import { openaiAdapter } from '../lib/llm-adapters/openai';
import { anthropicAdapter } from '../lib/llm-adapters/anthropic';
import { captureEvent } from '../lib/posthog';
import { captureException } from '../lib/sentry';
import { EVENTS } from '../lib/events';
import { retryWithBackoff, isTransientNon4xxError } from '../lib/retry';
import type { LlmAdapter, ChatMessage, ChatOptions, ChatCompletion } from '../lib/llm-adapters/types';

export type { ChatMessage, ChatOptions, ChatCompletion } from '../lib/llm-adapters/types';

// ─── Typed provider / model constants ─────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic';

const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_TRANSCRIBE_MODEL = 'whisper-1';
const DEFAULT_MAX_TOKENS = 1024;
const CHARS_PER_TOKEN = 4;

const ADAPTERS: Record<LLMProvider, LlmAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
};

function resolveAdapter(): LlmAdapter {
  const provider = (gasConfig.llm.provider ?? 'openai') as LLMProvider;
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new ServiceError('llm_unknown_provider', 500, `Unknown LLM provider: ${provider}`);
  return adapter;
}

// ─── Cost helpers ──────────────────────────────────────────────────────────────

// Cache the resolved user id at module scope: chat() is called frequently and
// each getSession() call hits the SecureStore adapter. Invalidate on auth
// state change. Mirrors the lib/admin.ts cache pattern.
let cachedUserId: string | null | undefined = undefined;
let authSubscribed = false;

function ensureAuthInvalidation(): void {
  if (authSubscribed) return;
  authSubscribed = true;
  try {
    supabase.auth.onAuthStateChange(() => {
      cachedUserId = undefined;
    });
  } catch {
    // ignore, listener registration optional in test envs
  }
}

/** Test-only: reset the cached user id between specs. */
export function __clearLlmUserCache(): void {
  cachedUserId = undefined;
}

async function getUserId(): Promise<string> {
  ensureAuthInvalidation();
  if (cachedUserId !== undefined) return cachedUserId ?? 'anonymous';
  const { data: { session } } = await supabase.auth.getSession();
  cachedUserId = session?.user?.id ?? null;
  return cachedUserId ?? 'anonymous';
}

function reserveEstimate(adapter: LlmAdapter, model: string, charCount: number, maxTokens: number): number {
  const rates = adapter.ratesPerMillionTokens(model);
  const estimatedInputTokens = Math.ceil(charCount / CHARS_PER_TOKEN);
  return (estimatedInputTokens / 1_000_000) * rates.in + (maxTokens / 1_000_000) * rates.out;
}

function actualCost(adapter: LlmAdapter, completion: ChatCompletion): number {
  const rates = adapter.ratesPerMillionTokens(completion.model);
  return (completion.tokensIn / 1_000_000) * rates.in + (completion.tokensOut / 1_000_000) * rates.out;
}

async function consumeCost(userId: string, cost: number, period: string): Promise<boolean> {
  try {
    const { data } = await retryWithBackoff(
      async () => {
        const res = await supabase.rpc('consume_cost', {
          p_scope: gasConfig.llm.costScope ?? 'llm',
          p_key: userId,
          p_cost: cost,
          p_period: period,
        });
        if (res.error) throw res.error;
        return res;
      },
      { shouldRetry: isTransientNon4xxError },
    );
    return (data as { allowed: boolean }).allowed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ServiceError('llm_budget_rpc_error', 500, message);
  }
}

async function recordDelta(userId: string, delta: number, period: string): Promise<void> {
  if (delta === 0) return;
  // consume_cost accepts a signed numeric: positive consumes, negative refunds
  // the unused portion of a worst-case reservation.
  await retryWithBackoff(
    async () => {
      const res = await supabase.rpc('consume_cost', {
        p_scope: gasConfig.llm.costScope ?? 'llm',
        p_key: userId,
        p_cost: delta,
        p_period: period,
      });
      if (res.error) throw res.error;
      return res;
    },
    { shouldRetry: isTransientNon4xxError },
  );
}

// ─── chat ──────────────────────────────────────────────────────────────────────

export async function chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatCompletion> {
  const adapter = resolveAdapter();
  const resolvedOpts: ChatOptions = opts ?? {};
  const model = resolvedOpts.model ?? gasConfig.llm.defaultChatModel ?? DEFAULT_CHAT_MODEL;
  const period = gasConfig.llm.budgetPeriod ?? 'day';
  const maxTokens = resolvedOpts.maxTokens ?? gasConfig.llm.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;

  const charCount = messages.reduce((n, m) => n + m.content.length, 0);
  const reserve = reserveEstimate(adapter, model, charCount, maxTokens);
  const userId = await getUserId();

  const allowed = await consumeCost(userId, reserve, period);
  if (!allowed) throw new ServiceError('llm_over_budget', 429, 'LLM budget exceeded');

  let completion: ChatCompletion;
  try {
    completion = await retryWithBackoff(
      () => adapter.chat(messages, { ...resolvedOpts, model }),
      { shouldRetry: isTransientNon4xxError },
    );
  } catch (err) {
    // Refund the worst-case reservation so a transient adapter failure doesn't
    // permanently consume budget the caller never used.
    try { await recordDelta(userId, -reserve, period); } catch { /* best-effort */ }
    captureException(err, { service: 'llm', provider: adapter.name, model });
    captureEvent(EVENTS.llm_call, {
      provider: adapter.name,
      model,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const actual = actualCost(adapter, completion);
  const delta = actual - reserve;
  await recordDelta(userId, delta, period);

  captureEvent(EVENTS.llm_call, {
    provider: adapter.name,
    model: completion.model,
    tokens_in: completion.tokensIn,
    tokens_out: completion.tokensOut,
    cost: actual,
    status: 'ok',
  });

  return completion;
}

// ─── streamChat ────────────────────────────────────────────────────────────────

export function streamChat(messages: ChatMessage[], opts?: ChatOptions): AsyncIterable<string> {
  const adapter = resolveAdapter();
  const resolvedOpts: ChatOptions = opts ?? {};
  const model = resolvedOpts.model ?? gasConfig.llm.defaultChatModel ?? DEFAULT_CHAT_MODEL;
  return adapter.streamChat(messages, { ...resolvedOpts, model });
}

// ─── embed ─────────────────────────────────────────────────────────────────────

export async function embed(text: string | string[], opts?: { model?: string }): Promise<number[][]> {
  const adapter = resolveAdapter();
  const model = opts?.model ?? gasConfig.llm.defaultEmbedModel ?? DEFAULT_EMBED_MODEL;
  try {
    return await retryWithBackoff(
      () => adapter.embed(text, { model }),
      { shouldRetry: isTransientNon4xxError },
    );
  } catch (err) {
    captureException(err, { service: 'llm', provider: adapter.name, model, op: 'embed' });
    throw err;
  }
}

// ─── transcribe ────────────────────────────────────────────────────────────────

export async function transcribe(
  audio: Blob | ArrayBuffer,
  opts?: { model?: string; language?: string },
): Promise<string> {
  const adapter = resolveAdapter();
  const model = opts?.model ?? gasConfig.llm.defaultTranscribeModel ?? DEFAULT_TRANSCRIBE_MODEL;
  try {
    return await retryWithBackoff(
      () => adapter.transcribe(audio, { ...opts, model }),
      { shouldRetry: isTransientNon4xxError },
    );
  } catch (err) {
    captureException(err, { service: 'llm', provider: adapter.name, model, op: 'transcribe' });
    throw err;
  }
}
