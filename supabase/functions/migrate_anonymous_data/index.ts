// supabase/functions/migrate_anonymous_data/index.ts
// Entry point — thin wrapper around handler.ts so tests can import handler
// directly without touching Deno std URL imports.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleMigrateAnonymous } from './handler.ts';

serve(handleMigrateAnonymous);