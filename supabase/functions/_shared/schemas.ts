// supabase/functions/_shared/schemas.ts
// Zod request-body schemas for Edge Functions that accept user input.
//
// Each function imports its schema and calls `.parse()` on the JSON body
// immediately after auth + rate-limit gates. On `ZodError`, the function
// returns a 400 with a generic message (no schema details leaked to clients).

import { z } from 'npm:zod';

/** Body for create-payment-intent: buyer specifies the listing they want to buy. */
export const CreatePaymentIntentSchema = z.object({
  listing_id: z.string().uuid(),
});
export type CreatePaymentIntentBody = z.infer<typeof CreatePaymentIntentSchema>;

/** Body for spend-credits: user spends `amount` credits for `reason`. */
export const SpendCreditsSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(200),
  reference_id: z.string().uuid().optional(),
});
export type SpendCreditsBody = z.infer<typeof SpendCreditsSchema>;

/**
 * Body for validate-purchase: server-side receipt validation.
 * `credits_amount` is required and positive when `type === 'consumable'`.
 */
export const ValidatePurchaseSchema = z
  .object({
    product_id: z.string().min(1).max(200),
    type: z.enum(['one_time', 'consumable']),
    credits_amount: z.number().int().positive().optional(),
  })
  .refine(
    (v) => v.type !== 'consumable' || (typeof v.credits_amount === 'number' && v.credits_amount > 0),
    { message: 'credits_amount required for consumable', path: ['credits_amount'] },
  );
export type ValidatePurchaseBody = z.infer<typeof ValidatePurchaseSchema>;
