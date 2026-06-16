/**
 * GAS Template, Base API Service Layer
 *
 * Provides reusable data fetching patterns. The DevAgent adds
 * app-specific API functions to this file (e.g., getTrendFeed, getRecipes).
 *
 * Patterns available:
 *   - withCache<T>(key, ttlMs, fetcher), cached data fetching
 *   - callEdge<T>(fn, body?), Supabase Edge Function invocation
 *   - isOnline(), network connectivity check
 *   - enqueueOffline(fn, args), offline mutation queue
 *   - flushOfflineSyncQueue(), replay queued mutations
 */

import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { cacheQuery, getCached, clearCache, queueMutation, flushQueue } from '../lib/offline';
import { captureEvent } from '../lib/posthog';
import { captureException, addBreadcrumb } from '../lib/sentry';
import { trackApiLatency } from '../lib/performance';
import { retryWithBackoff } from '../lib/retry';
import { gasConfig } from '../gas.config';
import type { User, Notification, Bookmark, PaginatedResponse } from '../types';

// ─── Network Helpers ──────────────────────────────────────────────────────────

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

// ─── Cache Helper ─────────────────────────────────────────────────────────────

const SHORT_TTL = 2 * 60 * 1000;  // 2 minutes
const LONG_TTL = 15 * 60 * 1000;  // 15 minutes

/** Deduplication map, prevents concurrent calls with the same key from running the fetcher multiple times. */
const inflight = new Map<string, Promise<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Try cache first if offline
  if (!(await isOnline())) {
    const cached = await getCached<T>(key);
    if (cached) return cached.data;
    throw new Error('Offline and no cached data available');
  }

  // Deduplicate concurrent calls for the same key
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  // Try cache first (stale-while-revalidate)
  const cached = await getCached<T>(key);

  const promise = (async () => {
    try {
      const fresh = await retryWithBackoff(fetcher, {
        maxRetries: 2,
        baseDelay: 500,
        shouldRetry: (err) => {
          if (err && typeof err === 'object' && 'code' in err) {
            const code = Number((err as { code: unknown }).code);
            if (code >= 500 && code < 600) return true;
          }
          const msg = String(err);
          return msg.includes('timeout') || msg.includes('Network') || msg.includes('fetch failed');
        },
      });
      await cacheQuery(key, fresh, ttlMs);
      return fresh;
    } catch (err) {
      // Clear inflight before throwing so next caller can retry
      inflight.delete(key);
      // Return stale cache on error
      if (cached) return cached.data;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);

  // Safety TTL: remove stale inflight entries after 30s to prevent permanent locks
  const safety = setTimeout(() => inflight.delete(key), 30_000);
  promise.finally(() => clearTimeout(safety));

  return promise;
}

// ─── Edge Function Helper ─────────────────────────────────────────────────────

export async function callEdge<T>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  addBreadcrumb('api', `callEdge: ${functionName}`);
  const start = Date.now();
  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body ? JSON.stringify(body) : undefined,
      });
      if (error) throw error;
      if (data === undefined || data === null) {
        throw new Error(`${functionName} returned no data`);
      }
      return data as T;
    }, { maxRetries: 1, baseDelay: 1000 });
    trackApiLatency(functionName, Date.now() - start, false);
    return result;
  } catch (err) {
    trackApiLatency(functionName, Date.now() - start, true);
    captureException(err, { endpoint: functionName, params: body });
    captureEvent('api_error', { endpoint: functionName, message: String(err) });
    throw err;
  }
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

export async function enqueueOffline(
  endpoint: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): Promise<void> {
  // If online, execute immediately instead of queueing
  if (await isOnline()) {
    await callEdge(endpoint, body);
    return;
  }
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await queueMutation({ id, endpoint, method, body });
}

export async function flushOfflineSyncQueue(): Promise<void> {
  await flushQueue(async (item) => {
    await callEdge(item.endpoint, item.body);
  });
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return withCache<User>(`user_profile_${user.id}`, SHORT_TTL, async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data as User;
  });
}

export async function updateUserProfile(
  updates: Partial<Pick<User, 'display_name' | 'avatar_url' | 'notification_preferences' | 'theme_preference'>>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;

  // Invalidate user profile cache after update
  await clearCache(`user_profile_${user.id}`);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(
  page = 0,
  limit = 20,
): Promise<PaginatedResponse<Notification>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], count: 0, hasMore: false };

  const from = page * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data ?? []) as Notification[],
    count: count ?? 0,
    hasMore: (count ?? 0) > to + 1,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export async function toggleBookmark(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if already bookmarked
  const { data: existing } = await supabase
    .from('user_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_bookmarks').delete().eq('id', existing.id);
    return false; // Removed
  }

  await supabase.from('user_bookmarks').insert({
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
  });
  return true; // Added
}

export async function getBookmarks(
  entityType: string,
): Promise<Bookmark[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_bookmarks')
    .select('*')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Bookmark[];
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export async function getCreditBalance(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data as { balance: number } | null)?.balance ?? 0;
}

export async function getCreditLedger(
  page = 0,
  limit = 20,
): Promise<PaginatedResponse<import('../types').CreditLedgerEntry>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], count: 0, hasMore: false };

  const from = page * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('credit_ledger')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data: (data ?? []) as import('../types').CreditLedgerEntry[],
    count: count ?? 0,
    hasMore: (count ?? 0) > to + 1,
  };
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getTransactions(
  page = 0,
  limit = 20,
  type?: import('../types').TransactionType,
): Promise<PaginatedResponse<import('../types').Transaction>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], count: 0, hasMore: false };

  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (type) query = query.eq('type', type);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data ?? []) as import('../types').Transaction[],
    count: count ?? 0,
    hasMore: (count ?? 0) > to + 1,
  };
}

// ─── User Products ───────────────────────────────────────────────────────────

export async function getOwnedProducts(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_products')
    .select('product_id')
    .eq('user_id', user.id);

  return (data ?? []).map((d: { product_id: string }) => d.product_id);
}

// ─── Async Backbone ───────────────────────────────────────────────────────────

export interface EnqueueJobInput {
  kind: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<{ id: string }> {
  // Inserts directly via PostgREST. Service-role policies on `jobs` mean this
  // only succeeds in server contexts where the service-role key is in use.
  // From mobile client contexts, call the appropriate Edge Function instead.
  return retryWithBackoff(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        kind: input.kind,
        payload: input.payload ?? {},
        available_at: (input.availableAt ?? new Date()).toISOString(),
        max_attempts: input.maxAttempts ?? 5,
      })
      .select('id')
      .single();
    if (error) throw error;
    return { id: data.id };
  }, { maxRetries: 1, baseDelay: 500 });
}

export interface SendEmailInput {
  template: 'welcome' | 'password_reset' | 'receipt';
  to: string;
  vars: Record<string, string>;
  userId?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string; status: 'sent' | 'failed' }> {
  return callEdge<{ id: string; status: 'sent' | 'failed' }>('send-email', input as unknown as Record<string, unknown>);
}

export interface SendPushInput {
  userId: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export async function sendPush(input: SendPushInput): Promise<{ sent: number }> {
  return callEdge<{ sent: number }>('send-push', input as unknown as Record<string, unknown>);
}

/**
 * Client convenience: request notification permission and register the resulting
 * token to push_tokens. Wraps lib/notifications.ts so feature code can call one
 * function. Returns the Expo push token if permission granted, else null.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  const { requestPermissionAndRegister } = await import('../lib/notifications');
  return requestPermissionAndRegister(userId);
}

// ─── Compliance, data rights, cost (cluster 2) ──────────────────────────────

export interface DataExportRequestResult {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
}

export async function requestDataExport(): Promise<DataExportRequestResult> {
  return callEdge<DataExportRequestResult>('request-data-export', {});
}

export interface AccountDeletionRequestResult {
  scheduled_for: string;
  immediate: boolean;
}

export async function requestAccountDeletion(
  input: { immediate?: boolean; reason?: string } = {},
): Promise<AccountDeletionRequestResult> {
  return callEdge<AccountDeletionRequestResult>('request-account-deletion', input);
}

export async function cancelAccountDeletion(): Promise<{ cancelled: boolean; reason?: string }> {
  return callEdge<{ cancelled: boolean; reason?: string }>('cancel-account-deletion', {});
}

// Cost budgets are enforced server-side via the consume_cost RPC inside Edge
// Functions. Client-side pre-checks would diverge from server semantics (window
// math, throttle path) and mislead callers, call the cost-gated Edge Function
// and act on its allowed/remaining response.

// ─── Cluster 4: media, search, realtime, integrations ───────────────────────

export { pickImage, uploadImage, signedUrlFor, deleteImage, MediaError } from './media';
export type { ImageResult, PickImageOptions, UploadImageOptions } from './media';
export { ServiceError } from './errors';

export { search, searchSuggestions } from './search';
export type { SearchResult, SearchOptions } from './search';

export { broadcast } from './realtime';
export type { PresencePeer, UsePresenceReturn } from './realtime';
export { usePresence } from '../hooks/usePresence';
export { useChannelSubscription } from '../hooks/useChannelSubscription';

export { getActiveAccessToken, listConnections, disconnectProvider } from './oauth';
export type { OAuthConnection, OAuthProvider } from './oauth';

export { useOptimisticMutation } from '../hooks/useOptimisticMutation';
export type {
  UseOptimisticMutationOpts,
  UseOptimisticMutationReturn,
} from '../hooks/useOptimisticMutation';

// ─── Cluster 5: LLM, lifecycle, multi-tenancy, growth, admin ────────────────

export { chat, streamChat, embed, transcribe } from './llm';
export type { ChatMessage, ChatOptions, ChatCompletion } from './llm';

export { signInWithApple, isAppleAuthAvailable } from './apple-auth';
export {
  isBiometricAvailable,
  authenticate as authenticateBiometric,
  requiresReauth,
} from './biometric';
export { generateReferralCode, share } from './share';
export { recordAttribution, listMyReferrals } from './referrals';

export { useDynamicType } from '../hooks/useDynamicType';
export { useReducedMotion } from '../hooks/useReducedMotion';
export { useBreakpoint } from '../hooks/useBreakpoint';
export type { Breakpoint } from '../hooks/useBreakpoint';
export { useOrientation } from '../hooks/useOrientation';
export type { Orientation } from '../hooks/useOrientation';
export { useExperiment } from '../hooks/useExperiment';
export { useBackgroundSync } from '../hooks/useBackgroundSync';
export type { BackgroundSyncOpts } from '../hooks/useBackgroundSync';

export { EVENTS } from '../lib/events';
export type { EventName } from '../lib/events';
export { isAdmin, requireAdmin } from '../lib/admin';
export { OrgProvider, useCurrentOrg, orgFilter } from '../lib/multitenancy';
export type { Organization } from '../lib/multitenancy';

// ─── Cluster 6 ───────────────────────────────────────────────────────────────

// Push notifications
export {
  requestPermission,
  // registerForPush is already exported above (async backbone section); use services/push directly for the no-arg variant
  unregister,
  updatePreferences,
  getPreferences,
  initPushHandlers,
} from './push';
export type { NotificationCategory, NotificationPreferences } from './push';

// Widget data
export { setWidgetData, getWidgetData } from './widget-data';

// Anonymous auth (cluster 6 additions)
export { signInAnonymously, upgradeAnonymousAccount } from './auth';

// Push + AppState + anonymous migration hooks
export { usePushPermissions } from '../hooks/usePushPermissions';
export { useAppState } from '../hooks/useAppState';
export { useOnForeground } from '../hooks/useOnForeground';
export { useOnBackground } from '../hooks/useOnBackground';
export { useAnonymousMigration } from '../hooks/useAnonymousMigration';

// Form library
export { useTypedForm, useFormServerError, useAsyncFieldValidator } from '../lib/forms';

// Form primitives
export { FormInput } from '../components/forms/FormInput';
export { FormSelect } from '../components/forms/FormSelect';
export { FormTextarea } from '../components/forms/FormTextarea';
export { FormCheckbox } from '../components/forms/FormCheckbox';
export { FormSwitch } from '../components/forms/FormSwitch';
export { FormButton } from '../components/forms/FormButton';
export { FormErrorBanner } from '../components/forms/FormErrorBanner';

// Min-version gate
export { MinVersionGate } from '../components/MinVersionGate';

// ─── Cluster 7 ───────────────────────────────────────────────────────────────

// FormWizard, multi-step form primitive
export { FormWizard } from '../components/forms/FormWizard';
export type { FormWizardStep, FormWizardProps } from '../components/forms/FormWizard';

// ─── DevAgent: Add app-specific API functions below this line ─────────────────
