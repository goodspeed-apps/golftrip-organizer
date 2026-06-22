import { serviceClient } from '../_shared/edge-client.ts';
import { signPayload } from '../_shared/webhook-sig.ts';
import { log } from '../_shared/edge-logger.ts';

export interface DispatchPayload {
  webhookId: string;
}

export async function handleDispatchOutboundWebhook(
  raw: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ status: 'delivered' | 'failed'; httpStatus: number }> {
  const { webhookId } = raw as unknown as DispatchPayload;
  if (!webhookId) throw new Error('dispatch_outbound_webhook: missing webhookId');

  const client = serviceClient();
  const { data: row, error: readErr } = await client
    .from('webhooks_out')
    .select('*')
    .eq('id', webhookId)
    .single();
  if (readErr) throw readErr;

  const body = JSON.stringify(row.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedString = `${timestamp}.${body}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(row.headers ?? {}),
  };
  if (row.secret) {
    const sig = await signPayload(row.secret, signedString);
    headers['X-Signature-SHA256'] = sig;
    headers['X-Timestamp'] = timestamp;
  }

  let res: Response;
  try {
    res = await fetch(row.url, { method: row.method ?? 'POST', headers, body, signal });
  } catch (e) {
    await client.from('webhooks_out').update({
      attempts: (row.attempts ?? 0) + 1,
      last_error: e instanceof Error ? e.message : String(e),
    }).eq('id', webhookId);
    throw e;
  }

  const responseBody = await res.text();
  if (!res.ok) {
    await client.from('webhooks_out').update({
      attempts: (row.attempts ?? 0) + 1,
      response_status: res.status,
      response_body: responseBody.slice(0, 4000),
      last_error: `http_${res.status}`,
    }).eq('id', webhookId);
    throw new Error(`outbound_webhook_http_${res.status}`);
  }

  await client.from('webhooks_out').update({
    status: 'delivered',
    attempts: (row.attempts ?? 0) + 1,
    response_status: res.status,
    response_body: responseBody.slice(0, 4000),
    delivered_at: new Date().toISOString(),
  }).eq('id', webhookId);
  log('info', 'dispatch-outbound-webhook', 'delivered', { webhookId });
  return { status: 'delivered', httpStatus: res.status };
}