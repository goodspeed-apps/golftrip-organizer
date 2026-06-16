/**
 * GAS Template — stripe-webhook Edge Function (Marketplace)
 *
 * Handles Stripe webhook events for marketplace transactions:
 * - payment_intent.succeeded: Update order to 'paid', mark listing as 'sold'
 * - charge.dispute.created: Update order to 'disputed'
 *
 * Requires: STRIPE_WEBHOOK_SECRET env var for signature verification.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';

/** Verify Stripe webhook signature (HMAC-SHA256). */
async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (isNaN(age) || age > 300) return false;

  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      return err('Webhook secret not configured', 500);
    }

    const body = await req.text();

    // Verify Stripe signature
    const signatureHeader = req.headers.get('stripe-signature');
    if (!signatureHeader) {
      return err('Missing stripe-signature header', 401);
    }

    const valid = await verifyStripeSignature(body, signatureHeader, webhookSecret);
    if (!valid) {
      return err('Invalid signature', 401);
    }

    const supabase = serviceClient();

    const event = JSON.parse(body);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const listingId = pi.metadata?.listing_id;

        if (listingId) {
          // Update order status
          await supabase
            .from('marketplace_orders')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent_id', pi.id);

          // Mark listing as sold
          await supabase
            .from('marketplace_listings')
            .update({ status: 'sold', updated_at: new Date().toISOString() })
            .eq('id', listingId);

          // Update transaction — match by marketplace_listing_id + user + type
          await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('type', 'marketplace_purchase')
            .eq('marketplace_listing_id', listingId)
            .eq('status', 'pending');
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        const paymentIntentId = dispute.payment_intent;

        if (paymentIntentId) {
          // Get the order to find the listing_id for transaction update
          const { data: order } = await supabase
            .from('marketplace_orders')
            .update({ status: 'disputed', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent_id', paymentIntentId)
            .select('listing_id')
            .single();

          if (order?.listing_id) {
            await supabase
              .from('transactions')
              .update({ status: 'disputed' })
              .eq('type', 'marketplace_purchase')
              .eq('marketplace_listing_id', order.listing_id);
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return json({ received: true });
  } catch (e) {
    return err(String(e), 500);
  }
});
