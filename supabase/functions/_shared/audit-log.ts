// Write helper for the audit_log table. Failures log but never throw.

import { serviceClient } from './edge-client.ts';
import { log } from './edge-logger.ts';

// Sets request.actor_id / request.actor_type GUCs so the audit_trigger on
// downstream service-role writes attributes to the calling user, not 'service_role'.
// Transaction-local — safe on a pooled connection. Call once per request after auth.
export async function setActorContext(
  actorId: string,
  actorType: 'user' | 'admin' = 'user',
): Promise<void> {
  try {
    const client = serviceClient();
    const { error } = await client.rpc('set_actor_context', {
      p_actor_id: actorId,
      p_actor_type: actorType,
    });
    if (error) log('warn', 'audit-log', 'set_actor_context_failed', { error: String(error) });
  } catch (e) {
    log('warn', 'audit-log', 'set_actor_context_exception', { error: String(e) });
  }
}

export interface AuditLogParams {
  actorId?: string | null;
  actorType: 'user' | 'admin' | 'system' | 'service_role';
  action: string;
  targetTable?: string;
  targetId?: string;
  targetData?: Record<string, unknown>;
  piiClass?: 'standard' | 'phi' | 'highly_sensitive';
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export async function writeAuditLog(p: AuditLogParams): Promise<void> {
  if (!p.action || !p.actorType) {
    log('warn', 'audit-log', 'invalid_params', { params: p });
    return;
  }
  try {
    const client = serviceClient();
    const { error } = await client.from('audit_log').insert({
      actor_id: p.actorId ?? null,
      actor_type: p.actorType,
      action: p.action,
      target_table: p.targetTable ?? null,
      target_id: p.targetId ?? null,
      target_data: p.targetData ?? null,
      pii_class: p.piiClass ?? 'standard',
      ip_address: p.ipAddress ?? null,
      user_agent: p.userAgent ?? null,
      request_id: p.requestId ?? null,
    });
    if (error) {
      log('warn', 'audit-log', 'insert_failed', { error: String(error), action: p.action });
    }
  } catch (e) {
    log('warn', 'audit-log', 'exception', { error: String(e), action: p.action });
  }
}