-- Storage bucket RLS for the recommended template buckets.
-- Operator workflow:
--   1. Create the buckets via the Supabase dashboard (Storage → New bucket) OR
--      via the Storage Management API (recommended for IaC). Names:
--        avatars      — public read, auth user writes to <user_id>/...
--        attachments  — auth user reads + writes to <user_id>/...
--        private      — service_role only
--   2. Run this file via psql or the Supabase SQL editor to apply RLS.
--
-- Wrapped in a single transaction so a mid-file failure rolls back cleanly
-- instead of leaving the storage.objects policies in a partial state.

begin;

-- avatars: public read, auth user can upload/update/delete in their own folder
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

drop policy if exists "avatars_user_write" on storage.objects;
create policy "avatars_user_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- attachments: auth user reads + writes own folder
drop policy if exists "attachments_user_read" on storage.objects;
create policy "attachments_user_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments_user_write" on storage.objects;
create policy "attachments_user_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- private: service_role only (no policy = no access for other roles)
drop policy if exists "private_service_role_only" on storage.objects;
create policy "private_service_role_only"
  on storage.objects for all
  to service_role
  using (bucket_id = 'private')
  with check (bucket_id = 'private');

commit;