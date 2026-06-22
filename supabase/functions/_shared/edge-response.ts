// supabase/functions/_shared/edge-response.ts
// Standard HTTP response helpers for Edge Functions.

// Origins allowed to receive CORS headers.
// Read from env so each deployed project sets its own domains without touching code.
// Falls back to an empty list (all cross-origin requests blocked) if neither var is set.
function allowedOrigins(): string[] {
  const origins: string[] = [];
  const appUrl = Deno.env.get('APP_URL');
  const dashboardUrl = Deno.env.get('DASHBOARD_URL');
  if (appUrl) origins.push(appUrl.replace(/\/$/, ''));
  if (dashboardUrl) origins.push(dashboardUrl.replace(/\/$/, ''));
  return origins;
}

function corsOriginHeader(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin };
  }
  return {};
}

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json<T>(body: T, status = 200, req?: Request): Response {
  const originHeader = req ? corsOriginHeader(req) : {};
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseCorsHeaders, ...originHeader, 'Content-Type': 'application/json' },
  });
}

export function err(message: string, status = 400, code?: string, req?: Request): Response {
  const originHeader = req ? corsOriginHeader(req) : {};
  return new Response(
    JSON.stringify({ error: message, code: code ?? null }),
    { status, headers: { ...baseCorsHeaders, ...originHeader, 'Content-Type': 'application/json' } },
  );
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const originHeader = corsOriginHeader(req);
    return new Response('ok', { headers: { ...baseCorsHeaders, ...originHeader } });
  }
  return null;
}