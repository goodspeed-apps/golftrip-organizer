/**
 * Tests for services/widget-data.ts
 *
 * Covers:
 * - Web platform: setWidgetData no-ops, getWidgetData returns null
 * - Native platform with module available: setWidgetData calls native setItem
 * - Native platform without module (Expo Go): no-ops with console.warn
 */

// ─── Shared mock refs ────────────────────────────────────────────────────────
// These are declared at module scope so they survive jest.resetModules() calls
// inside tests. Each loadService() call re-registers fresh doMocks.

const mockSetItem = jest.fn().mockResolvedValue(undefined);
const mockGetItem = jest.fn().mockResolvedValue('Buy groceries');
const mockCaptureException = jest.fn();
const mockWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reset the module registry and re-register all mocks with the given platform
 * and module-availability settings, then require() the service under test.
 * Using require() (not await import()) avoids TS1323 dynamic-import errors.
 */
function loadService(os: 'ios' | 'android' | 'web', moduleAvailable: boolean) {
  jest.resetModules();

  jest.doMock('react-native', () => ({ Platform: { OS: os } }));

  jest.doMock('expo-modules-core', () => ({
    requireNativeModule: moduleAvailable
      ? jest.fn().mockReturnValue({ setItem: mockSetItem, getItem: mockGetItem })
      : jest.fn().mockImplementation(() => {
          throw new Error('Module WidgetDataModule not found');
        }),
  }));

  jest.doMock('../../lib/sentry', () => ({
    captureException: mockCaptureException,
    captureMessage: jest.fn(),
  }));

  jest.doMock('../../lib/retry', () => ({
    retryWithBackoff: jest.fn((fn: () => unknown) => fn()),
    isTransientNon4xxError: jest.fn(() => false),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../services/widget-data') as typeof import('../../services/widget-data');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setWidgetData', () => {
  it('no-ops on web and does not call native module', async () => {
    const { setWidgetData } = loadService('web', true);
    await setWidgetData('nextTask', 'Buy groceries');
    expect(mockSetItem).not.toHaveBeenCalled();
  });

it('calls native setItem when module is available on iOS', async () => {
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('nextTask', 'Buy groceries');
    // M3: plain strings stored raw (no envelope)
    expect(mockSetItem).toHaveBeenCalledWith('nextTask', 'Buy groceries');
  });

  it('no-ops with console.warn when native module is missing (Expo Go)', async () => {
    const { setWidgetData } = loadService('ios', false);
    await setWidgetData('nextTask', 'Buy groceries');
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('WidgetDataModule not available')
    );
  });
});

describe('getWidgetData', () => {
  it('returns null on web without calling native module', async () => {
    const { getWidgetData } = loadService('web', true);
    const result = await getWidgetData('nextTask');
    expect(result).toBeNull();
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('returns null with console.warn when module is missing (Expo Go)', async () => {
    const { getWidgetData } = loadService('android', false);
    const result = await getWidgetData('nextTask');
    expect(result).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('WidgetDataModule not available')
    );
  });
});

// ─── Codec round-trip tests ───────────────────────────────────────────────────

describe('codec round-trips', () => {
it('round-trips a string value (stored raw)', async () => {
    // M3: strings are stored without envelope; legacy envelope form still decodes correctly
    mockGetItem.mockResolvedValueOnce('hello');
    const { getWidgetData } = loadService('ios', true);
    const result = await getWidgetData<string>('k');
    expect(result).toBe('hello');
  });

  it('round-trips a number (integer)', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'num', v: 42 }));
    const { getWidgetData } = loadService('ios', true);
    const result = await getWidgetData<number>('k');
    expect(result).toBe(42);
  });

  it('round-trips a number (float and negative)', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'num', v: 3.14 }));
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData<number>('k')).toBeCloseTo(3.14);

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'num', v: -1 }));
    expect(await getWidgetData<number>('k')).toBe(-1);
  });

  it('round-trips booleans', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'bool', v: true }));
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData<boolean>('k')).toBe(true);

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'bool', v: false }));
    expect(await getWidgetData<boolean>('k')).toBe(false);
  });

  it('round-trips a plain object', async () => {
    const obj = { a: 1, b: 'x' };
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'json', v: obj }));
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData<typeof obj>('k')).toEqual(obj);
  });

  it('round-trips an array', async () => {
    const arr = [1, 2, 3];
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'json', v: arr }));
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData<number[]>('k')).toEqual(arr);
  });

it('encodes string correctly when setWidgetData is called (raw pass-through, no envelope)', async () => {
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('k', 'Buy groceries');
    // M3: plain strings are stored raw — no envelope wrapper
    expect(mockSetItem).toHaveBeenCalledWith('k', 'Buy groceries');
  });

  it('throws ServiceError for NaN', async () => {
    const { setWidgetData } = loadService('ios', true);
    await expect(setWidgetData('k', NaN)).rejects.toMatchObject({
      code: 'widget_data_non_finite',
      status: 400,
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('throws ServiceError for Infinity', async () => {
    const { setWidgetData } = loadService('ios', true);
    await expect(setWidgetData('k', Infinity)).rejects.toMatchObject({
      code: 'widget_data_non_finite',
      status: 400,
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('encodes number correctly when setWidgetData is called', async () => {
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('streakDays', 7);
    expect(mockSetItem).toHaveBeenCalledWith(
      'streakDays',
      JSON.stringify({ __t: 'num', v: 7 })
    );
  });

  it('encodes boolean correctly when setWidgetData is called', async () => {
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('isPremium', true);
    expect(mockSetItem).toHaveBeenCalledWith(
      'isPremium',
      JSON.stringify({ __t: 'bool', v: true })
    );
  });

  it('encodes object correctly when setWidgetData is called', async () => {
    const todo = { id: 1, label: 'Buy milk' };
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('todo', todo);
    expect(mockSetItem).toHaveBeenCalledWith(
      'todo',
      JSON.stringify({ __t: 'json', v: todo })
    );
  });
});

// ─── Legacy back-compat ───────────────────────────────────────────────────────

describe('legacy back-compat', () => {
  it('returns raw string when native bridge returns a non-envelope string', async () => {
    mockGetItem.mockResolvedValueOnce('raw legacy string');
    const { getWidgetData } = loadService('ios', true);
    const result = await getWidgetData<string>('k');
    expect(result).toBe('raw legacy string');
  });

  it('returns raw string when native bridge returns plain JSON without __t', async () => {
    mockGetItem.mockResolvedValueOnce('{"foo":"bar"}');
    const { getWidgetData } = loadService('ios', true);
    // JSON without __t is not an envelope — returns the raw string
    const result = await getWidgetData<string>('k');
    expect(result).toBe('{"foo":"bar"}');
  });
});

// ─── Null / nonexistent keys ──────────────────────────────────────────────────

describe('null handling', () => {
  it('getWidgetData returns null when native bridge returns null (key not set)', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData('missing')).toBeNull();
  });

  it('setWidgetData encodes null as json envelope and getWidgetData returns null from it', async () => {
    const { setWidgetData } = loadService('ios', true);
    await setWidgetData('k', null);
    expect(mockSetItem).toHaveBeenCalledWith(
      'k',
      JSON.stringify({ __t: 'json', v: null })
    );

    // Reading it back: the codec extracts v (null) and returns null
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ __t: 'json', v: null }));
    const { getWidgetData } = loadService('ios', true);
    expect(await getWidgetData('k')).toBeNull();
  });
});

// ─── Size limits ──────────────────────────────────────────────────────────────

describe('size limits', () => {
  const mockCaptureMessage = jest.fn();

  function loadServiceWithCaptureMessage(os: 'ios' | 'android' | 'web', moduleAvailable: boolean) {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule: moduleAvailable
        ? jest.fn().mockReturnValue({ setItem: mockSetItem, getItem: mockGetItem })
        : jest.fn().mockImplementation(() => {
            throw new Error('Module not found');
          }),
    }));
    jest.doMock('../../lib/sentry', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
    }));
    jest.doMock('../../lib/retry', () => ({
      retryWithBackoff: jest.fn((fn: () => unknown) => fn()),
      isTransientNon4xxError: jest.fn(() => false),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../services/widget-data') as typeof import('../../services/widget-data');
  }

  beforeEach(() => {
    mockCaptureMessage.mockClear();
    mockSetItem.mockClear();
  });

  it('calls captureMessage with warning for values between 32 KB and 64 KB', async () => {
    const { setWidgetData } = loadServiceWithCaptureMessage('ios', true);
    // Envelope overhead is ~12 chars; fill to ~33 KB to exceed the 32 KB warn threshold
    const bigValue = 'x'.repeat(33 * 1024);
    await setWidgetData('k', bigValue);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('k'),
      'warning'
    );
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('throws ServiceError for values above 64 KB', async () => {
    const { setWidgetData } = loadServiceWithCaptureMessage('ios', true);
    const hugeValue = 'x'.repeat(65 * 1024);
    await expect(setWidgetData('k', hugeValue)).rejects.toMatchObject({
code: 'widget_data_too_large',
      status: 413,
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
