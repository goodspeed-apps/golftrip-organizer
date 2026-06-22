# Anonymous Auth

Anonymous auth lets users interact with your app before creating a permanent account. When they decide to sign up, their data migrates to the new account automatically.

## What it is

Supabase supports creating an anonymous session with `supabase.auth.signInAnonymously()`. The user gets a real `auth.users` row and a valid JWT but no email or password yet. They can create, read, and update rows in any table that has an RLS policy allowing their `user_id`.

When the user signs up or links an OAuth provider, Supabase upgrades the same session to a permanent account. The `upgradeAnonymousAccount` service function then calls the `migrate_anonymous_data` edge function, which runs a single transactional SQL function to re-assign all rows from the old anonymous `user_id` to the new permanent `user_id`.

## How to opt in

Set `anonymousAuth.enabled = true` and list every table whose rows should migrate:

```ts
// gas.config.ts
features: {
  anonymousAuth: {
    enabled: true,
    tables: ['todos', 'preferences', 'draft_posts'],
  },
}
```

The `tables` array is passed directly to the `migrate_anonymous_user_data` SQL function. Only tables in this list are touched; everything else is left as-is.

## Table requirements

Every table in `anonymousAuth.tables` must:

- Have a `user_id uuid` column that references `auth.users(id)`.
- Allow the anonymous user to insert rows (RLS policy for the `anon` or `authenticated` role with `user_id = auth.uid()` check).
- Allow the `service_role` to update `user_id` (service role bypasses RLS by default).

Tables that do not meet these requirements will cause the migration SQL function to raise an error, which rolls back the entire migration atomically.

## Calling the service functions

Sign in anonymously at app launch (or on first meaningful action):

```ts
import { signInAnonymously } from '@/services/auth';

const { userId } = await signInAnonymously();
```

Upgrade to a permanent account when the user submits a sign-up form:

```ts
import { upgradeAnonymousAccount } from '@/services/auth';

// Email/password
const result = await upgradeAnonymousAccount({ email, password });

// OAuth
const result = await upgradeAnonymousAccount({ provider: 'apple', idToken, nonce });
```

## Conflict UX

If the user tries to sign up with an email that already has an account, `upgradeAnonymousAccount` returns `{ migrated: 0, conflictWith: email }` without throwing. Use the `useAnonymousMigration` hook to surface this state in your UI:

```ts
import { useAnonymousMigration } from '@/hooks/useAnonymousMigration';

const { upgrade, isLoading, error, conflict } = useAnonymousMigration();

// After calling upgrade({ email, password }):
if (conflict) {
  // Show: "An account already exists for this email. Sign in instead?"
  // Navigate to sign-in screen pre-filled with conflict.email
}
```

The anonymous session remains active after a conflict — the user has not lost any data. Prompt them to sign in with the existing account and their anonymous data will remain unreachable until they retry with different credentials.

## Testing locally

- Run `supabase start` to bring up the local stack.
- Enable anonymous sign-in in the Supabase dashboard under Authentication > Providers > Anonymous.
- Sign in anonymously and create some rows in a table listed in `anonymousAuth.tables`.
- Call `upgradeAnonymousAccount` with a new email.
- Inspect the `anonymous_migrations` table to confirm a row with `status = 'completed'` and correct `table_rowcounts`.
- Verify rows in your app tables now have `user_id` set to the permanent user's id.

To simulate a conflict, create a permanent user first, then attempt to upgrade an anonymous session using that user's email. The `anonymous_migrations` table should have no new row (the function returns early before inserting).

To simulate a migration failure, temporarily rename a column in one of the listed tables and trigger the migration. The `anonymous_migrations` row should show `status = 'failed'` and the `error` field will contain the Postgres error message.
