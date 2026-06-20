import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { publicHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { compareVersions } from '../_shared/semver.ts';
import { err } from '../_shared/edge-response.ts';
import { HttpError } from '../_shared/http-error.ts';

export type Platform = 'ios' | 'android' | 'web';
const VALID_PLATFORMS: ReadonlySet<Platform> = new Set(['ios', 'android', 'web']);

function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && VALID_PLATFORMS.has(v as Platform);
}

// Module-level cache: Deno isolates persist this across invocations within
// the warm window, so repeat platform queries skip the DB hit.
interface VersionRow {
  min_version: string;
  recommended_version: string;
  message: string;
}
interface CachedRow {
  row: VersionRow;
  expiresAt: number;
}
const versionCache = new Map<string, CachedRow>();
const VERSION_CACHE_TTL_MS = 60_000;

serve(
  publicHandler({
    name: 'check-min-version',
    errorCode: 'min_version_check_error',
    handler: async (body) => {
      const platform = body.platform;
      const clientVersion = body.clientVersion as string | undefined;

      if (!isPlatform(platform)) {
        throw new HttpError(400, 'Unknown or missing platform');
      }

      if (!clientVersion) {
        throw new HttpError(400, 'Missing clientVersion');
      }

      // Validate clientVersion is parseable before the DB call.
      try {
        compareVersions(clientVersion, '0.0.0');
      } catch {
        throw new HttpError(400, 'Unparseable clientVersion');
      }

      let row: VersionRow;
      const cached = versionCache.get(platform);
      if (cached && cached.expiresAt > Date.now()) {
        row = cached.row;
      } else {
        const { data, error } = await serviceClient()
          .from('app_versions')
          .select('min_version, recommended_version, message')
          .eq('platform', platform)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new HttpError(400, `No version config for platform: ${platform}`);
        }
        row = data as VersionRow;
        versionCache.set(platform, { row, expiresAt: Date.now() + VERSION_CACHE_TTL_MS });
      }

      const { min_version: minVersion, recommended_version: recommendedVersion, message } = row;
      const mustUpdate = compareVersions(clientVersion, minVersion) < 0;

      return { ok: true, minVersion, recommendedVersion, message, mustUpdate };
    },
    errorMap: (e) => {
      if (e instanceof HttpError) {
        return err(e.message, e.status, 'min_version_check_error');
      }
      return null;
    },
  }),
);
