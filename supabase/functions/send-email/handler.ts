// supabase/functions/send-email/handler.ts

import { serviceClient } from '../_shared/edge-client.ts';
import { log } from '../_shared/edge-logger.ts';
import { HttpError } from '../_shared/http-error.ts';
import { welcome } from './templates/welcome.ts';
import { passwordReset } from './templates/password-reset.ts';
import { receipt } from './templates/receipt.ts';
import { accountDeletionScheduled } from './templates/account-deletion-scheduled.ts';
import { dataExport } from './templates/data-export.ts';

type TemplateVars = Record<string, string>;
interface Template {
  subject: (vars: TemplateVars) => string;
  html: (vars: TemplateVars) => string;
  text: (vars: TemplateVars) => string;
}

const templates: Record<string, Template> = {
  welcome: welcome as Template,
  password_reset: passwordReset as Template,
  receipt: receipt as Template,
  account_deletion_scheduled: accountDeletionScheduled as Template,
  data_export: dataExport as Template,
};

export type TemplateKey = keyof typeof templates;

export interface SendEmailPayload {
  template: TemplateKey;
  to: string;
  vars: Record<string, string>;
  userId?: string;
}

export async function handleSendEmail(
  raw: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ id: string; status: 'sent' | 'failed'; messageId?: string }> {
const payload = raw as unknown as SendEmailPayload;
  if (!payload.template || !templates[payload.template]) {
    throw new HttpError(400, `send_email: unknown template "${String(payload.template)}"`);
  }
  if (!payload.to) throw new HttpError(400, 'send_email: missing to');

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new HttpError(503, 'Email not configured');
  }

  const from = Deno.env.get('EMAIL_FROM') ?? 'no-reply@example.com';
  const tpl = templates[payload.template];
  const subject = tpl.subject(payload.vars);
  const html = tpl.html(payload.vars);
  const text = tpl.text(payload.vars);

  const client = serviceClient();
  const { data: logRow, error: logErr } = await client.from('email_log').insert({
    user_id: payload.userId ?? null,
    template: payload.template,
    to_address: payload.to,
    subject,
    status: 'pending',
  }).select('id').single();
  if (logErr) throw logErr;

  try {
const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: payload.to, subject, html, text }),
      signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`resend_http_${res.status}: ${txt}`);
    }
    const out = await res.json();
    await client.from('email_log').update({
      status: 'sent',
      resend_message_id: out?.id ?? null,
      sent_at: new Date().toISOString(),
    }).eq('id', logRow.id);
    log('info', 'send-email', 'sent', { template: payload.template, id: logRow.id });
    return { id: logRow.id, status: 'sent', messageId: out?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await client.from('email_log').update({ status: 'failed', error: msg }).eq('id', logRow.id);
    throw e;
  }
}