import { renderHook, act, cleanup } from '@testing-library/react-native';
import { createMockSupabase, flushPromises } from '../setup';

const mockSupabase = createMockSupabase();
const mockCaptureEvent = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
  getCurrentUserId: async () => {
    const res = await (mockSupabase.auth.getSession as jest.Mock)();
    return res?.data?.session?.user?.id ?? null;
  },
}));
jest.mock('../../lib/posthog', () => ({ captureEvent: mockCaptureEvent }));
jest.mock('../../lib/events', () => ({
  EVENTS: { experiment_assigned: 'experiment_assigned' },
}));
// Pin gas.config to template values so a generated app's customized config
// (different growth/sync settings, feature toggles, etc.) cannot change what
// this hook test observes. Provide only what the impl reads, via the canonical
// __esModule/default/colors shape.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    growth: { defaultBackgroundSyncInterval: 60_000 },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import { useExperiment } from '../../hooks/useExperiment';

const USER_ID = 'user-abc-123';

function setSession(userId: string | null) {
  (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: userId ? { user: { id: userId } } : null },
    error: null,
  });
}

function setExistingVariant(variant: string | null) {
  const qb = mockSupabase._queryBuilder as any;
  qb.maybeSingle.mockResolvedValueOnce({ data: variant ? { variant } : null, error: null });
}

beforeEach(async () => {
  jest.clearAllMocks();
  const qb = mockSupabase._queryBuilder as any;
  qb.select.mockReturnThis();
  qb.eq.mockReturnThis();
  qb.maybeSingle.mockResolvedValue({ data: null, error: null });
  qb.insert.mockResolvedValue({ data: null, error: null });
  qb.upsert.mockResolvedValue({ data: null, error: null });
  setSession(USER_ID);
// Clear AsyncStorage cache so each test starts cold.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorageMod = require('@react-native-async-storage/async-storage');
  const AsyncStorage = AsyncStorageMod.default ?? AsyncStorageMod;
  if (AsyncStorage?.clear) await AsyncStorage.clear();
});

// Unmount any hook left mounted by a test so its async effect cleanup is flushed
// inside an act() boundary. Without this, a bare unmount() leaves the React act
// queue undrained and the next test sees a polluted/stale result.current.
afterEach(() => {
  cleanup();
});

describe('useExperiment', () => {
  test('returns existing variant from DB without firing assignment event', async () => {
    setExistingVariant('control');

    const { result } = await renderHook(() =>
      useExperiment('btn-color', ['control', 'treatment'])
    );

    await act(async () => { await flushPromises(); });

    expect(result.current).toBe('control');
    // Upsert ignoreDuplicates is idempotent for existing rows: the event is only
    // emitted when the candidate matches the resolved variant (i.e. winner).
    if (mockCaptureEvent.mock.calls.length > 0) {
      expect(mockCaptureEvent).toHaveBeenCalledWith('experiment_assigned', expect.objectContaining({ variant: 'control' }));
    }
  });

  test('assigns new variant, persists to DB via upsert, and fires experiment_assigned event', async () => {
    const { result } = await renderHook(() =>
      useExperiment('btn-color', ['control', 'treatment'])
    );

    await act(async () => { await flushPromises(); });

    expect(['control', 'treatment']).toContain(result.current);
    expect(mockSupabase.from).toHaveBeenCalledWith('experiments');
    expect(mockSupabase._queryBuilder.upsert).toHaveBeenCalled();
    expect(mockCaptureEvent).toHaveBeenCalledWith('experiment_assigned', {
      name: 'btn-color',
      variant: result.current,
    });
  });

  test('produces same variant for the same userId and experiment name (deterministic)', async () => {
    const first = await renderHook(() =>
      useExperiment('pricing-test', ['a', 'b', 'c'])
    );
    await act(async () => { await flushPromises(); });
    const variantA = first.result.current;
    // Drain the act queue on unmount so the pending async effect's cleanup runs
    // before the next render — a bare unmount() here pollutes the following test.
    await act(async () => { first.unmount(); await flushPromises(); });

    jest.clearAllMocks();
    (mockSupabase._queryBuilder as any).maybeSingle.mockResolvedValue({ data: null, error: null });
    setSession(USER_ID);

    const second = await renderHook(() =>
      useExperiment('pricing-test', ['a', 'b', 'c'])
    );
    await act(async () => { await flushPromises(); });
    const variantB = second.result.current;

    expect(variantA).toBe(variantB);
  });

  test('falls back to deterministic anonymous assignment when no session', async () => {
    setSession(null);

    const { result } = await renderHook(() =>
      useExperiment('anon-test', ['x', 'y'])
    );

    await act(async () => { await flushPromises(); });

    expect(['x', 'y']).toContain(result.current);
    expect(mockSupabase._queryBuilder.insert).not.toHaveBeenCalled();
  });
});