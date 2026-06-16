import { supabase } from './supabase';

export type ConsentType =
  | 'privacy_banner'
  | 'analytics'
  | 'marketing'
  | 'functional';

export interface ConsentRecord {
  type: ConsentType;
  consented: boolean;
}

const VERSION = '1.0';

export async function recordConsent(
  records: ConsentRecord | ConsentRecord[],
  opts: { userId?: string | null } = {},
): Promise<void> {
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) return;

  let userId = opts.userId ?? null;
  if (userId === undefined || userId === null) {
    const { data } = await supabase.auth.getSession();
    userId = data?.session?.user?.id ?? null;
  }
  if (!userId) return;

  const rows = list.map((r) => ({
    user_id: userId,
    consent_type: r.type,
    consented: r.consented,
    version: VERSION,
  }));
  const { error } = await supabase.from('consent_log').insert(rows);
  if (error) throw error;
}