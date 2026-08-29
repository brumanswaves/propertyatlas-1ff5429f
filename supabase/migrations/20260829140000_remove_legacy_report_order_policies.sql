-- Complete the R999 fulfillment security cutover for deployments whose
-- historical report-order policies were created with lowercase names.
-- PostgreSQL quoted policy names are case-sensitive, so the earlier cleanup
-- could not remove these exact legacy objects.

begin;

drop policy if exists "users manage own report orders" on public.report_orders;
drop policy if exists "users can manage own report orders" on public.report_orders;
drop policy if exists "admins read all report orders" on public.report_orders;
drop policy if exists "Admins read all report orders" on public.report_orders;

-- Keep customer order access read-only even if this migration is replayed
-- against a database with additional historical grants.
revoke insert, update, delete on table public.report_orders from anon, authenticated;

commit;
