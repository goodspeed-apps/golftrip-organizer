/**
 * GAS Template, usePaywall Hook
 *
 * Feature gating by subscription tier with configurable rules.
 *
 * Features:
 * - Config-driven gating: define which features require which tier
 * - Generic `checkAccess` function that checks if user's tier meets requirement
 * - `checkUsageLimit` for metered features (e.g., N free views before paywall)
 * - Redirects to login if unauthenticated, paywall modal if on wrong tier
 * - Tier hierarchy derived from gasConfig.features.inAppPurchases.tiers order
 *
 * Unlike ThreadLift's hardcoded feature checks, this version is fully configurable:
 * pass a minimum required tier name, and the hook checks if the user's current
 * tier meets or exceeds that level based on the order in gasConfig.
 *
 * Extracted from ThreadLift, made generic and config-driven.
 *
 * Dependencies: @supabase/supabase-js, lib/supabase, expo-router, gas.config
 */

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { gasConfig } from '../gas.config';
import { addBreadcrumb } from '@/lib/sentry';

// --- Tier hierarchy from config ---
// Index in this array represents tier level: 0 = lowest (free), higher = better.
// This lets us do numeric comparison instead of hardcoded tier name checks.
const TIER_NAMES = gasConfig.features.inAppPurchases.tiers.map(t => t.name.toLowerCase());

/**
 * Get the numeric level of a tier name.
 * Returns 0 (lowest) if the tier is not found in config.
 */
function tierLevel(tierName: string | null): number {
  if (!tierName) return 0;
  const idx = TIER_NAMES.indexOf(tierName.toLowerCase());
  return idx >= 0 ? idx : 0;
}

/**
 * usePaywall, Feature gating hook.
 *
 * @returns {Object}
 *   - checkAccess: Check if user meets the minimum tier for a feature
 *   - checkUsageLimit: Check metered access (e.g., 5 free views)
 *   - getUser: Helper to get current authenticated user
 *   - getUserTier: Helper to get user's subscription tier from DB
 *
 * Usage:
 *   const { checkAccess, checkUsageLimit } = usePaywall();
 *
 *   // Gate a feature behind "pro" tier:
 *   const allowed = await checkAccess('pro');
 *   if (!allowed) return; // user was redirected to paywall
 *
 *   // Gate with usage limit (5 free views, then require 'pro'):
 *   const allowed = await checkUsageLimit(viewCount, 5, 'pro');
 */
export function usePaywall() {
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // --- Get current authenticated user ---
  const getUser = useCallback(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[usePaywall] getUser error:', error.message);
      return null;
    }
    return user;
  }, []);

  // --- Get user's subscription tier from Supabase ---
  const getUserTier = useCallback(async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    if (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[usePaywall] getUserTier error:', error.message);
      return null;
    }
    return (data as { subscription_tier: string | null } | null)?.subscription_tier ?? null;
  }, []);

  /**
   * checkAccess, Check if the user's tier meets the minimum required tier.
   *
   * @param requiredTier - Minimum tier name required (e.g., 'pro', 'lifetime')
   * @param redirectOnFail - Whether to redirect to paywall/login on failure (default: true)
   * @returns true if access granted, false if denied
   *
   * Behavior:
   * - If not authenticated: redirects to /(auth)/login
   * - If tier is below required: redirects to /(modal)/paywall
   * - If tier meets or exceeds required: returns true
   */
  const checkAccess = useCallback(async (
    requiredTier: string,
    redirectOnFail: boolean = true,
  ): Promise<boolean> => {
    const user = await getUser();
    if (!user) {
      if (redirectOnFail && isMounted.current) router.push('/(auth)/login');
      return false;
    }

    const currentTierName = await getUserTier(user.id);
    if (currentTierName === null) {
      addBreadcrumb('paywall', 'getUserTier returned null', { userId: user.id });
      if (redirectOnFail && isMounted.current) router.push('/(auth)/login');
      return false;
    }

    const currentLevel = tierLevel(currentTierName);
    const requiredLevel = tierLevel(requiredTier);

    if (currentLevel >= requiredLevel) return true;

    if (redirectOnFail && isMounted.current) router.push('/(modal)/paywall');
    return false;
  }, [getUser, getUserTier]);

  /**
   * checkUsageLimit, Metered access check for free-tier users.
   *
   * @param currentUsage - Current usage count (e.g., number of items viewed)
   * @param freeLimit - Maximum allowed for the free tier
   * @param requiredTier - Tier required to bypass the limit (default: second tier in config)
   * @returns true if within limit or on a sufficient tier, false if denied
   *
   * Usage:
   *   const allowed = await checkUsageLimit(viewIndex, 5, 'pro');
   */
  const checkUsageLimit = useCallback(async (
    currentUsage: number,
    freeLimit: number,
    requiredTier?: string,
  ): Promise<boolean> => {
    // Within free limit, always allowed
    if (currentUsage < freeLimit) return true;

    // Over limit, check tier
    const minTier = requiredTier ?? (TIER_NAMES[1] ?? 'pro');
    return checkAccess(minTier);
  }, [checkAccess]);

  /**
   * checkProductOwnership, Check if user owns a one-time product.
   *
   * @param productId - The product ID to check
   * @param redirectOnFail - Whether to redirect to paywall on failure (default: true)
   * @returns true if owned, false if not
   */
  const checkProductOwnership = useCallback(async (
    productId: string,
    redirectOnFail: boolean = true,
  ): Promise<boolean> => {
    const user = await getUser();
    if (!user) {
      if (redirectOnFail && isMounted.current) router.push('/(auth)/login');
      return false;
    }

    const { data } = await supabase
      .from('user_products')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (data) return true;

    if (redirectOnFail && isMounted.current) {
      router.push('/(modal)/paywall?tab=products');
    }
    return false;
  }, [getUser]);

  /**
   * checkCreditAccess, Check if user has enough credits for an action.
   *
   * @param requiredCredits - Number of credits needed
   * @param redirectOnFail - Whether to redirect to credit purchase on failure (default: true)
   * @returns true if sufficient credits, false if not
   */
  const checkCreditAccess = useCallback(async (
    requiredCredits: number,
    redirectOnFail: boolean = true,
  ): Promise<boolean> => {
    if (!gasConfig.features.inAppPurchases.credits?.enabled) return true;

    const user = await getUser();
    if (!user) {
      if (redirectOnFail && isMounted.current) router.push('/(auth)/login');
      return false;
    }

    const { data } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const balance = (data as { balance: number } | null)?.balance ?? 0;
    if (balance >= requiredCredits) return true;

    if (redirectOnFail && isMounted.current) {
      router.push('/(modal)/paywall?tab=credits');
    }
    return false;
  }, [getUser]);

  /**
   * Imperatively present the paywall modal. Generated screens commonly call
   * `showPaywall('some_context')` at a gate (e.g. a free-tier limit); the optional
   * context is passed through as a query param so the paywall can tailor its copy.
   */
  const showPaywall = useCallback((context?: string) => {
    if (!isMounted.current) return;
    router.push(context ? `/(modal)/paywall?context=${encodeURIComponent(context)}` : '/(modal)/paywall');
  }, []);

  return {
    checkAccess,
    checkUsageLimit,
    checkProductOwnership,
    checkCreditAccess,
    getUser,
    getUserTier,
    showPaywall,
  };
}
