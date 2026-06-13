// Single source of truth for APP_NAME and other runtime config that every
// Edge Function may need. Centralized so the fallback string lives in one
// place and operators only set APP_NAME once.

export function appName(): string {
  return Deno.env.get('APP_NAME') ?? 'this app';
}
