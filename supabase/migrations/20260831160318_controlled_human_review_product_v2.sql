begin;

create table public.human_review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  parcel_id text null,
  property_reference_hint text null,
  focus text not null,
  intended_use text null,
  context text null,
  source_surface text null,
  status text not null default 'checkout_started',
  report_order_id uuid null unique references public.report_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_review_requests_focus_check check (
    focus in ('property_check', 'before_i_buy', 'property_potential', 'intended_use')
  ),
  constraint human_review_requests_intended_use_check check (
    (focus = 'intended_use' and intended_use in (
      'single_dwelling',
      'second_dwelling',
      'renovate_extend',
      'subdivide',
      'rental_property',
      'vacant_land_hold'
    ))
    or (focus <> 'intended_use' and intended_use is null)
  ),
  constraint human_review_requests_context_length check (
    context is null or char_length(context) <= 600
  ),
  constraint human_review_requests_reference_length check (
    property_reference_hint is null or char_length(property_reference_hint) <= 255
  ),
  constraint human_review_requests_source_length check (
    source_surface is null or char_length(source_surface) <= 80
  ),
  constraint human_review_requests_status_check check (
    status in ('checkout_started', 'paid', 'cancelled')
  )
);

alter table public.human_review_requests enable row level security;
revoke all on table public.human_review_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.human_review_requests to service_role;

create index human_review_requests_status_created_idx
  on public.human_review_requests (status, created_at desc);
create index human_review_requests_parcel_idx
  on public.human_review_requests (parcel_id)
  where parcel_id is not null;

alter table public.report_orders
  add column review_request_id uuid null unique references public.human_review_requests(id) on delete set null,
  add column review_focus text null,
  add column intended_use text null,
  add column review_context text null,
  add column review_content jsonb null,
  add column reviewed_by uuid null references auth.users(id) on delete set null,
  add column review_content_updated_at timestamptz null,
  add constraint report_orders_review_focus_check check (
    review_focus is null or review_focus in (
      'property_check',
      'before_i_buy',
      'property_potential',
      'intended_use'
    )
  ),
  add constraint report_orders_intended_use_check check (
    (review_focus = 'intended_use' and intended_use in (
      'single_dwelling',
      'second_dwelling',
      'renovate_extend',
      'subdivide',
      'rental_property',
      'vacant_land_hold'
    ))
    or (coalesce(review_focus, '') <> 'intended_use' and intended_use is null)
  ),
  add constraint report_orders_review_context_length check (
    review_context is null or char_length(review_context) <= 600
  ),
  add constraint report_orders_review_content_object check (
    review_content is null or jsonb_typeof(review_content) = 'object'
  );

create index report_orders_review_focus_idx
  on public.report_orders (review_focus, created_at desc)
  where review_focus is not null;

create or replace function public.attach_easy_erf_human_review_request(
  p_report_order_id uuid,
  p_review_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.report_orders%rowtype;
  v_request public.human_review_requests%rowtype;
begin
  if p_report_order_id is null or p_review_request_id is null then
    raise exception 'Report order id and Human Review request id are required';
  end if;

  select * into v_order
  from public.report_orders
  where id = p_report_order_id
  for update;

  if not found then
    raise exception 'Report order not found';
  end if;

  if v_order.provider <> 'stripe'
     or coalesce(v_order.payload ->> 'orderKind', '') <> 'easy_erf_investigation' then
    raise exception 'Order is not an Easy Erf Stripe investigation';
  end if;

  select * into v_request
  from public.human_review_requests
  where id = p_review_request_id
  for update;

  if not found then
    raise exception 'Human Review request not found';
  end if;

  if v_request.report_order_id is not null and v_request.report_order_id <> p_report_order_id then
    raise exception 'Human Review request is already attached to another order';
  end if;

  if v_request.status not in ('checkout_started', 'paid') then
    raise exception 'Human Review request is not attachable';
  end if;

  update public.report_orders
  set review_request_id = v_request.id,
      review_focus = v_request.focus,
      intended_use = v_request.intended_use,
      review_context = v_request.context,
      parcel_id = coalesce(public.report_orders.parcel_id, v_request.parcel_id),
      updated_at = now()
  where id = p_report_order_id;

  update public.human_review_requests
  set status = 'paid',
      report_order_id = p_report_order_id,
      user_id = coalesce(user_id, v_order.user_id),
      parcel_id = coalesce(parcel_id, v_order.parcel_id),
      updated_at = now()
  where id = p_review_request_id;

  return p_report_order_id;
end;
$$;

revoke all on function public.attach_easy_erf_human_review_request(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.attach_easy_erf_human_review_request(uuid, uuid)
to service_role;

comment on table public.human_review_requests is
  'Service-role-only controlled Human Review briefs created before Stripe checkout. Customer context cannot change the permitted investigation scope.';
comment on function public.attach_easy_erf_human_review_request(uuid, uuid) is
  'Attaches one controlled pre-checkout Human Review brief to one verified Easy Erf Stripe report order.';
comment on column public.report_orders.review_content is
  'Structured founder-authored Human-Reviewed web report: bottom line, known, potential, risks, unknowns and next steps.';

commit;
