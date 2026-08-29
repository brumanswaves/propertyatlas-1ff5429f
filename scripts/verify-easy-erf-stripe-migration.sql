\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.report_order_status as enum ('pending', 'paid', 'processing', 'ready', 'failed');
create type public.provider_id as enum ('demo', 'lightstone', 'windeed', 'procompare');

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select false $$;

create table public.report_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  parcel_id text not null,
  report_type text not null,
  status text not null default 'pending',
  price_cents integer not null default 0,
  provider text not null default 'demo',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_enum public.report_order_status not null default 'pending'::public.report_order_status,
  provider_id public.provider_id not null default 'demo'::public.provider_id,
  provider_order_ref text,
  pdf_storage_path text,
  failure_reason text,
  completed_at timestamptz
);

alter table public.report_orders enable row level security;

create policy "Users can manage own report orders"
on public.report_orders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own report orders"
on public.report_orders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.report_orders to authenticated;

\i supabase/migrations/20260829113000_secure_easy_erf_stripe_fulfillment.sql

do $$
declare
  v_nullable_count integer;
  v_unsafe_policy_count integer;
  v_select_policy_count integer;
begin
  select count(*) into v_nullable_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'report_orders'
    and column_name in ('user_id', 'parcel_id', 'provider_id')
    and is_nullable = 'YES';

  if v_nullable_count <> 3 then
    raise exception 'Expected user_id, parcel_id and provider_id to be nullable';
  end if;

  select count(*) into v_unsafe_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'report_orders'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  if v_unsafe_policy_count <> 0 then
    raise exception 'Unsafe report_orders write policy remains';
  end if;

  select count(*) into v_select_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'report_orders'
    and cmd = 'SELECT'
    and policyname in ('Users read own report orders', 'Admins read report orders');

  if v_select_policy_count <> 2 then
    raise exception 'Expected two read-only report_orders policies';
  end if;

  if has_table_privilege('authenticated', 'public.report_orders', 'INSERT')
     or has_table_privilege('authenticated', 'public.report_orders', 'UPDATE')
     or has_table_privilege('authenticated', 'public.report_orders', 'DELETE') then
    raise exception 'Authenticated role still has report_orders write privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.report_orders', 'SELECT') then
    raise exception 'Authenticated role lost read access';
  end if;

  if not has_table_privilege('service_role', 'public.report_orders', 'INSERT')
     or not has_table_privilege('service_role', 'public.report_orders', 'UPDATE') then
    raise exception 'Service role does not have required report_orders write privileges';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.record_easy_erf_stripe_payment(text,text,text,text,text,text,text,text,text,text,text,integer,boolean,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute the payment recording function';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_easy_erf_stripe_payment(text,text,text,text,text,text,text,text,text,text,text,integer,boolean,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot execute the payment recording function';
  end if;
end
$$;

select public.record_easy_erf_stripe_payment(
  'cs_test_easy_erf_1',
  'evt_test_easy_erf_1',
  'plink_easy_erf_test',
  'pi_test_easy_erf_1',
  'cus_test_easy_erf_1',
  null,
  'customer@example.com',
  'Easy Erf Customer',
  'C03400140000157000000',
  'Can I build a second dwelling?',
  'zar',
  99900,
  false,
  null,
  'csg:lpi:c03400140000157000000'
) as first_order_id \gset

select public.record_easy_erf_stripe_payment(
  'cs_test_easy_erf_1',
  'evt_test_easy_erf_retry',
  'plink_easy_erf_test',
  'pi_test_easy_erf_1',
  'cus_test_easy_erf_1',
  null,
  'customer@example.com',
  'Easy Erf Customer',
  'C03400140000157000000',
  'Can I build a second dwelling?',
  'zar',
  99900,
  false,
  null,
  'csg:lpi:c03400140000157000000'
) as retry_order_id \gset

do $$
declare
  v_order public.report_orders%rowtype;
begin
  if :'first_order_id' <> :'retry_order_id' then
    raise exception 'Stripe retry created a duplicate report order';
  end if;

  select * into v_order
  from public.report_orders
  where provider_order_ref = 'cs_test_easy_erf_1';

  if v_order.status <> 'paid'
     or v_order.status_enum <> 'paid'::public.report_order_status
     or v_order.price_cents <> 99900
     or v_order.provider <> 'stripe'
     or v_order.provider_id is not null
     or v_order.parcel_id <> 'csg:lpi:c03400140000157000000'
     or v_order.payload ->> 'orderKind' <> 'easy_erf_investigation'
     or v_order.payload ->> 'stripeEventId' <> 'evt_test_easy_erf_retry' then
    raise exception 'Recorded Easy Erf order does not match the payment contract';
  end if;
end
$$;

update public.report_orders
set status = 'processing',
    status_enum = 'processing'::public.report_order_status,
    payload = payload || '{"founderReviewStarted":true}'::jsonb
where provider_order_ref = 'cs_test_easy_erf_1';

select public.record_easy_erf_stripe_payment(
  'cs_test_easy_erf_1',
  'evt_test_easy_erf_late_retry',
  'plink_easy_erf_test',
  'pi_test_easy_erf_1',
  'cus_test_easy_erf_1',
  null,
  'customer@example.com',
  'Easy Erf Customer',
  'C03400140000157000000',
  'Can I build a second dwelling?',
  'zar',
  99900,
  false,
  null,
  'csg:lpi:c03400140000157000000'
) as late_retry_order_id \gset

do $$
declare
  v_order public.report_orders%rowtype;
begin
  select * into v_order
  from public.report_orders
  where provider_order_ref = 'cs_test_easy_erf_1';

  if v_order.status <> 'processing'
     or v_order.status_enum <> 'processing'::public.report_order_status
     or coalesce((v_order.payload ->> 'founderReviewStarted')::boolean, false) is not true then
    raise exception 'Late Stripe retry regressed fulfillment progress';
  end if;
end
$$;

do $$
begin
  begin
    perform public.record_easy_erf_stripe_payment(
      'cs_test_wrong_amount',
      'evt_test_wrong_amount',
      'plink_easy_erf_test',
      null,
      null,
      null,
      'customer@example.com',
      null,
      'Erf 1570',
      null,
      'zar',
      99901,
      false,
      null,
      null
    );
    raise exception 'Wrong amount was accepted';
  exception
    when others then
      if sqlerrm = 'Wrong amount was accepted' then
        raise;
      end if;
      if sqlerrm not like '%Unexpected Easy Erf R999 amount or currency%' then
        raise exception 'Unexpected wrong-amount error: %', sqlerrm;
      end if;
  end;
end
$$;

select 'Easy Erf Stripe migration verification passed' as result;
