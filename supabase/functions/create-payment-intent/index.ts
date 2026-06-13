/**
 * GAS Template — create-payment-intent Edge Function (Marketplace)
 *
 * Creates a Stripe PaymentIntent for a marketplace purchase.
 * Calculates platform fee, creates a marketplace_order record.
 *
 * Requires: STRIPE_SECRET_KEY env var.
 *
 * Input: { listing_id }
 * Output: { client_secret: string, order_id: string }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { ZodError } from 'npm:zod';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { requireUserAuth } from '../_shared/edge-auth.ts';
import { consumeRate } from '../_shared/rate-limit.ts';
import { HttpError } from '../_shared/http-error.ts';
import { CreatePaymentIntentSchema } from '../_shared/schemas.ts';

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return err('Stripe not configured', 500);
    }

    const auth = await requireUserAuth(req);
    if (auth instanceof Response) return auth;

    // Rate-limit: gate BEFORE parsing/Stripe/DB work so abusive traffic is
    // dropped on the cheapest possible path. 10 burst, refills 0.1/sec
    // (approximately 6 successful intents per minute steady-state per user).
    const allowed = await consumeRate({
      scope: 'create-payment-intent',
      key: auth.userId,
      capacity: 10,
      refillPerSecond: 0.1,
    });
    if (!allowed) {
      return err('Too many requests', 429, 'rate_limited');
    }

    const supabase = serviceClient();

    let body: { listing_id: string };
    try {
      body = CreatePaymentIntentSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof ZodError) return err('Invalid request body', 400, 'invalid_body');
      throw e;
    }
    const { listing_id } = body;

    // Fetch listing
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listing_id)
      .eq('status', 'active')
      .single();

    if (listingError || !listing) {
      return err('Listing not found or not active', 404);
    }

    // Prevent self-purchase
    if (listing.seller_id === auth.userId) {
      return err('Cannot purchase your own listing', 400);
    }

    // Calculate fees (platform_fee_percent comes from app config, default 15%)
    const platformFeePercent = 15; // TODO: Read from app config or DB
    const platformFeeCents = Math.round(listing.price_cents * platformFeePercent / 100);
    const sellerPayoutCents = listing.price_cents - platformFeeCents;

    // Get seller's Stripe Connect account
    const { data: sellerProfile } = await supabase
      .from('seller_profiles')
      .select('stripe_account_id')
      .eq('user_id', listing.seller_id)
      .single();

    if (!sellerProfile?.stripe_account_id) {
      return err('Seller has not connected Stripe account', 400);
    }

    // Create Stripe PaymentIntent (Basic auth = base64("secret_key:"))
    const stripeAuth = btoa(`${stripeKey}:`);
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${stripeAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(listing.price_cents),
        currency: listing.currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        'transfer_data[destination]': sellerProfile.stripe_account_id,
        'transfer_data[amount]': String(sellerPayoutCents),
        'metadata[listing_id]': listing_id,
        'metadata[buyer_id]': auth.userId,
        'metadata[seller_id]': listing.seller_id,
      }),
    });

    const paymentIntent = await stripeResponse.json();
    if (paymentIntent.error) {
      throw new HttpError(402, paymentIntent.error.message);
    }

    // Create order record
    const { data: order } = await supabase
      .from('marketplace_orders')
      .insert({
        listing_id,
        buyer_id: auth.userId,
        seller_id: listing.seller_id,
        amount_cents: listing.price_cents,
        platform_fee_cents: platformFeeCents,
        seller_payout_cents: sellerPayoutCents,
        currency: listing.currency,
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
      })
      .select('id')
      .single();

    // Transaction record
    await supabase.from('transactions').insert({
      user_id: auth.userId,
      type: 'marketplace_purchase',
      status: 'pending',
      amount_cents: listing.price_cents,
      currency: listing.currency,
      marketplace_listing_id: listing_id,
      metadata: { order_id: order?.id, stripe_pi: paymentIntent.id },
    });

    return json({
      client_secret: paymentIntent.client_secret,
      order_id: order?.id,
    });
} catch (e) {
    if (e instanceof HttpError) {
      return err(e.message, e.status);
    }
    return err(String(e), 500);
  }
});
