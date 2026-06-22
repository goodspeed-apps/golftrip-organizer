import { supabase, getCurrentUserId } from '../lib/supabase';
import { captureEvent } from '../lib/posthog';
import { captureException } from '../lib/sentry';
import { EVENTS } from '../lib/events';

export async function recordAttribution(code: string, event: string): Promise<boolean> {
  const referredUserId = await getCurrentUserId();
  if (!referredUserId) return false;
  // .select() returns the matched row so race losers (rows already attributed
  // by another tab) come back with an empty array, letting us skip the event emit.
  const { data, error } = await supabase
    .from('referrals')
    .update({
      referred_user_id: referredUserId,
      attribution_event: event,
      attributed_at: new Date().toISOString(),
    })
    .eq('code', code)
    .is('referred_user_id', null)
    .select('id, code');
  if (error) {
    captureException(error, { service: 'referrals', op: 'recordAttribution' });
    return false;
  }
  const attributed = !!data && data.length > 0;
  if (attributed) {
    captureEvent(EVENTS.referral_attributed, { code, event });
  }
  return attributed;
}

export async function listMyReferrals(): Promise<Array<{ code: string; referred_user_id: string | null; attribution_event: string | null; attributed_at: string | null }>> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('referrals')
    .select('code, referred_user_id, attribution_event, attributed_at')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    captureException(error, { service: 'referrals', op: 'listMyReferrals' });
    throw error;
  }
  return data ?? [];
}