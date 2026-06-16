// supabase/functions/_shared/edge-client.ts
// Service-role Supabase client for Edge Functions.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

let _serviceClient: SupabaseClient | undefined;

export function serviceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  _serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return _serviceClient;
}

export function userClient(authHeader: string | null): SupabaseClient {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('userClient requires a Bearer Authorization header; use serviceClient() for server-side calls');
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}