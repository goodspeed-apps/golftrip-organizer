// supabase/functions/cancel-account-deletion/index.ts
// User-auth-gated. POST {} — clears pending deletion if within window.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { userHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { log } from '../_shared/edge-logger.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';

serve(userHandler({
  name: 'cancel-account-deletion',
  errorCode: 'cancel_deletion_error',
  handler: async ({ userId }) => {
    const client = serviceClient();
    const { data: prof, error: rErr } = await client
      .from('profiles')
      .select('delete_scheduled_for')
      .eq('id', userId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!prof?.delete_scheduled_for || new Date(prof.delete_scheduled_for) <= new Date()) {
      return { cancelled: false, reason: 'window_expired_or_no_request' };
    }

    const { error: uErr } = await client.from('profiles')
      .update({
        pending_deletion_at: null,
        delete_scheduled_for: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (uErr) throw uErr;

    await client.from('account_deletion_log').insert({
      user_id: userId,
      event: 'cancelled',
    });

    await writeAuditLog({
      actorId: userId,
      actorType: 'user',
      action: 'account.deletion_cancelled',
      targetTable: 'profiles',
      targetId: userId,
    });

    log('info', 'cancel-account-deletion', 'cancelled', { userId });
    return { cancelled: true };
  },
}));
