#!/usr/bin/env bash
set -euo pipefail

# Generates types/database.ts from the linked Supabase project schema.
# Requires `supabase login` + `supabase link --project-ref <ref>` to be run once locally.

if ! command -v supabase &> /dev/null; then
  echo "⚠️  supabase CLI not installed — skipping. Install: brew install supabase/tap/supabase"
  exit 0
fi

if [ ! -f .supabase/config.toml ] && [ ! -d supabase ]; then
  echo "⚠️  No Supabase project linked — skipping. Run: supabase link --project-ref <ref>"
  exit 0
fi

echo "▸ Generating types/database.ts..."
supabase gen types typescript --linked > types/database.ts.tmp
mv types/database.ts.tmp types/database.ts
echo "✅ types/database.ts updated."
