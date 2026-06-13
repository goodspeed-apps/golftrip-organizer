// supabase/functions/_shared/rate-limit.ts
// Token-bucket rate limit helper. Backed by the Postgres consume_rate_limit RPC.

import { serviceClient } from './edge-client.ts';

export interface RateLimitParams {
  scope: string;
  key: string;
  capacity: number;
  refillPerSecond: number;
  cost?: number;
}

export async function consumeRate(p: RateLimitParams): Promise<boolean> {
  const client = serviceClient();
  const { data, error } = await client.rpc('consume_rate_limit', {
    p_scope: p.scope,
    p_key: p.key,
    p_capacity: p.capacity,
    p_refill_per_second: p.refillPerSecond,
    p_cost: p.cost ?? 1,
  });
  if (error) throw error;
  return data === true;
}