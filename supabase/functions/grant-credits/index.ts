/**
 * GAS Template — grant-credits Edge Function
 *
 * Grants credits to a user (signup bonus, promos, refunds).
 * Should be called from other edge functions or admin tooling,
 * not directly from the client.
 *
 * Input: { user_id, amount, reason }
 * Output: { success: true, new_balance: number }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { requireAdminJwt } from '../_shared/edge-auth.ts';

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const authResult = await requireAdminJwt(req);
    if (authResult instanceof Response) return authResult;

    const supabase = serviceClient();

    const { user_id, amount, reason } = await req.json();

    if (!user_id || !amount || amount <= 0 || !reason) {
      return err('Missing user_id, amount, or reason', 400);
    }

    // Upsert credit balance
    const { data: existing } = await supabase
      .from('credit_balances')
      .select('balance, lifetime_earned')
      .eq('user_id', user_id)
      .maybeSingle();

    const currentBalance = existing?.balance ?? 0;
    const currentEarned = existing?.lifetime_earned ?? 0;
    const newBalance = currentBalance + amount;

    await supabase.from('credit_balances').upsert({
      user_id,
      balance: newBalance,
      lifetime_earned: currentEarned + amount,
      updated_at: new Date().toISOString(),
    });

    // Ledger entry
    await supabase.from('credit_ledger').insert({
      user_id,
      amount,
      balance_after: newBalance,
      reason,
    });

    // Transaction record
    await supabase.from('transactions').insert({
      user_id,
      type: 'credit_grant',
      status: 'completed',
      credits_amount: amount,
      metadata: { reason },
    });

    return json({ success: true, new_balance: newBalance });
  } catch (e) {
    return err(String(e), 500);
  }
});
