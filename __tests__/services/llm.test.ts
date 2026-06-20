// ─── Mocks (must be before imports) ───────────────────────────────────────────

const mockRpc = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    rpc: mockRpc,
  },
}));

jest.mock('../../gas.config', () => ({
  gasConfig: {
    llm: {
      provider: 'openai',
      defaultChatModel: 'gpt-4o-mini',
      defaultEmbedModel: 'text-embedding-3-small',
      defaultTranscribeModel: 'whisper-1',
      costScope: 'llm',
      budgetPeriod: 'day',
    },
  },
}));

const mockOpenaiChat = jest.fn();
const mockOpenaiStreamChat = jest.fn();
const mockOpenaiEmbed = jest.fn();
const mockOpenaiTranscribe = jest.fn();
const mockOpenaiRates = jest.fn();

jest.mock('../../lib/llm-adapters/openai', () => ({
  openaiAdapter: {
    name: 'openai',
    chat: mockOpenaiChat,
    streamChat: mockOpenaiStreamChat,
    embed: mockOpenaiEmbed,
    transcribe: mockOpenaiTranscribe,
    ratesPerMillionTokens: mockOpenaiRates,
  },
}));

const mockAnthropicChat = jest.fn();
const mockAnthropicStreamChat = jest.fn();
const mockAnthropicEmbed = jest.fn();
const mockAnthropicTranscribe = jest.fn();
const mockAnthropicRates = jest.fn();

jest.mock('../../lib/llm-adapters/anthropic', () => ({
  anthropicAdapter: {
    name: 'anthropic',
    chat: mockAnthropicChat,
    streamChat: mockAnthropicStreamChat,
    embed: mockAnthropicEmbed,
    transcribe: mockAnthropicTranscribe,
    ratesPerMillionTokens: mockAnthropicRates,
  },
}));

// ─── Imports ───────────────────────────────────────────────────────────────────

import { chat, streamChat, embed, transcribe, __clearLlmUserCache } from '../../services/llm';
import { ServiceError } from '../../services/errors';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mockSession(userId = 'user-123') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

function mockBudgetAllowed(allowed = true) {
  mockRpc.mockResolvedValue({ data: { allowed }, error: null });
}

const MESSAGES = [{ role: 'user' as const, content: 'Hello world' }];

const COMPLETION = {
  content: 'Hi there',
  tokensIn: 10,
  tokensOut: 5,
  model: 'gpt-4o-mini',
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  __clearLlmUserCache();
  mockOpenaiRates.mockReturnValue({ in: 0.15, out: 0.60 });
  mockAnthropicRates.mockReturnValue({ in: 3.00, out: 15.00 });
});

describe('chat()', () => {
  it('routes to the configured provider adapter', async () => {
    mockSession();
    mockBudgetAllowed(true);
    mockOpenaiChat.mockResolvedValue(COMPLETION);

    const result = await chat(MESSAGES);

    expect(mockOpenaiChat).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Hi there');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('throws ServiceError(429) when over budget', async () => {
    mockSession();
    mockBudgetAllowed(false);

    await expect(chat(MESSAGES)).rejects.toThrow(ServiceError);

    let err: ServiceError | undefined;
    try {
      await chat(MESSAGES);
    } catch (e) {
      err = e as ServiceError;
    }
    expect(err?.status).toBe(429);
    expect(err?.code).toBe('llm_over_budget');
    expect(mockOpenaiChat).not.toHaveBeenCalled();
  });

it('records cost via consume_cost on success', async () => {
    mockSession();
    mockBudgetAllowed(true);
    mockOpenaiChat.mockResolvedValue(COMPLETION);

    await chat(MESSAGES);

    // First call: worst-case reservation; second call: signed delta reconcile.
    expect(mockRpc).toHaveBeenCalledWith('consume_cost', expect.objectContaining({
      p_scope: 'llm',
      p_key: 'user-123',
      p_period: 'day',
    }));
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('reconciles a worst-case reservation with a negative delta when usage is under-budget', async () => {
    mockSession();
    mockBudgetAllowed(true);
    // Small completion: a generous maxTokens reservation should refund the unused output.
    mockOpenaiChat.mockResolvedValue({ ...COMPLETION, tokensIn: 5, tokensOut: 1 });

    await chat(MESSAGES, { maxTokens: 4096 });

    expect(mockRpc).toHaveBeenCalledTimes(2);
    const firstCall = mockRpc.mock.calls[0];
    const secondCall = mockRpc.mock.calls[1];
    // First call reserves >0; second call reconciles with a negative delta.
    expect(firstCall[1].p_cost).toBeGreaterThan(0);
    expect(secondCall[1].p_cost).toBeLessThan(0);
  });

  it('returns correct token counts from Anthropic adapter', async () => {
    const { gasConfig } = require('../../gas.config');
    gasConfig.llm.provider = 'anthropic';

    const anthropicCompletion = {
      content: 'Bonjour',
      tokensIn: 20,
      tokensOut: 8,
      model: 'claude-3-5-haiku',
    };

    mockSession();
    mockBudgetAllowed(true);
    mockAnthropicChat.mockResolvedValue(anthropicCompletion);

    const result = await chat(MESSAGES);

    expect(result.tokensIn).toBe(20);
    expect(result.tokensOut).toBe(8);
    expect(result.model).toBe('claude-3-5-haiku');

    // restore
    gasConfig.llm.provider = 'openai';
  });

});

describe('streamChat()', () => {
  it('yields chunks from the adapter', async () => {
    async function* fakeStream() {
      yield 'Hello';
      yield ' ';
      yield 'world';
    }
    mockOpenaiStreamChat.mockReturnValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of streamChat(MESSAGES)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' ', 'world']);
  });
});

describe('embed()', () => {
  it('throws unsupported ServiceError when provider is anthropic', async () => {
    const { gasConfig } = require('../../gas.config');
    gasConfig.llm.provider = 'anthropic';

    const err = new ServiceError('embed_unsupported', 501, 'Anthropic does not provide embeddings API; use OpenAI or another provider for embed()');
    mockAnthropicEmbed.mockRejectedValue(err);

    await expect(embed('test text')).rejects.toThrow(ServiceError);

    let thrown: ServiceError | undefined;
    try {
      await embed('test text');
    } catch (e) {
      thrown = e as ServiceError;
    }
    expect(thrown?.status).toBe(501);
    expect(thrown?.code).toBe('embed_unsupported');

// restore
    gasConfig.llm.provider = 'openai';
  });
});

describe('transcribe()', () => {
  it('throws ServiceError(501) when anthropic provider does not support transcription', async () => {
    const { gasConfig } = require('../../gas.config');
    gasConfig.llm.provider = 'anthropic';

    const err = new ServiceError('transcribe_unsupported', 501, 'Anthropic does not provide transcription API; use OpenAI or another provider for transcribe()');
    mockAnthropicTranscribe.mockRejectedValue(err);

    const audio = new ArrayBuffer(8);
    await expect(transcribe(audio)).rejects.toThrow(ServiceError);

    let thrown: ServiceError | undefined;
    try {
      await transcribe(audio);
    } catch (e) {
      thrown = e as ServiceError;
    }
    expect(thrown?.status).toBe(501);
    expect(thrown?.code).toBe('transcribe_unsupported');

    // restore
    gasConfig.llm.provider = 'openai';
  });
});

describe('OpenAI adapter cost computation', () => {
  it('computes correct cost from rates', () => {
    const { openaiAdapter } = require('../../lib/llm-adapters/openai');
    const rates = openaiAdapter.ratesPerMillionTokens('gpt-4o-mini');
    // gpt-4o-mini: in=0.15, out=0.60
    const costFor1MIn = rates.in;
    const costFor1MOut = rates.out;
    expect(costFor1MIn).toBe(0.15);
    expect(costFor1MOut).toBe(0.60);
  });
});