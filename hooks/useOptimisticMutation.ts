/**
 * GAS Template, useOptimisticMutation
 *
 * Optimistic mutation primitive with rollback and optional reconcile.
 * Applies an optimistic state update immediately, then reconciles or
 * reverts based on the async mutation result.
 *
 * Concurrency: concurrent calls while a mutation is in flight are
 * rejected with Error('mutation in flight'). Callers must await the
 * previous run() or check pending before calling again.
 */

import { useState, useRef, useCallback } from 'react';

export interface UseOptimisticMutationOpts<TArgs, TResult, TState> {
  mutate: (args: TArgs) => Promise<TResult>;
  optimisticUpdate: (state: TState, args: TArgs) => TState;
  rollback?: (state: TState, args: TArgs, error: unknown) => TState;
  reconcile?: (state: TState, result: TResult, args: TArgs) => TState;
  initial: TState;
}

export interface UseOptimisticMutationReturn<TArgs, TResult, TState> {
  state: TState;
  run: (args: TArgs) => Promise<TResult>;
  error: unknown | null;
  pending: boolean;
  reset: () => void;
}

export function useOptimisticMutation<TArgs, TResult, TState>(
  opts: UseOptimisticMutationOpts<TArgs, TResult, TState>,
): UseOptimisticMutationReturn<TArgs, TResult, TState> {
  const [state, setState] = useState<TState>(opts.initial);
  const [error, setError] = useState<unknown | null>(null);
  const [pending, setPending] = useState(false);

  const pendingRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback(async (args: TArgs): Promise<TResult> => {
    if (pendingRef.current) {
      return Promise.reject(new Error('mutation in flight'));
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);

    let snapshot: TState;
    setState(prev => {
      snapshot = prev;
      return optsRef.current.optimisticUpdate(prev, args);
    });

    try {
      const result = await optsRef.current.mutate(args);
      setState(current => {
        if (optsRef.current.reconcile) {
          return optsRef.current.reconcile(current, result, args);
        }
        return current;
      });
      pendingRef.current = false;
      setPending(false);
      return result;
    } catch (err) {
      setState(current => {
        if (optsRef.current.rollback) {
          return optsRef.current.rollback(current, args, err);
        }
        return snapshot!;
      });
      pendingRef.current = false;
      setPending(false);
      setError(err);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = false;
    setPending(false);
    setError(null);
    setState(optsRef.current.initial);
  }, []);

  return { state, run, error, pending, reset };
}