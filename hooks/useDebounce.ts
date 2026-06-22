/**
 * GAS Template, useDebounce Hook
 *
 * Generic debounce hook for delaying value updates.
 *
 * Features:
 * - Debounces any value by a configurable delay (default: 300ms)
 * - Cleans up timeout on unmount or when value/delay changes
 * - Used by useSearch and available for any other debounced input scenarios
 *
 * This is a standard React pattern, no app-specific dependencies.
 *
 * Dependencies: none (React only)
 */

import { useState, useEffect } from 'react';

/**
 * useDebounce, Delays updating a value until after a specified period of inactivity.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns The debounced value (updates only after `delay` ms of no changes)
 *
 * Usage:
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) fetchResults(debouncedQuery);
 *   }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
