import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { captureEvent } from '../lib/posthog';
import { EVENTS } from '../lib/events';
import { assignBucket, fnv1a32 } from '../lib/hash';

const CACHE_PREFIX = 'experiment:';

export function useExperiment(name: string, variants: string[]): string {
  const [variant, setVariant] = useState<string>(variants[0]);

  // Stable hash of the variant list so the effect dep doesn't recompute the
  // JSON.stringify on every render. Same hash → same effect dep → no re-run.
  const variantsHash = useMemo(() => fnv1a32(variants.join('|')), [variants]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        const bucket = assignBucket(null, name, variants.length);
        if (!cancelled) setVariant(variants[bucket]);
        return;
      }

      // AsyncStorage cache short-circuits the round-trip on subsequent mounts.
      const cacheKey = `${CACHE_PREFIX}${name}:${userId}`;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && variants.includes(cached)) {
          if (!cancelled) setVariant(cached);
          return;
        }
      } catch {
        // ignore cache read failures
      }

      // Upsert ignoreDuplicates lets concurrent tabs race safely: whoever inserts
      // first wins, the others are no-ops. The subsequent select reads the winner.
      const candidate = variants[assignBucket(userId, name, variants.length)];
      await supabase
        .from('experiments')
        .upsert(
          { user_id: userId, experiment_name: name, variant: candidate },
          { onConflict: 'user_id,experiment_name', ignoreDuplicates: true },
        );

      const { data: row } = await supabase
        .from('experiments')
        .select('variant')
        .eq('user_id', userId)
        .eq('experiment_name', name)
        .maybeSingle();

      const resolved = row?.variant && variants.includes(row.variant) ? row.variant : candidate;
      try {
        await AsyncStorage.setItem(cacheKey, resolved);
      } catch {
        // ignore cache write failures
      }
      if (resolved === candidate) {
        captureEvent(EVENTS.experiment_assigned, { name, variant: resolved });
      }
      if (!cancelled) setVariant(resolved);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, variantsHash]);

  return variant;
}
