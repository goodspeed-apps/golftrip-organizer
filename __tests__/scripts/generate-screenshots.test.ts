/**
 * Tests for scripts/generate-screenshots.mjs (via generate-screenshots-helpers.ts)
 *
 * Covers:
 *  1. Resize logic produces correct dimensions for each platform size
 *  2. Output paths follow screenshots/{platform}/{size}/{order}-{name}.png pattern
 *  3. Skip-capture mode: parseArgs correctly sets skipCapture
 *  4. Missing input file -> clean error message
 *  5. Size catalogue completeness
 */

import path from 'node:path';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock 'sharp' so tests never touch the filesystem or require a native binary.
const mockToFile = jest.fn().mockResolvedValue(undefined);
const mockPng = jest.fn().mockReturnValue({ toFile: mockToFile });
const mockResize = jest.fn().mockReturnValue({ png: mockPng });
const mockClone = jest.fn().mockReturnValue({ resize: mockResize });
const mockSharp = jest.fn().mockReturnValue({ clone: mockClone });

jest.mock('sharp', () => ({ default: mockSharp, __esModule: true }), { virtual: true });

// Mock fs so tests are hermetic.
jest.mock('node:fs', () => {
  const real = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...real,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

import fs from 'node:fs';

// Import helpers after mocks are registered (ts-jest resolves this synchronously).
import {
  IOS_SIZES,
  ANDROID_SIZES,
  PLATFORM_SIZES,
  outputPath,
  resizeForPlatform,
  parseArgs,
} from '../../scripts/generate-screenshots-helpers';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: source file exists.
  (fs.existsSync as jest.Mock).mockReturnValue(true);
});

// ─── 1. Resize dimensions ────────────────────────────────────────────────────

describe('iOS resize dimensions', () => {
  test('resizes to both required iOS sizes (6.7-inch and 5.5-inch)', async () => {
    await resizeForPlatform('/raw/ios/01-home.png', 'ios', '/out', '01', 'home');

    const resizeCalls = mockResize.mock.calls as Array<[number, number, object]>;
    const dims = resizeCalls.map(([w, h]) => ({ width: w, height: h }));

    expect(dims).toContainEqual({ width: 1290, height: 2796 });
    expect(dims).toContainEqual({ width: 1242, height: 2208 });
  });

  test('produces exactly 2 output files for iOS (one per size)', async () => {
    await resizeForPlatform('/raw/ios/01-home.png', 'ios', '/out', '01', 'home');
    expect(mockToFile).toHaveBeenCalledTimes(Object.keys(IOS_SIZES).length);
  });
});

describe('Android resize dimensions', () => {
  test('resizes to all three required Android sizes', async () => {
    await resizeForPlatform('/raw/android/01-home.png', 'android', '/out', '01', 'home');

    const resizeCalls = mockResize.mock.calls as Array<[number, number, object]>;
    const dims = resizeCalls.map(([w, h]) => ({ width: w, height: h }));

    expect(dims).toContainEqual({ width: 1080, height: 1920 });
    expect(dims).toContainEqual({ width: 1200, height: 1920 });
    expect(dims).toContainEqual({ width: 1600, height: 2560 });
  });

  test('produces exactly 3 output files for Android (one per size)', async () => {
    await resizeForPlatform('/raw/android/02-signup.png', 'android', '/out', '02', 'signup');
    expect(mockToFile).toHaveBeenCalledTimes(Object.keys(ANDROID_SIZES).length);
  });
});

// ─── 2. Output path pattern ───────────────────────────────────────────────────

describe('outputPath', () => {
  test('iOS 6.7-inch home path matches expected pattern', () => {
    const result = outputPath('/out', 'ios', '6.7-inch', '01', 'home');
    expect(result).toBe(path.join('/out', 'ios', '6.7-inch', '01-home.png'));
  });

  test('Android phone paywall path matches expected pattern', () => {
    const result = outputPath('/out', 'android', 'phone', '03', 'paywall');
    expect(result).toBe(path.join('/out', 'android', 'phone', '03-paywall.png'));
  });

  test('resizeForPlatform returns paths matching store.config.json references', async () => {
    const results = await resizeForPlatform('/raw/ios/01-home.png', 'ios', 'screenshots', '01', 'home');
    const dests = results.map((r) => r.dest);

    expect(dests).toContain(path.join('screenshots', 'ios', '6.7-inch', '01-home.png'));
    expect(dests).toContain(path.join('screenshots', 'ios', '5.5-inch', '01-home.png'));
  });
});

// ─── 3. Skip-capture / parseArgs ─────────────────────────────────────────────

describe('parseArgs -- skip-capture flag', () => {
  test('--skip-capture sets skipCapture to true', () => {
    const opts = parseArgs(['node', 'script.mjs', '--skip-capture']);
    expect(opts.skipCapture).toBe(true);
  });

  test('default opts have skipCapture false', () => {
    const opts = parseArgs(['node', 'script.mjs']);
    expect(opts.skipCapture).toBe(false);
  });

  test('--platform ios sets platform correctly', () => {
    const opts = parseArgs(['node', 'script.mjs', '--platform', 'ios']);
    expect(opts.platform).toBe('ios');
  });

  test('--locales parses comma-separated values', () => {
    const opts = parseArgs(['node', 'script.mjs', '--locales', 'en-US,fr-FR']);
    expect(opts.locales).toEqual(['en-US', 'fr-FR']);
  });

  test('default platform is "all"', () => {
    const opts = parseArgs(['node', 'script.mjs']);
    expect(opts.platform).toBe('all');
  });
});

// ─── 4. Missing input file -> clean error ─────────────────────────────────────

describe('resizeForPlatform -- missing input', () => {
  test('throws a descriptive error when source PNG does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(
      resizeForPlatform('/raw/ios/missing.png', 'ios', '/out', '01', 'home'),
    ).rejects.toThrow('Input file not found: /raw/ios/missing.png');
  });

  test('error message includes the missing file path', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const srcPath = '/screenshots/_raw/android/03-paywall.png';

    let caught: Error | null = null;
    try {
      await resizeForPlatform(srcPath, 'android', '/out', '03', 'paywall');
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain(srcPath);
  });
});

// ─── 5. Size catalogue completeness ──────────────────────────────────────────

describe('size catalogues', () => {
  test('IOS_SIZES has exactly 2 entries', () => {
    expect(Object.keys(IOS_SIZES)).toHaveLength(2);
  });

  test('ANDROID_SIZES has exactly 3 entries', () => {
    expect(Object.keys(ANDROID_SIZES)).toHaveLength(3);
  });

  test('all size values have positive width and height', () => {
    for (const sizes of Object.values(PLATFORM_SIZES)) {
      for (const { width, height } of Object.values(sizes)) {
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
      }
    }
  });
});
