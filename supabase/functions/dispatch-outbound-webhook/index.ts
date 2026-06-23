import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { adminHandler } from '../_shared/edge-handler.ts';
import { handleDispatchOutboundWebhook } from './handler.ts';

serve(adminHandler({
  name: 'dispatch-outbound-webhook',
  handler: handleDispatchOutboundWebhook as (body: Record<string, unknown>) => Promise<unknown>,
  errorCode: 'dispatch_error',
}));