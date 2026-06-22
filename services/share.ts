import { supabase, getCurrentUserId } from '../lib/supabase';
import { gasConfig } from '../gas.config';
import { ServiceError } from './errors';
import { captureEvent } from '../lib/posthog';
import { captureException } from '../lib/sentry';
import { EVENTS } from '../lib/events';
import { shareContent } from '../lib/sharing';
import { randomBase32 } from '../lib/crypto';

export async function generateReferralCode(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new ServiceError('share.401', 401, 'Not authenticated');
  const code = await randomBase32(gasConfig.growth.referralCodeLength ?? 8);
  const { error } = await supabase.from('referrals').insert({
    code,
    referrer_user_id: userId,
  });
  if (error) {
    captureException(error, { service: 'share' });
    throw new ServiceError('share.db', 500, error.message);
  }
  return code;
}

export async function share(opts: { code: string; subject: string; message: string; url?: string }): Promise<{ shared: boolean }> {
  // Delegate to lib/sharing.shareContent: web fallback, navigator.share /
  // clipboard handling, native iOS url handling, and captureException are all
  // already implemented there. We only add the referral-aware message wrapper
  // and the EVENTS.share_completed emit.
  const result = await shareContent({
    title: opts.subject,
    message: `${opts.message}\n\nReferral: ${opts.code}`,
    url: opts.url,
  });
  const shared = result.success;
  if (shared) {
    captureEvent(EVENTS.share_completed, { code: opts.code });
  }
  return { shared };
}
