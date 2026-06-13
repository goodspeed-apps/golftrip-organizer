jest.mock('../../lib/supabase', () => {
  const rpc = jest.fn();
  const from = jest.fn();
  return {
    __helpers: { rpc, from },
    supabase: { rpc, from },
  };
});

import { search, searchSuggestions } from '../../services/search';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMod = require('../../lib/supabase');
const helpers = supabaseMod.__helpers;

// Chainable from() mock builder
function makeFromChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: Record<string, jest.Mock> = {};
  const self = () => chain;
  chain.select = jest.fn(self);
  chain.in = jest.fn(self);
  chain.textSearch = jest.fn(self);
  chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
  Object.assign(chain, overrides);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('search()', () => {
  it('uses search_with_rank_jsonb fast path when selectColumns is unset', async () => {
    const rpcData = [
      { id: 'aa', rank: 0.9, snippet: 'foo bar', row: { id: 'aa', name: 'Item A' } },
      { id: 'bb', rank: 0.5, snippet: 'baz', row: { id: 'bb', name: 'Item B' } },
    ];
    helpers.rpc.mockResolvedValueOnce({ data: rpcData, error: null });

    const result = await search({ table: 'items', query: 'foo' });

    expect(helpers.rpc).toHaveBeenCalledWith('search_with_rank_jsonb', {
      p_table: 'items',
      p_query: 'foo',
      p_limit: 20,
      p_offset: 0,
    });
    expect(helpers.from).not.toHaveBeenCalled();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ id: 'aa', rank: 0.9, snippet: 'foo bar', row: { id: 'aa', name: 'Item A' } });
    expect(typeof result.tookMs).toBe('number');
  });

  it('uses the two-step search_with_rank path when selectColumns is set', async () => {
    const rpcData = [
      { id: 'aa', rank: 0.9, snippet: 'foo bar' },
      { id: 'bb', rank: 0.5, snippet: 'baz' },
    ];
    helpers.rpc.mockResolvedValueOnce({ data: rpcData, error: null });

    const tableRows = [
      { id: 'bb', name: 'Item B' },
      { id: 'aa', name: 'Item A' },
    ];
    const chain = makeFromChain({
      in: jest.fn().mockResolvedValue({ data: tableRows, error: null }),
    });
    chain.select = jest.fn(() => chain);
    helpers.from.mockReturnValueOnce(chain);

    const result = await search({ table: 'items', query: 'foo', selectColumns: 'id,name' });

    expect(helpers.rpc).toHaveBeenCalledWith('search_with_rank', {
      p_table: 'items',
      p_query: 'foo',
      p_limit: 20,
      p_offset: 0,
    });
    expect(chain.select).toHaveBeenCalledWith('id,name');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].id).toBe('aa');
  });

  it('rejects when limit exceeds maxLimit', async () => {
    await expect(
      search({ table: 'items', query: 'x', limit: 9999 }),
    ).rejects.toThrow('maxLimit');
  });

  it('returns empty rows when RPC returns empty (fast path)', async () => {
    helpers.rpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await search({ table: 'items', query: 'nothing' });

    expect(result.rows).toEqual([]);
    expect(helpers.from).not.toHaveBeenCalled();
  });

  it('throws when RPC returns an error', async () => {
    helpers.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    await expect(search({ table: 'items', query: 'bad' })).rejects.toThrow('rpc failed');
  });
});

describe('searchSuggestions()', () => {
  it('returns deduplicated prefix matches', async () => {
    const chain = makeFromChain({
      limit: jest.fn().mockResolvedValue({
        data: [
          { searchable_text: 'hello world' },
          { searchable_text: 'hello there' },
          { searchable_text: 'hello world' },
        ],
        error: null,
      }),
    });
    chain.select = jest.fn(() => chain);
    chain.textSearch = jest.fn(() => chain);
    helpers.from.mockReturnValueOnce(chain);

    const results = await searchSuggestions('items', 'hello');

    expect(results).toEqual(['hello world', 'hello there']);
    expect(chain.textSearch).toHaveBeenCalledWith('tsv', 'hello:*', { config: 'english' });
  });

  it('returns [] for prefix shorter than 2 chars', async () => {
    const results = await searchSuggestions('items', 'h');
    expect(results).toEqual([]);
    expect(helpers.from).not.toHaveBeenCalled();
  });

  it('returns [] for empty prefix', async () => {
    const results = await searchSuggestions('items', '');
    expect(results).toEqual([]);
    expect(helpers.from).not.toHaveBeenCalled();
  });
});