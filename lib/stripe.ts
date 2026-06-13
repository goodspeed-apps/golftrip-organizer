/**
 * GAS Template, Stripe Integration (Marketplace)
 *
 * Conditional on gasConfig.features.inAppPurchases.marketplace?.enabled.
 * Uses @stripe/stripe-react-native for mobile payment sheets.
 * Web and non-marketplace apps: all functions are no-ops.
 *
 * Config: reads publishable key from gasConfig.backend.stripe.
 *
 * Dependencies: @stripe/stripe-react-native (optional peer dependency)
 */

import { isWeb } from './platform';
import { captureException, addBreadcrumb } from './sentry';
import { captureEvent } from './posthog';
import { gasConfig } from '../gas.config';

const MARKETPLACE_ENABLED = gasConfig.features.inAppPurchases.marketplace?.enabled ?? false;
const STRIPE_KEY = gasConfig.backend.stripe?.publishableKey ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StripeModule: any = null;

/**
 * Initialize Stripe SDK.
 * No-op if marketplace is disabled, the key is missing, or on web.
 */
export async function initStripe(): Promise<void> {
  if (isWeb || !MARKETPLACE_ENABLED || !STRIPE_KEY) return;
  try {
    StripeModule = require('@stripe/stripe-react-native');
    await StripeModule.initStripe({ publishableKey: STRIPE_KEY });
    addBreadcrumb('stripe', 'Stripe initialized');
    captureEvent('stripe_initialized');
  } catch (e) {
    captureException(e, { component: 'stripe', action: 'init' });
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Stripe] init error, @stripe/stripe-react-native may not be installed:', e);
    }
  }
}

/**
 * Present the Stripe payment sheet for a client secret obtained from edge function.
 * Returns error message if payment fails, undefined on success.
 */
export async function presentPaymentSheet(
  clientSecret: string,
): Promise<{ error?: string }> {
  if (!StripeModule) return { error: 'Stripe not initialized' };
  try {
    const { error: initError } = await StripeModule.initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: gasConfig.app.name,
    });
    if (initError) return { error: initError.message };

    const { error: presentError } = await StripeModule.presentPaymentSheet();
    if (presentError) return { error: presentError.message };

    addBreadcrumb('stripe', 'Payment completed');
    return {};
  } catch (e) {
    captureException(e, { component: 'stripe', action: 'presentPaymentSheet' });
    return { error: e instanceof Error ? e.message : 'Payment failed' };
  }
}

/**
 * Check if Stripe is ready for payments.
 */
export function isStripeReady(): boolean {
  return StripeModule !== null;
}
