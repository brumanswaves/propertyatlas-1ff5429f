\set ON_ERROR_STOP on

-- Isolated PostgreSQL only. The existing payment/report/email proofs run first.
\i scripts/verify-easy-erf-customer-notification.sql
\i supabase/migrations/20260907100000_founder_queue_metadata_read.sql

create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;

insert into public.report_orders (
  id, user_id, parcel_id, report_type, status, status_enum, provider, price_cents,
  payload, review_focus, review_content
) values
(
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'csg:lpi:c03400140000157000000', 'human_review', 'processing', 'fulfilling', 'stripe', 99900,
  '{"propertyReference":"PRIVATE_ADDRESS_SENTINEL","customerEmail":"PRIVATE_CUSTOMER_SENTINEL","livemode":false,"nested":"PRIVATE_PAYLOAD_SENTINEL"}',
  'property_check',
  '{"bottomLine":"PRIVATE_REPORT_SENTINEL","customerNotification":{"recipient":"PRIVATE_RECEIPT_SENTINEL"}}'
),
(
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'csg:lpi:c03400140000157000000', 'human_review', 'paid', 'paid', 'stripe', 99900,
  '{"propertyReference":"Another synthetic property","livemode":false}', 'property_check', null
);

create temp table queue_read_baseline as
select
  (select md5(string_agg(to_jsonb(r)::text, '' order by id)) from public.report_orders r) as row_hash,
  (select count(*) from public.report_order_events) as event_count;

do $$
begin
  if has_function_privilege('anon', 'public.list_easy_erf_founder_queue(integer)', 'EXECUTE') then
    raise exception 'Anonymous queue execution is permitted';
  end if;
  if not has_function_privilege('authenticated', 'public.list_easy_erf_founder_queue(integer)', 'EXECUTE') then
    raise exception 'Authenticated queue execution is unavailable';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.list_easy_erf_founder_queue(integer)'::regprocedure) then
    raise exception 'Queue reader must not bypass caller RLS';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  begin
    perform public.list_easy_erf_founder_queue();
    raise exception 'Non-admin queue read was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare
  v_rows jsonb;
  v_row jsonb;
  v_keys text[];
begin
  select jsonb_agg(to_jsonb(q)) into v_rows from public.list_easy_erf_founder_queue() q;
  if v_rows is null or v_rows::text like '%PRIVATE_%' then
    raise exception 'Queue omitted rows or leaked private source values';
  end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    select array_agg(key order by key) into v_keys from jsonb_object_keys(v_row) as k(key);
    if v_keys <> array[
      'completed_at','created_at','has_property_reference','has_report_content','has_review_focus',
      'id','parcel_id','payment_mode','price_cents','provider','report_type','status','status_enum','updated_at'
    ] then raise exception 'Unexpected queue projection keys: %', v_keys; end if;
  end loop;
  if not exists (
    select 1 from public.list_easy_erf_founder_queue() q
    where id = '33333333-3333-4333-8333-333333333333'
      and has_report_content and has_property_reference and has_review_focus and payment_mode = 'TEST'
  ) then raise exception 'Existing report flags were not computed correctly'; end if;
  if not exists (
    select 1 from public.list_easy_erf_founder_queue() q
    where id = '44444444-4444-4444-8444-444444444444'
      and status = 'paid' and not has_report_content
  ) then raise exception 'New paid order without a final report disappeared'; end if;
  if (select count(*) from public.list_easy_erf_founder_queue(1)) <> 1 then
    raise exception 'Queue limit was not enforced';
  end if;
  begin
    perform public.list_easy_erf_founder_queue(101);
    raise exception 'Unbounded queue read was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- Prove that an explicit admin check does not silently bypass table RLS.
begin;
drop policy "Admins read report orders" on public.report_orders;
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.list_easy_erf_founder_queue()
    where id in ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')
  ) then raise exception 'Queue reader bypassed caller table RLS'; end if;
end $$;
rollback;

do $$
begin
  if (select row_hash from queue_read_baseline) is distinct from
    (select md5(string_agg(to_jsonb(r)::text, '' order by id)) from public.report_orders r)
    or (select event_count from queue_read_baseline) <> (select count(*) from public.report_order_events)
  then raise exception 'Read-only queue changed orders or audit events'; end if;
end $$;

select 'Founder queue privacy and RLS proof passed' as result;
