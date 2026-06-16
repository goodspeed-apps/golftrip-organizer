/**
 * GAS Template, Full-Text Search Service
 *
 * Calls the search_with_rank Postgres RPC and joins matched rows from the target table.
 */

import { supabase } from '../lib/supabase';
import { gasConfig } from '../gas.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult<T> {
  id: string;
  rank: number;
  snippet: string;
  row: T;
}

export interface SearchOptions {
  table: string;
  query: string;
  limit?: number;
  offset?: number;
  selectColumns?: string;
}

// ─── search ────────────────────────────────────────────────────────────────────

export async function search<T = Record<string, unknown>>(
  opts: SearchOptions,
): Promise<{ rows: SearchResult<T>[]; tookMs: number }> {
  const limit = opts.limit ?? gasConfig.search.defaultLimit;

  if (limit > gasConfig.search.maxLimit) {
    throw new Error(
      `limit ${limit} exceeds maxLimit ${gasConfig.search.maxLimit}`,
    );
  }

  const t0 = Date.now();
  const wantsAllColumns = !opts.selectColumns || opts.selectColumns === '*';

  // Fast path: single round-trip with to_jsonb() when caller wants all columns.
  if (wantsAllColumns) {
    const { data: rpcRows, error: rpcError } = await supabase.rpc('search_with_rank_jsonb', {
      p_table: opts.table,
      p_query: opts.query,
      p_limit: limit,
      p_offset: opts.offset ?? 0,
    });

    if (rpcError) throw new Error(rpcError.message);

    const joined = (rpcRows ?? []) as Array<{ id: string; rank: number; snippet: string; row: T }>;
    const rows: SearchResult<T>[] = joined.map((r) => ({
      id: r.id,
      rank: r.rank,
      snippet: r.snippet,
      row: r.row,
    }));
    return { rows, tookMs: Date.now() - t0 };
  }

  // Narrow-columns path: original two-step join.
  const { data: rpcRows, error: rpcError } = await supabase.rpc('search_with_rank', {
    p_table: opts.table,
    p_query: opts.query,
    p_limit: limit,
    p_offset: opts.offset ?? 0,
  });

  if (rpcError) throw new Error(rpcError.message);

  const ranked = (rpcRows ?? []) as Array<{ id: string; rank: number; snippet: string }>;

  if (ranked.length === 0) {
    return { rows: [], tookMs: Date.now() - t0 };
  }

  const ids = ranked.map((r) => r.id);

  const { data: tableRows, error: tableError } = await supabase
    .from(opts.table)
    .select(opts.selectColumns)
    .in('id', ids);

  if (tableError) throw new Error(tableError.message);

  const rowById = new Map<string, T>();
  for (const row of (tableRows ?? []) as unknown as Array<T & { id: string }>) {
    rowById.set(row.id, row);
  }

  const rows: SearchResult<T>[] = ranked
    .filter((r) => rowById.has(r.id))
    .map((r) => ({
      id: r.id,
      rank: r.rank,
      snippet: r.snippet,
      row: rowById.get(r.id) as T,
    }));

  return { rows, tookMs: Date.now() - t0 };
}

// ─── searchSuggestions ─────────────────────────────────────────────────────────

export async function searchSuggestions(
  table: string,
  prefix: string,
  limit = 5,
): Promise<string[]> {
  if (prefix.length < 2) return [];

  const { data, error } = await supabase
    .from(table)
    .select('searchable_text')
    .textSearch('tsv', `${prefix}:*`, { config: 'english' })
    .limit(limit);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const results: string[] = [];
  for (const row of (data ?? []) as Array<{ searchable_text: string }>) {
    if (!seen.has(row.searchable_text)) {
      seen.add(row.searchable_text);
      results.push(row.searchable_text);
    }
  }

  return results;
}