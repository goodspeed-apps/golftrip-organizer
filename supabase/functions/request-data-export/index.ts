// supabase/functions/request-data-export/index.ts
// User-auth-gated. POST {} — enqueues a background data-export build.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { userHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { log } from '../_shared/edge-logger.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { enqueueJob } from '../_shared/jobs.ts';

serve(userHandler({
  name: 'request-data-export',
  errorCode: 'export_request_error',
  handler: async ({ userId }) => {
    const client = serviceClient();
    const { data: row, error: insErr } = await client
      .from('data_export_requests')
      .insert({ user_id: userId, status: 'pending' })
      .select('id')
      .single();
    if (insErr) throw insErr;

    await enqueueJob({
      kind: 'build_data_export',
      payload: { requestId: row.id, userId },
    });

    await writeAuditLog({
      actorId: userId,
      actorType: 'user',
      action: 'export.requested',
      targetTable: 'data_export_requests',
      targetId: row.id,
    });

    log('info', 'request-data-export', 'queued', { requestId: row.id, userId });
    return { requestId: row.id, status: 'pending' };
  },
}));
