import fs from 'node:fs';
import path from 'node:path';

// ─── Size catalogue ───────────────────────────────────────────────────────────

export const IOS_SIZES: Record<string, { width: number; height: number }> = {
  '6.7-inch': { width: 1290, height: 2796 },
  '5.5-inch': { width: 1242, height: 2208 },
};

export const ANDROID_SIZES: Record<string, { width: number; height: number }> = {
  phone: { width: 1080, height: 1920 },
  // 7-inch tablet: common Play Store requirement (e.g. Nexus 7 2013)
  '7-inch-tablet': { width: 1200, height: 1920 },
  // 10-inch tablet: common Play Store requirement (e.g. Pixel Tablet)
  '10-inch-tablet': { width: 1600, height: 2560 },
};

export const PLATFORM_SIZES: Record<string, Record<string, { width: number; height: number }>> = {
  ios: IOS_SIZES,
  android: ANDROID_SIZES,
};

// ─── Flow catalogue ───────────────────────────────────────────────────────────

export interface ScreenshotFlow {
  order: string;
  name: string;
}

export const FLOWS: ScreenshotFlow[] = [
  { order: '01', name: 'home' },
  { order: '02', name: 'signup' },
  { order: '03', name: 'paywall' },
  { order: '04', name: 'profile' },
  { order: '05', name: 'settings' },
];

// ─── CLI parsing ─────────────────────────────────────────────────────────────

export interface ScreenshotOptions {
  platform: string;
  locales: string[];
  out: string;
  skipCapture: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): ScreenshotOptions {
  const args = argv.slice(2);
  const opts: ScreenshotOptions = {
    platform: 'all',
    locales: ['en-US'],
    out: 'screenshots',
    skipCapture: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
        opts.help = true;
        break;
      case '--skip-capture':
        opts.skipCapture = true;
        break;
      case '--platform':
        opts.platform = args[++i];
        break;
      case '--locales':
        opts.locales = args[++i].split(',').map((l) => l.trim());
        break;
      case '--out':
        opts.out = args[++i];
        break;
      default:
        // Unknown flags are silently skipped; the orchestrator warns.
        break;
    }
  }
  return opts;
}

// ─── Output path ──────────────────────────────────────────────────────────────

/**
 * Returns the expected output file path for a screenshot.
 * Pattern: {outRoot}/{platform}/{sizeName}/{order}-{name}.png
 */
export function outputPath(
  outRoot: string,
  platform: string,
  sizeName: string,
  order: string,
  name: string,
): string {
  return path.join(outRoot, platform, sizeName, `${order}-${name}.png`);
}

// ─── Resize step ──────────────────────────────────────────────────────────────

export interface ResizeResult {
  dest: string;
  width: number;
  height: number;
}

/**
 * Resizes a single source image to all sizes for the given platform using Sharp.
 * Returns an array of { dest, width, height } for each written file.
 *
 * Sharp is loaded via require() so jest.mock('sharp', ...) replaces it in tests.
 */
export async function resizeForPlatform(
  srcPath: string,
  platform: string,
  outRoot: string,
  order: string,
  name: string,
): Promise<ResizeResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharpModule = require('sharp');
  const sharp = sharpModule.default ?? sharpModule;

  const sizes = PLATFORM_SIZES[platform];
  if (!sizes) throw new Error(`Unknown platform: ${platform}`);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Input file not found: ${srcPath}`);
  }

const pipeline = (sharp as any)(srcPath);
  const results = await Promise.all(
    Object.entries(sizes).map(async ([sizeName, { width, height }]) => {
      const dest = outputPath(outRoot, platform, sizeName, order, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await pipeline.clone().resize(width, height, { fit: 'cover', position: 'top' }).png().toFile(dest);
      return { dest, width, height };
    }),
  );
  return results;
}