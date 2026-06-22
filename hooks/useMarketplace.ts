/**
 * GAS Template, useMarketplace Hook
 *
 * Manages marketplace transactions via Stripe Connect.
 * Config-gated: all operations are no-ops if marketplace is not enabled.
 *
 * - Create/manage seller listings (direct Supabase CRUD)
 * - Purchase listings via Stripe (edge function creates PaymentIntent)
 * - Track orders for both buyers and sellers
 *
 * Apple/Google allow external payment for physical goods, services,
 * and P2P transactions, Stripe Connect is the industry standard.
 *
 * Dependencies: lib/stripe, services/api, gas.config
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { initStripe, presentPaymentSheet, isStripeReady } from '@/lib/stripe';
import { callEdge } from '@/services/api';
import { captureEvent } from '@/lib/posthog';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { gasConfig } from '../gas.config';
import type { MarketplaceListing, MarketplaceOrder } from '../types';

const MARKETPLACE_CONFIG = gasConfig.features.inAppPurchases.marketplace;
const MARKETPLACE_ENABLED = MARKETPLACE_CONFIG?.enabled ?? false;

export interface MarketplaceState {
  stripeReady: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface MarketplaceActions {
  /** Create a new listing */
  createListing: (listing: {
    title: string;
    description: string;
    category: string;
    price_cents: number;
    currency?: string;
    images?: string[];
    metadata?: Record<string, unknown>;
  }) => Promise<string>;
  /** Purchase a listing (creates Stripe PaymentIntent, presents payment sheet) */
  purchaseListing: (listingId: string) => Promise<void>;
  /** Confirm delivery (buyer acknowledges receipt, releases escrow) */
  confirmDelivery: (orderId: string) => Promise<void>;
  /** Fetch user's listings (as seller) */
  getMyListings: () => Promise<MarketplaceListing[]>;
  /** Fetch user's orders (as buyer) */
  getMyOrders: () => Promise<MarketplaceOrder[]>;
}

export function useMarketplace(): MarketplaceState & MarketplaceActions {
  const [stripeReady, setStripeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Initialize Stripe on mount
  useEffect(() => {
    if (!MARKETPLACE_ENABLED) return;
    initStripe().then(() => {
      if (isMounted.current) setStripeReady(isStripeReady());
    });
  }, []);

  const createListing = useCallback(async (listing: {
    title: string;
    description: string;
    category: string;
    price_cents: number;
    currency?: string;
    images?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<string> => {
    if (!MARKETPLACE_ENABLED) throw new Error('Marketplace not enabled');

    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const status = MARKETPLACE_CONFIG?.requiresApproval ? 'pending_approval' : 'active';

      const { data, error: insertError } = await supabase
        .from('marketplace_listings')
        .insert({
          seller_id: user.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price_cents: listing.price_cents,
          currency: listing.currency ?? 'USD',
          status,
          images: listing.images ?? [],
          metadata: listing.metadata ?? {},
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      captureEvent('marketplace_listing_created', { listingId: data.id, status });
      addBreadcrumb('marketplace', 'Listing created', { listingId: data.id });
      return data.id;
    } catch (e) {
      if (isMounted.current) setError(e instanceof Error ? e.message : 'Failed to create listing');
      captureException(e, { component: 'useMarketplace', action: 'createListing' });
      throw e;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  const purchaseListing = useCallback(async (listingId: string): Promise<void> => {
    if (!MARKETPLACE_ENABLED) throw new Error('Marketplace not enabled');

    setIsLoading(true);
    setError(null);
    captureEvent('marketplace_purchase_initiated', { listingId });

    try {
      // Create PaymentIntent via edge function
      const { client_secret, order_id } = await callEdge<{
        client_secret: string;
        order_id: string;
      }>('create-payment-intent', { listing_id: listingId });

      // Present Stripe payment sheet
      const result = await presentPaymentSheet(client_secret);
      if (result.error) {
        throw new Error(result.error);
      }

      captureEvent('marketplace_purchase_completed', { listingId, orderId: order_id });
      addBreadcrumb('marketplace', 'Purchase completed', { listingId, orderId: order_id });
    } catch (e) {
      if (isMounted.current) setError(e instanceof Error ? e.message : 'Purchase failed');
      captureException(e, { component: 'useMarketplace', action: 'purchaseListing' });
      throw e;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  const confirmDelivery = useCallback(async (orderId: string): Promise<void> => {
    if (!MARKETPLACE_ENABLED) return;

    try {
      const { error: updateError } = await supabase
        .from('marketplace_orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateError) throw updateError;

      captureEvent('marketplace_delivery_confirmed', { orderId });
    } catch (e) {
      captureException(e, { component: 'useMarketplace', action: 'confirmDelivery' });
      throw e;
    }
  }, []);

  const getMyListings = useCallback(async (): Promise<MarketplaceListing[]> => {
    if (!MARKETPLACE_ENABLED) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error: queryError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;
    return (data ?? []) as MarketplaceListing[];
  }, []);

  const getMyOrders = useCallback(async (): Promise<MarketplaceOrder[]> => {
    if (!MARKETPLACE_ENABLED) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error: queryError } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;
    return (data ?? []) as MarketplaceOrder[];
  }, []);

  return {
    stripeReady,
    isLoading,
    error,
    createListing,
    purchaseListing,
    confirmDelivery,
    getMyListings,
    getMyOrders,
  };
}
