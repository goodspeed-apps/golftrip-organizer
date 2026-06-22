# Push Receipt Polling

## What it does

When `send_push` dispatches notifications to Expo, Expo returns a ticket per message. Each ticket has an `id` (receipt ID) that can be queried later to confirm whether the notification was actually delivered to the device.

`send_push` writes one row per successful ticket to the `push_deliveries` table (status `pending`). The `check_push_receipts` Edge Function runs on a 5-minute cron, queries Expo's `getReceipts` endpoint for those pending rows, and updates each row with the final delivery status (`ok`, `error`, or `expired`).

## How send_push writes push_deliveries rows

After each batch of messages is sent to Expo:

- For every ticket where Expo returned a receipt ID (ticket status is not an error), `send_push` inserts a row into `push_deliveries` with:
  - `receipt_id` - the Expo ticket ID to poll
  - `push_token` - the device token that was targeted
  - `user_id` - the user who owns that token
  - `status` - `pending`
  - `sent_at` - current timestamp

Tickets that Expo immediately rejected (e.g. malformed token) do not get a row because there is nothing to poll.

## Cron schedule

The default schedule is every 5 minutes: `*/5 * * * *`.

This is defined in `supabase/functions/check_push_receipts/cron.json` and mirrors `gasConfig.features.notifications.receiptPolling.intervalMinutes`.

## Inspecting delivery stats

Run this query against your Supabase database to see a breakdown of delivery outcomes:

SELECT status, count(*) FROM push_deliveries GROUP BY status;

To see recent failures with error details:

SELECT receipt_id, push_token, error_code, error_message, settled_at
FROM push_deliveries
WHERE status = 'error'
ORDER BY settled_at DESC
LIMIT 50;

To see rows still pending after more than 10 minutes (possible polling failure):

SELECT count(*)
FROM push_deliveries
WHERE status = 'pending'
  AND sent_at < now() - interval '10 minutes';

## DeviceNotRegistered cleanup

When Expo returns a receipt with `details.error = 'DeviceNotRegistered'`, the device has uninstalled the app or revoked push permission. `check_push_receipts` automatically deletes the corresponding row from `push_tokens` so future sends skip that device.

No manual cleanup is needed. This mirrors the same cleanup that `send_push` performs at dispatch time for tickets that return `DeviceNotRegistered` immediately.

## Row expiry

Rows that are still `pending` after 30 minutes are marked `expired` (status `expired`, `settled_at` set). This threshold matches `gasConfig.features.notifications.receiptPolling.expireAfterMinutes`. Expired rows indicate Expo never returned a receipt, which typically means the notification was silently dropped.

## Troubleshooting

**Rows stuck in pending status**

The most common cause is a transient Expo API failure. `check_push_receipts` retries each batch up to 3 times with backoff, but if Expo is down for an entire 5-minute window the rows remain pending. The next cron run will retry them. Check Supabase Edge Function logs for `Expo receipts API error` messages.

**No rows appearing in push_deliveries**

Check that `send_push` is running the version that includes the `push_deliveries` insert (cluster 7 Task 2 and later). Earlier versions did not write delivery rows.

**tokensRemoved count unexpectedly high**

A spike in `DeviceNotRegistered` errors usually means a batch of users uninstalled the app or their OS revoked push permission (common after iOS updates). This is normal. The stale tokens are cleaned up automatically.

**audit_log entries**

Every poll run writes an `audit_log` row with `action = 'push_receipts_polled'` and `target_data` containing `{ polled, ok, error, expired, tokensRemoved }`. Query it to trace polling history:

SELECT created_at, target_data
FROM audit_log
WHERE action = 'push_receipts_polled'
ORDER BY created_at DESC
LIMIT 20;

## Required secrets

- **`CRON_SECRET`** - shared secret sent in the `x-cron-secret` header by the Supabase cron scheduler to authenticate the invocation. This is the same secret used by other cron-triggered functions (cluster 1 / cluster 2). Set it with:

supabase secrets set CRON_SECRET=<your-secret>

The Edge Function rejects any call that does not supply this header with the correct value.

## Cron setup

Supabase supports scheduled Edge Function invocations via pg_cron or the Supabase dashboard.

To register the schedule using the Supabase CLI:

supabase functions deploy check_push_receipts

Then configure the cron trigger in the Supabase dashboard under Database > Cron Jobs, or via SQL:

select cron.schedule(
  'check-push-receipts',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/check_push_receipts',
      headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);

Replace `<project-ref>` with your Supabase project reference and `<CRON_SECRET>` with the value you set in secrets.