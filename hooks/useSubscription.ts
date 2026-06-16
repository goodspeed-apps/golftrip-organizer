/**
 * GAS Template, useSubscription Hook
 *
 * Manages subscription state via RevenueCat offerings and a Supabase `profiles` table.
 *
 * Features:
 * - Reads tier definitions from gasConfig.features.inAppPurchases.tiers
 * - Dynamically derives tier type union from config tier names
 * - Fetches current subscription tier from Supabase `users.subscription_tier`
 * - Loads RevenueCat offerings for paywall display
 * - Purchase and restore flows with error handling
 * - Trial detection via trialEndsAt timestamp
 * - Convenience booleans: isPaid (any non-free tier), isLifetime
 *
 * Extracted from ThreadLift, made generic and config-driven.
 *
 * Dependencies: react-native-purchases (via lib/revenuecat), @supabase/supabase-js,
 *               lib/supabase, gas.config
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb, captureException } from '@/lib/sentry';
import { gasConfig } from '../gas.config';
import type { PurchasesOfferings } from 'react-native-purchases';

// --- ProfileRow type for Supabase query results ---
interface ProfileRow {
  subscription_tier: string | null;
  trial_ends_at: string | null;
}

// --- Lazy import of RevenueCat functions ---
// These are imported from lib/revenuecat which handles missing API keys gracefully.
import {
  getOfferings as getRevenueCatOfferings,
  purchasePackage as rcPurchasePackage,
  purchaseProduct as rcPurchaseProduct,
  restorePurchases as rcRestorePurchases,
  Purchases,
} from '@/lib/revenuecat';
import { callEdge } from '@/services/api';

// --- Config-driven tier names ---
// Build the tier names from gasConfig so they're not hardcoded.
// The first tier is assumed to be the free tier.
const TIERS = gasConfig.features.inAppPurchases.tiers;
const TIER_NAMES = TIERS.map(t => t.name.toLowerCase());
const FREE_TIER_NAME = TIER_NAMES[0] ?? 'free';

/**
 * SubscriptionTier, Dynamic type derived from gasConfig tier names.
 * Falls back to 'free' | 'pro' | 'lifetime' if no tiers are configured.
 */
export type SubscriptionTier = string;

export interface SubscriptionState {
  /** Current tier name (lowercase), e.g. 'free', 'pro', 'lifetime' */
  tier: SubscriptionTier;
  /** Whether the user is currently in a trial period */
  isTrialing: boolean;
  /** ISO timestamp when trial ends, or null */
  trialEndsAt: string | null;
  /** RevenueCat offerings for paywall display */
  offerings: PurchasesOfferings | null;
  /** True if on any paid tier (not the free tier) */
  isPaid: boolean;
  /** Alias of isPaid. Generated screens commonly read `isSubscribed`; keep both in sync. */
  isSubscribed: boolean;
  /** True if on the highest-level tier (last in the tiers array) */
  isLifetime: boolean;
  /** List of owned one-time product IDs */
  ownedProducts: string[];
  /** Loading state during refresh/purchase/restore */
  isLoading: boolean;
  /** Error message from the last failed operation, or null */
  error: string | null;
}

export interface SubscriptionActions {
  /** Purchase a RevenueCat package by identifier */
  purchase: (packageId: string) => Promise<void>;
  /** Purchase a one-time product by its store product ID */
  purchaseOneTime: (productId: string) => Promise<void>;
  /** Restore previous purchases via RevenueCat */
  restore: () => Promise<void>;
  /** Re-fetch subscription tier and offerings */
  refresh: () => Promise<void>;
}

/**
 * useSubscription, Subscription management hook.
 *
 * On mount, fetches the user's subscription_tier from the Supabase `profiles` table
 * and loads RevenueCat offerings. Provides purchase and restore actions.
 *
 * The tier check uses gasConfig tiers:
 * - First tier in the array = free tier
 * - Last tier in the array = lifetime/highest tier
 * - Any tier that isn't the first = paid
 */
export function useSubscription(): SubscriptionState & SubscriptionActions {
  const [tier, setTier] = useState<SubscriptionTier>(FREE_TIER_NAME);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [ownedProducts, setOwnedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The highest tier name (last in config array), used for isLifetime check
  const lifetimeTierName = useMemo(
    () => TIER_NAMES[TIER_NAMES.length - 1] ?? 'lifetime',
    []
  );

  // --- Refresh: fetch tier from DB + offerings from RevenueCat ---
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch subscription tier from Supabase profiles table
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier, trial_ends_at')
        .eq('id', user.id)
        .single();

      if (data) {
        const row = data as ProfileRow;
        const dbTier = (row.subscription_tier ?? FREE_TIER_NAME).toLowerCase();
        setTier(dbTier);
        setTrialEndsAt(row.trial_ends_at ?? null);
        captureEvent('subscription_check', { tier: dbTier.toLowerCase(), isPaid: dbTier.toLowerCase() !== FREE_TIER_NAME });
      }

      // Load RevenueCat offerings (returns null if no API key configured)
      if (gasConfig.features.inAppPurchases.enabled) {
        const o = await getRevenueCatOfferings();
        setOfferings(o);
      }

      // Load owned one-time products
      if (gasConfig.features.inAppPurchases.oneTimePurchases?.length) {
        const { data: products } = await supabase
          .from('user_products')
          .select('product_id')
          .eq('user_id', user.id);
        setOwnedProducts((products ?? []).map((p: { product_id: string }) => p.product_id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscription');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // --- RevenueCat customer info listener ---
  // Updates subscription state in real-time when purchases change externally
  // (e.g., subscription renewed, cancelled, or transferred from another device)
  useEffect(() => {
    if (!gasConfig.features.inAppPurchases.enabled || !Purchases) return;
    Purchases.addCustomerInfoUpdateListener(() => {
      refresh();
    });
  }, [refresh]);

  // --- Purchase guard against double-tap ---
  const purchaseInProgressRef = useRef(false);

  // --- Purchase a package ---
  const purchase = useCallback(async (packageId: string) => {
    if (purchaseInProgressRef.current) return;
    purchaseInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    captureEvent('purchase_initiated', { productId: packageId });
    try {
      // Validate package exists in current offerings
      const availablePackage = offerings?.current?.availablePackages?.find(
        p => p.identifier === packageId
      );
      if (!availablePackage) {
        const msg = `Package "${packageId}" not found in available offerings`;
        setError(msg);
        captureEvent('purchase_failed', { error: msg, productId: packageId });
        throw new Error(msg);
      }

      await rcPurchasePackage(packageId);
      await refresh();
      captureEvent('purchase_completed', { productId: packageId });
      addBreadcrumb('iap', 'Purchase completed', { productId: packageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
      captureEvent('purchase_failed', { error: String(e) });
      captureException(e, { component: 'useSubscription', action: 'purchase' });
      throw e;
    } finally {
      setIsLoading(false);
      purchaseInProgressRef.current = false;
    }
  }, [refresh, offerings]);

  // --- Purchase a one-time product ---
  const purchaseOneTime = useCallback(async (productId: string) => {
    if (purchaseInProgressRef.current) return;
    purchaseInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    captureEvent('one_time_purchase_initiated', { productId });
    try {
      await rcPurchaseProduct(productId);
      await callEdge('validate-purchase', {
        product_id: productId,
        type: 'one_time',
      });
      await refresh();
      captureEvent('one_time_purchase_completed', { productId });
      addBreadcrumb('iap', 'One-time purchase completed', { productId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
      captureEvent('one_time_purchase_failed', { error: String(e) });
      captureException(e, { component: 'useSubscription', action: 'purchaseOneTime' });
      throw e;
    } finally {
      setIsLoading(false);
      purchaseInProgressRef.current = false;
    }
  }, [refresh]);

  // --- Restore purchases ---
  const restore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await rcRestorePurchases();
      await refresh();
      captureEvent('restore_completed', { tier });
      addBreadcrumb('iap', 'Purchases restored');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
      captureException(e, { component: 'useSubscription', action: 'restore' });
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [refresh, tier]);

  // --- Derived state ---
  const now = new Date().toISOString();
  const isTrialing = trialEndsAt !== null && trialEndsAt > now;
  const isPaid = tier !== FREE_TIER_NAME;
  const isLifetime = tier === lifetimeTierName;

  return {
    tier,
    isTrialing,
    trialEndsAt,
    offerings,
    isPaid,
    isSubscribed: isPaid,
    isLifetime,
    ownedProducts,
    isLoading,
    error,
    purchase,
    purchaseOneTime,
    restore,
    refresh,
  };
}
