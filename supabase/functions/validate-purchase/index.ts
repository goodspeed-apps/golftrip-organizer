/**
 * GAS Template — validate-purchase Edge Function
 *
 * Server-side receipt validation for one-time and consumable IAP.
 * Called after RevenueCat purchaseProduct() succeeds on the client.
 *
 * For one-time purchases: inserts into user_products.
 * For consumable credits: credits balance via credit_balances + credit_ledger.
 * Creates a transaction record in all cases.
 *
 * Input: { user_id, product_id, type: 'one_time' | 'consumable', credits_amount?: number }
 * Output: { success: boolean, transaction_id: string }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { ZodError } from 'npm:zod';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { requireUserAuth } from '../_shared/edge-auth.ts';
import { ValidatePurchaseSchema } from '../_shared/schemas.ts';

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const auth = await requireUserAuth(req);
    if (auth instanceof Response) return auth;

    const supabase = serviceClient();

    let body: { product_id: string; type: 'one_time' | 'consumable'; credits_amount?: number };
    try {
      body = ValidatePurchaseSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof ZodError) return err('Invalid request body', 400, 'invalid_body');
      throw e;
    }
    const { product_id, type, credits_amount } = body;

    // TODO: Validate receipt with RevenueCat server API for production use.
    // See: https://www.revenuecat.com/docs/api-v1#tag/transactions

    if (type === 'one_time') {
      // Insert one-time product entitlement
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: auth.userId,
          type: 'one_time',
          status: 'completed',
          product_id,
        })
        .select('id')
        .single();

      if (txError || !tx) {
        throw new Error(`Failed to create transaction: ${txError?.message ?? 'unknown'}`);
      }

      await supabase.from('user_products').insert({
        user_id: auth.userId,
        product_id,
        transaction_id: tx.id,
      });

      return json({ success: true, transaction_id: tx.id });
    }

    if (type === 'consumable') {
      const amount = credits_amount ?? 0;
      if (amount <= 0) {
        return err('Invalid credits_amount', 400);
      }

      // Create transaction
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: auth.userId,
          type: 'credit_purchase',
          status: 'completed',
          product_id,
          credits_amount: amount,
        })
        .select('id')
        .single();

      if (txError || !tx) {
        throw new Error(`Failed to create transaction: ${txError?.message ?? 'unknown'}`);
      }

      // Upsert credit balance
      const { data: existing } = await supabase
        .from('credit_balances')
        .select('balance, lifetime_earned')
        .eq('user_id', auth.userId)
        .maybeSingle();

      const currentBalance = existing?.balance ?? 0;
      const currentEarned = existing?.lifetime_earned ?? 0;
      const newBalance = currentBalance + amount;

      await supabase.from('credit_balances').upsert({
        user_id: auth.userId,
        balance: newBalance,
        lifetime_earned: currentEarned + amount,
        updated_at: new Date().toISOString(),
      });

      // Ledger entry
      await supabase.from('credit_ledger').insert({
        user_id: auth.userId,
        amount,
        balance_after: newBalance,
        reason: 'pack_purchase',
        reference_id: tx.id,
      });

      return json({ success: true, transaction_id: tx.id, new_balance: newBalance });
    }

    return err('Invalid type', 400);
} catch (e) {
    return err(String(e), 500);
  }
});
