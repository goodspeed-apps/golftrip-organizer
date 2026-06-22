/**
 * GAS Template, Validation Schemas
 *
 * Common Zod schemas for form validation across the template.
 * Provides a generic validate() helper that returns typed results.
 *
 * Dependencies: zod
 */

import { z, ZodSchema, ZodError } from 'zod';

// ─── Common Schemas ─────────────────────────────────────────────────────────

export const emailSchema = z.string().email('Invalid email address').trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const displayNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters')
  .trim();

export const feedbackSchema = z
  .string()
  .min(10, 'Feedback must be at least 10 characters')
  .max(1000, 'Feedback must be at most 1000 characters')
  .trim();

export const urlSchema = z.string().url('Invalid URL');

// ─── Validation Helper ──────────────────────────────────────────────────────

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validate data against a Zod schema.
 *
 * @returns { success: true, data } on success, { success: false, error } on failure.
 *   The error string is the first validation issue's message.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Validation failed' };
    }
    return { success: false, error: 'Validation failed' };
  }
}
