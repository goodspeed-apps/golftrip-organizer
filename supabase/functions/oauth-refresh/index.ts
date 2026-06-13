// supabase/functions/oauth-refresh/index.ts
// This file is NOT an HTTP endpoint.
// The oauth_refresh job kind is dispatched by job-worker/index.ts.
// See handler.ts for implementation.

export { handleOauthRefresh } from './handler.ts';
