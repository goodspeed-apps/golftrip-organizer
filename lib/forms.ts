/**
 * GAS Template, Form Library
 *
 * Typed wrappers around react-hook-form + zod:
 * - useTypedForm: useForm with zodResolver, mode defaults to onBlur
 * - useFormServerError: read/set/clear root.serverError
 * - useAsyncFieldValidator: debounced async field validator
 *
 * Dependencies: react-hook-form, @hookform/resolvers/zod, zod
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, UseFormReturn, type FieldValues, type Resolver } from 'react-hook-form';
import { toNestErrors } from '@hookform/resolvers';
import type { z } from 'zod/v4';

// ─── zod v4 resolver ──────────────────────────────────────────────────────────
// @hookform/resolvers/zod checks error.errors (zod v3); zod v4 uses error.issues.
// This wrapper normalises the shape so RHF captures errors correctly.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodV4Resolver(schema: z.ZodType<any>): Resolver<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (values: any, _ctx: any, options: any) => {
    try {
      const data = await schema.parseAsync(values);
      return { values: data, errors: {} };
    } catch (err: unknown) {
      const zodErr = err as { issues?: Array<{ path: (string | number)[]; message: string; code: string }> };
      if (!zodErr?.issues) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flat: Record<string, any> = {};
      for (const issue of zodErr.issues) {
        const key = issue.path.join('.') || '_';
        if (!flat[key]) {
          flat[key] = { type: issue.code, message: issue.message };
        }
      }
      return { values: {}, errors: toNestErrors(flat, options) };
    }
  };
}

// ─── useTypedForm ─────────────────────────────────────────────────────────────

interface UseTypedFormOptions<TData extends FieldValues> {
  schema: z.ZodType<TData>;
  defaultValues?: Partial<TData>;
  mode?: 'onBlur' | 'onChange' | 'onSubmit';
}

/**
 * Typed wrapper around useForm with zodResolver.
 * Defaults mode to 'onBlur' so errors appear after the user leaves a field.
 */
export function useTypedForm<TData extends FieldValues>(
  opts: UseTypedFormOptions<TData>
): UseFormReturn<TData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useForm<TData>({
    resolver: zodV4Resolver(opts.schema as z.ZodType),
    defaultValues: opts.defaultValues as any,
    mode: opts.mode ?? 'onBlur',
  }) as UseFormReturn<TData>;
}

// ─── useFormServerError ───────────────────────────────────────────────────────

interface UseFormServerErrorReturn {
  serverError: string | null;
  setServerError: (msg: string | null) => void;
  clearServerError: () => void;
}

/**
 * Reads, sets, and clears a root.serverError on an RHF form.
 * Use setServerError in catch blocks to surface API-level failures.
 */
export function useFormServerError<T extends Record<string, unknown>>(
  form: UseFormReturn<T>
): UseFormServerErrorReturn {
  const raw = form.formState.errors.root?.serverError?.message;
  const serverError = raw != null ? String(raw) : null;

const setServerError = useCallback(
    (msg: string | null) => {
      if (msg == null) {
        form.clearErrors('root.serverError' as any);
      } else {
        form.setError('root.serverError' as any, { message: msg });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.setError, form.clearErrors]
  );

  const clearServerError = useCallback(() => {
    form.clearErrors('root.serverError' as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clearErrors]);

  return { serverError, setServerError, clearServerError };
}

// ─── useAsyncFieldValidator ───────────────────────────────────────────────────

interface UseAsyncFieldValidatorReturn {
  isValidating: boolean;
  error: string | null;
}

/**
 * Debounced async validator for a single field value.
 * Cancels in-flight checks when value changes before the check resolves.
 *
 * @param value       Current field value
 * @param asyncCheck  Returns null on valid, or an error string
 * @param debounceMs  Debounce delay in ms (default 500)
 */
export function useAsyncFieldValidator<T>(
  value: T,
  asyncCheck: (v: T) => Promise<string | null>,
  debounceMs = 500
): UseAsyncFieldValidatorReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref so the effect always sees the latest asyncCheck without re-running (I9)
  const asyncCheckRef = useRef(asyncCheck);
  asyncCheckRef.current = asyncCheck;

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsValidating(true);
      try {
        const result = await asyncCheckRef.current(value);
        if (!cancelled) {
          setError(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(null);
          console.warn('[useAsyncFieldValidator] async check threw:', err);
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, debounceMs]);

  return { isValidating, error };
}