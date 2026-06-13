/**
 * GAS Template, useForm Hook
 *
 * Generic form state management with field-level validation.
 * Integrates with Zod schemas from lib/validation.ts.
 */

import { useState, useCallback, useRef } from 'react';
import { type ZodType, ZodError } from 'zod';

type Errors<T> = Partial<Record<keyof T, string>>;
type Touched<T> = Partial<Record<keyof T, boolean>>;

export interface UseFormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Errors<T>;
  touched: Touched<T>;
  isValid: boolean;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setTouched: (field: keyof T) => void;
  validate: () => Errors<T>;
  reset: () => void;
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => void;
}

export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  schema?: ZodType<T>,
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouchedState] = useState<Touched<T>>({});
  const initialRef = useRef(initialValues);

  const validate = useCallback((): Errors<T> => {
    if (!schema) return {};
    try {
      schema.parse(values);
      setErrors({});
      return {};
    } catch (err) {
      if (!(err instanceof ZodError)) throw err;
      const fieldErrors: Errors<T> = {};
      for (const issue of err.issues) {
        const field = issue.path[0] as keyof T;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return fieldErrors;
    }
  }, [values, schema]);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setTouched = useCallback((field: keyof T) => {
    setTouchedState(prev => ({ ...prev, [field]: true }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialRef.current);
    setErrors({});
    setTouchedState({});
  }, []);

  const handleSubmit = useCallback((onSubmit: (values: T) => void | Promise<void>) => {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(values);
    }
  }, [validate, values]);

  const isValid = Object.keys(errors).length === 0;

  return { values, errors, touched, isValid, setValue, setTouched, validate, reset, handleSubmit };
}
