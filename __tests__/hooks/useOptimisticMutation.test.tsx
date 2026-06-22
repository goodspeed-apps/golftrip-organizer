/**
 * Tests for hooks/useOptimisticMutation.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import {
  useOptimisticMutation,
} from '../../hooks/useOptimisticMutation';

type Item = { id: number; name: string };
type State = { items: Item[] };

const initial: State = { items: [{ id: 1, name: 'first' }] };

describe('useOptimisticMutation', () => {
  test('success: optimisticUpdate applied immediately, reconcile applied after resolve', async () => {
    // Defer resolution so the in-flight `pending` state is observable. An
    // immediately-resolved mock would settle inside the act() flush below,
    // flipping pending back to false before we can assert it.
    let resolveMutate!: (v: Item) => void;
    const mutate = jest.fn(
      () => new Promise<Item>(r => { resolveMutate = r; }),
    );

    const { result } = await renderHook(() =>
      useOptimisticMutation<Item, Item, State>({
        initial,
        mutate,
        optimisticUpdate: (state, args) => ({
          items: [...state.items, { ...args, name: args.name + '-optimistic' }],
        }),
        reconcile: (state, serverItem) => ({
          items: state.items.map(i => (i.id === serverItem.id ? serverItem : i)),
        }),
      }),
    );

    expect(result.current.state).toEqual(initial);

    let runPromise: Promise<Item>;
    await act(async () => {
      runPromise = result.current.run({ id: 2, name: 'second' });
    });

    expect(result.current.pending).toBe(true);
    expect(result.current.state.items).toHaveLength(2);
    expect(result.current.state.items[1].name).toBe('second-optimistic');

    await act(async () => {
      resolveMutate({ id: 2, name: 'second-confirmed' });
      await runPromise!;
    });

    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.state.items[1].name).toBe('second-confirmed');
  });

  test('error with rollback: rollback fn applied on failure', async () => {
    const err = new Error('network error');
    const mutate = jest.fn().mockRejectedValue(err);
    const rollback = jest.fn((state: State) => ({ items: [{ id: 99, name: 'rolled-back' }] }));

    const { result } = await renderHook(() =>
      useOptimisticMutation<Item, Item, State>({
        initial,
        mutate,
        optimisticUpdate: (state, args) => ({ items: [...state.items, args] }),
        rollback,
      }),
    );

    await act(async () => {
      await result.current.run({ id: 2, name: 'second' }).catch(() => {});
    });

    expect(rollback).toHaveBeenCalled();
    expect(result.current.state.items[0].name).toBe('rolled-back');
    expect(result.current.error).toBe(err);
    expect(result.current.pending).toBe(false);
  });

  test('error without rollback: state reverts to pre-update snapshot', async () => {
    const mutate = jest.fn().mockRejectedValue(new Error('fail'));

    const { result } = await renderHook(() =>
      useOptimisticMutation<Item, Item, State>({
        initial,
        mutate,
        optimisticUpdate: (state, args) => ({ items: [...state.items, args] }),
      }),
    );

    await act(async () => {
      await result.current.run({ id: 2, name: 'second' }).catch(() => {});
    });

    expect(result.current.state).toEqual(initial);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.pending).toBe(false);
  });

  test('reset() returns to initial and clears error/pending', async () => {
    const mutate = jest.fn().mockRejectedValue(new Error('fail'));

    const { result } = await renderHook(() =>
      useOptimisticMutation<Item, Item, State>({
        initial,
        mutate,
        optimisticUpdate: (state, args) => ({ items: [...state.items, args] }),
      }),
    );

    await act(async () => {
      await result.current.run({ id: 2, name: 'second' }).catch(() => {});
    });

    expect(result.current.error).not.toBeNull();

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.state).toEqual(initial);
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  test('concurrent call while pending rejects with "mutation in flight"', async () => {
    let resolve!: (v: Item) => void;
    const mutate = jest.fn(
      () => new Promise<Item>(r => { resolve = r; }),
    );

    const { result } = await renderHook(() =>
      useOptimisticMutation<Item, Item, State>({
        initial,
        mutate,
        optimisticUpdate: (state, args) => ({ items: [...state.items, args] }),
      }),
    );

    await act(async () => {
      result.current.run({ id: 2, name: 'second' });
    });

    expect(result.current.pending).toBe(true);

    await expect(
      result.current.run({ id: 3, name: 'third' }),
    ).rejects.toThrow('mutation in flight');

    await act(async () => {
      resolve({ id: 2, name: 'second' });
    });
  });
});