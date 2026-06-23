// User-auth-gated. POST { immediate?: boolean, reason?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { userHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { log } from '../_shared/edge-logger.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { enqueueJob } from '../_shared/jobs.ts';
import { appName } from '../_shared/app-config.ts';
import { getComplianceConfig } from '../_shared/compliance-config.ts';

serve(userHandler({
  name: 'request-account-deletion',
  errorCode: 'deletion_request_error',
  handler: async ({ userId, body }) => {
    const { accountDeletionGraceDays, allowImmediateDeletion } = getComplianceConfig();
    const immediate = body?.immediate === true && allowImmediateDeletion;
    const reason: string | null = typeof body?.reason === 'string' ? (body.reason as string) : null;

    const client = serviceClient();
    const scheduledFor = immediate
      ? new Date()
      : new Date(Date.now() + accountDeletionGraceDays * 86_400_000);

    const { error: pErr } = await client.from('profiles')
      .update({
        pending_deletion_at: new Date().toISOString(),
        delete_scheduled_for: scheduledFor.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (pErr) throw pErr;

    await client.from('account_deletion_log').insert({
      user_id: userId,
      event: 'requested',
      scheduled_for: scheduledFor.toISOString(),
      reason,
      immediate,
    });

    await writeAuditLog({
      actorId: userId,
      actorType: 'user',
      action: 'account.deletion_requested',
      targetTable: 'profiles',
      targetId: userId,
      targetData: { immediate, scheduled_for: scheduledFor.toISOString() },
      piiClass: 'standard',
    });

    if (immediate) {
      await enqueueJob({ kind: 'purge_account', payload: { userId } });
    } else {
      const { data: userData } = await client.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await enqueueJob({
          kind: 'send_email',
          payload: {
            template: 'account_deletion_scheduled',
            to: email,
            vars: { appName: appName(), scheduledFor: scheduledFor.toISOString() },
            userId,
          },
        });
      }
    }

    log('info', 'request-account-deletion', 'scheduled', { userId, immediate, scheduledFor });
    return { scheduled_for: scheduledFor.toISOString(), immediate };
  },
}));
