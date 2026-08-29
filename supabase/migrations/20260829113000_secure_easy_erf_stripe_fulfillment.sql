-- Secure the existing empty report_orders table for the R999 Easy Erf
-- human-reviewed investigation. This migration deliberately reuses the
-- canonical order surface instead of creating a competing payment ledger.

begin;

alter table public.report_orders
  alter column user_id drop not null,
  alter column parcel_id drop not null,
  alter column provider_id drop not null;

-- The original policies allowed authenticated customers to insert and update
-- every order field on their own rows, including paid/ready status and price.
-- Payment and fulfilment state must only be written by the signed Stripe
-- webhook or a future audited founder operation.
drop policy if exists "Users can manage own report orders" on public.report_orders;
drop policy if exists "Users manage own report orders" on public.report_orders;
drop policy if exists "Users read own report orders" on public.report_orders;
drop policy if exists "Admins read report orders" on public.report_orders;

alter table public.report_orders enable row level security;

create policy "Users read own report orders"
on public.report_orders
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins read report orders"
on public.report_orders
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke insert, update, delete on table public.report_orders from anon, authenticated;
grant select on table public.report_orders to authenticated;
grant select, insert, update on table public.report_orders to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.report_orders'::regclass
      and conname = 'report_orders_provider_order_ref_key'
  ) then
    alter table public.report_orders
      add constraint report_orders_provider_order_ref_key unique (provider_order_ref);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.report_orders'::regclass
      and conname = 'report_orders_price_cents_nonnegative'
  ) then
    alter table public.report_orders
      add constraint report_orders_price_cents_nonnegative check (price_cents >= 0);
  end if;
end
$$;

create index if not exists report_orders_order_kind_idx
  on public.report_orders ((payload ->> 'orderKind'));

create index if not exists report_orders_status_created_at_idx
  on public.report_orders (status_enum, created_at desc);

create or replace function public.record_easy_erf_stripe_payment(
  p_provider_order_ref text,
  p_event_id text,
  p_payment_link_id text,
  p_payment_intent_id text,
  p_customer_id text,
  p_client_reference_id text,
  p_customer_email text,
  p_customer_name text,
  p_property_reference text,
  p_investigation_request text,
  p_currency text,
  p_amount_total integer,
  p_livemode boolean,
  p_matched_user_id uuid default null,
  p_matched_parcel_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_now timestamptz := now();
  v_payload jsonb;
begin
  if nullif(btrim(p_provider_order_ref), '') is null then
    raise exception 'Stripe Checkout Session id is required';
  end if;

  if nullif(btrim(p_event_id), '') is null then
    raise exception 'Stripe event id is required';
  end if;

  if nullif(btrim(p_payment_link_id), '') is null then
    raise exception 'Stripe Payment Link id is required';
  end if;

  if lower(coalesce(p_currency, '')) <> 'zar' or p_amount_total <> 99900 then
    raise exception 'Unexpected Easy Erf R999 amount or currency';
  end if;

  if nullif(btrim(p_customer_email), '') is null then
    raise exception 'Customer email is required';
  end if;

  if nullif(btrim(p_property_reference), '') is null then
    raise exception 'Property reference is required';
  end if;

  v_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'orderKind', 'easy_erf_investigation',
      'stripeEventId', btrim(p_event_id),
      'stripeCheckoutSessionId', btrim(p_provider_order_ref),
      'stripePaymentLinkId', btrim(p_payment_link_id),
      'stripePaymentIntentId', nullif(btrim(coalesce(p_payment_intent_id, '')), ''),
      'stripeCustomerId', nullif(btrim(coalesce(p_customer_id, '')), ''),
      'clientReferenceId', nullif(btrim(coalesce(p_client_reference_id, '')), ''),
      'customerEmail', lower(btrim(p_customer_email)),
      'customerName', nullif(btrim(coalesce(p_customer_name, '')), ''),
      'propertyReference', btrim(p_property_reference),
      'investigationRequest', nullif(btrim(coalesce(p_investigation_request, '')), ''),
      'currency', 'zar',
      'paymentStatus', 'paid',
      'livemode', p_livemode,
      'recordedAt', v_now
    )
  );

  insert into public.report_orders (
    user_id,
    parcel_id,
    report_type,
    status,
    price_cents,
    provider,
    payload,
    status_enum,
    provider_id,
    provider_order_ref,
    created_at,
    updated_at
  )
  values (
    p_matched_user_id,
    nullif(btrim(coalesce(p_matched_parcel_id, '')), ''),
    'Easy Erf Property Investigation',
    'paid',
    p_amount_total,
    'stripe',
    v_payload,
    'paid'::public.report_order_status,
    null,
    btrim(p_provider_order_ref),
    v_now,
    v_now
  )
  on conflict (provider_order_ref) do update
  set
    user_id = coalesce(public.report_orders.user_id, excluded.user_id),
    parcel_id = coalesce(public.report_orders.parcel_id, excluded.parcel_id),
    price_cents = excluded.price_cents,
    provider = 'stripe',
    payload = public.report_orders.payload || excluded.payload,
    status = case
      when public.report_orders.status in ('pending', 'paid') then 'paid'
      else public.report_orders.status
    end,
    status_enum = case
      when public.report_orders.status_enum in (
        'pending'::public.report_order_status,
        'paid'::public.report_order_status
      ) then 'paid'::public.report_order_status
      else public.report_orders.status_enum
    end,
    updated_at = v_now
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.record_easy_erf_stripe_payment(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.record_easy_erf_stripe_payment(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  uuid,
  text
) to service_role;

comment on function public.record_easy_erf_stripe_payment(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  uuid,
  text
) is 'Records one verified Easy Erf R999 Stripe payment without regressing later fulfilment status.';

commit;
