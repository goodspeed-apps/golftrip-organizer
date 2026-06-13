/**
 * GAS Template — spend-credits Edge Function
 *
 * Atomically decrements a user's credit balance.
 * Uses SELECT FOR UPDATE to prevent race conditions on concurrent spends.
 *
 * Input: { amount, reason, reference_id? }
 * Output: { success: true, new_balance: number } or { error: 'insufficient_credits' }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { ZodError } from 'npm:zod';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { requireUserAuth } from '../_shared/edge-auth.ts';
import { consumeRate } from '../_shared/rate-limit.ts';
import { SpendCreditsSchema } from '../_shared/schemas.ts';

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const auth = await requireUserAuth(req);
    if (auth instanceof Response) return auth;

    // Rate-limit gate BEFORE parse/RPC: 10 burst, refills 0.1/sec per user.
    const allowed = await consumeRate({
      scope: 'spend-credits',
      key: auth.userId,
      capacity: 10,
      refillPerSecond: 0.1,
    });
    if (!allowed) {
      return err('Too many requests', 429, 'rate_limited');
    }

    const supabase = serviceClient();

    let body: { amount: number; reason: string; reference_id?: string };
    try {
      body = SpendCreditsSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof ZodError) return err('Invalid request body', 400, 'invalid_body');
      throw e;
    }
    const { amount, reason, reference_id } = body;

    // Atomic spend using RPC to avoid race conditions
    // The RPC function handles SELECT FOR UPDATE + balance check + update + ledger
    const { data, error } = await supabase.rpc('spend_credits', {
      p_user_id: auth.userId,
      p_amount: amount,
      p_reason: reason,
      p_reference_id: reference_id ?? null,
    });

    if (error) {
      // PL/pgSQL raises 'insufficient_credits' — Supabase wraps as P0001 (raise_exception)
      if (error.code === 'P0001' || error.message?.includes('insufficient_credits')) {
        return err('insufficient_credits', 400, 'insufficient_credits');
      }
      throw error;
    }

    return json({ success: true, new_balance: data });
  } catch (e) {
    return err(String(e), 500);
  }
});
