/**
 * GAS Template, useCredits Hook
 *
 * Manages consumable credit balance with purchase and spend operations.
 * Config-gated: all operations are no-ops if credits are not enabled.
 *
 * - Balance fetched from Supabase `credit_balances` table on mount
 * - Purchase: buys consumable IAP via RevenueCat, validates server-side
 * - Spend: atomic server-side deduction via edge function
 *
 * Dependencies: lib/revenuecat, services/api, gas.config
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { purchaseProduct } from '@/lib/revenuecat';
import { callEdge } from '@/services/api';
import { captureEvent } from '@/lib/posthog';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { gasConfig } from '../gas.config';

const CREDITS_CONFIG = gasConfig.features.inAppPurchases.credits;
const CREDITS_ENABLED = CREDITS_CONFIG?.enabled ?? false;

export interface CreditState {
  balance: number;
  isLoading: boolean;
  error: string | null;
}

export interface CreditActions {
  /** Purchase a credit pack via RevenueCat (consumable IAP) */
  purchasePack: (packId: string) => Promise<void>;
  /** Spend credits on an action. Returns true if successful, false if insufficient. */
  spend: (amount: number, reason: string, referenceId?: string) => Promise<boolean>;
  /** Refresh balance from server */
  refresh: () => Promise<void>;
}

export function useCredits(): CreditState & CreditActions {
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(CREDITS_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!CREDITS_ENABLED) return;
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (isMounted.current) {
        setBalance((data as { balance: number } | null)?.balance ?? 0);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : 'Failed to load balance');
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchasePack = useCallback(async (packId: string) => {
    if (!CREDITS_ENABLED || !CREDITS_CONFIG) return;

    const pack = CREDITS_CONFIG.packs.find(p => p.id === packId);
    if (!pack) throw new Error(`Credit pack "${packId}" not found in config`);

    setIsLoading(true);
    setError(null);
    captureEvent('credit_pack_purchase_initiated', { packId, credits: pack.credits });

    try {
      // Purchase consumable via RevenueCat
      await purchaseProduct(pack.productId);

      // Validate server-side and credit balance
      const totalCredits = pack.credits + (pack.bonusCredits ?? 0);
      await callEdge('validate-purchase', {
        product_id: pack.productId,
        type: 'consumable',
        credits_amount: totalCredits,
      });

      await refresh();
      captureEvent('credit_pack_purchase_completed', { packId, credits: totalCredits });
      addBreadcrumb('credits', 'Pack purchased', { packId, credits: totalCredits });
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
      captureException(e, { component: 'useCredits', action: 'purchasePack' });
      throw e;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [refresh]);

  const spend = useCallback(async (
    amount: number,
    reason: string,
    referenceId?: string,
  ): Promise<boolean> => {
    if (!CREDITS_ENABLED) return true;

    captureEvent('credit_spend_initiated', { amount, reason });
    try {
      const result = await callEdge<{ success: boolean; new_balance: number }>('spend-credits', {
        amount,
        reason,
        reference_id: referenceId,
      });

      if (result.success) {
        if (isMounted.current) setBalance(result.new_balance);
        captureEvent('credit_spend_completed', { amount, reason, newBalance: result.new_balance });
        return true;
      }
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('insufficient')) {
        captureEvent('credit_spend_insufficient', { amount, reason, balance });
        return false;
      }
      captureException(e, { component: 'useCredits', action: 'spend' });
      throw e;
    }
  }, [balance]);

  return { balance, isLoading, error, purchasePack, spend, refresh };
}
