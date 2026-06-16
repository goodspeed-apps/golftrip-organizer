-- Lock down SECURITY DEFINER credit functions: service_role only.
-- Audit finding C-1 / P7-1: default-PUBLIC EXECUTE allowed authenticated
-- users to drain anyone's credits via PostgREST RPC.

alter function public.spend_credits(uuid, integer, text, uuid) set search_path = public, pg_temp;
alter function public.grant_signup_credits(uuid, integer) set search_path = public, pg_temp;

revoke execute on function public.spend_credits(uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.grant_signup_credits(uuid, integer) from public, anon, authenticated;

grant execute on function public.spend_credits(uuid, integer, text, uuid) to service_role;
grant execute on function public.grant_signup_credits(uuid, integer) to service_role;
