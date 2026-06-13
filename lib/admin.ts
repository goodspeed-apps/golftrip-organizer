import { supabase, getCurrentUserId } from './supabase';
import { router } from 'expo-router';
import { retryWithBackoff, isTransientNon4xxError } from './retry';
import { withCache, clearCache } from './offline';

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (id: string) => `admin:role:${id}`;

// In-memory dedup of in-flight admin checks: persistent withCache handles
// cross-launch reuse, this avoids two parallel callers both hitting the DB
// before either writes through to AsyncStorage.
const inflight = new Map<string, Promise<boolean>>();

let authSubscribed = false;
let lastUserId: string | null = null;

function ensureAuthInvalidation(): void {
  if (authSubscribed) return;
  authSubscribed = true;
  try {
    supabase.auth.onAuthStateChange(() => {
      // Invalidate the persistent entry for whatever user we last saw, so a
      // sign-out followed by sign-in as a different account doesn't return
      // the previous answer.
      if (lastUserId) {
        clearCache(cacheKey(lastUserId)).catch(() => { /* ignore */ });
      }
      inflight.clear();
    });
  } catch {
    // ignore, listener registration optional in test envs
  }
}

export function __clearAdminCache(): void {
  inflight.clear();
  if (lastUserId) {
    clearCache(cacheKey(lastUserId)).catch(() => { /* ignore */ });
  }
  lastUserId = null;
}

export async function isAdmin(userId?: string): Promise<boolean> {
  ensureAuthInvalidation();
  const id = userId ?? (await getCurrentUserId());
  if (!id) return false;
  lastUserId = id;

  const existing = inflight.get(id);
  if (existing) return existing;

  const promise = withCache(
    cacheKey(id),
    () => retryWithBackoff(
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data?.role === 'admin';
      },
      { shouldRetry: isTransientNon4xxError },
    ),
    ADMIN_CACHE_TTL_MS,
  ).finally(() => { inflight.delete(id); });
  inflight.set(id, promise);
  return promise;
}

export async function requireAdmin(): Promise<boolean> {
  const ok = await isAdmin();
  if (!ok) router.replace('/');
  return ok;
}
