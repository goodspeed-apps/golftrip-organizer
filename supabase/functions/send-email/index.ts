import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { adminHandler } from '../_shared/edge-handler.ts';
import { handleSendEmail } from './handler.ts';

serve(adminHandler({
  name: 'send-email',
  handler: handleSendEmail as (body: Record<string, unknown>) => Promise<unknown>,
  errorCode: 'send_email_error',
}));