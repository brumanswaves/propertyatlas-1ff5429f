begin;

create table if not exists public.report_order_events (
  id uuid primary key default gen_random_uuid(),
  report_order_id uuid not null references public.report_orders(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  from_status text not null,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.report_order_events enable row level security;

revoke all on table public.report_order_events from public, anon, authenticated;
grant select, insert on table public.report_order_events to service_role;

create index if not exists report_order_events_order_created_idx
  on public.report_order_events (report_order_id, created_at desc);

create or replace function public.transition_easy_erf_report_order(
  p_order_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_pdf_storage_path text default null,
  p_failure_reason text default null
)
returns public.report_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.report_orders%rowtype;
  v_from_status text;
  v_to_status text;
  v_note text;
begin
  if p_order_id is null then
    raise exception 'Report order id is required';
  end if;

  if p_actor_user_id is null then
    raise exception 'Founder actor id is required';
  end if;

  select * into v_order
  from public.report_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Report order not found';
  end if;

  if v_order.provider <> 'stripe'
     or coalesce(v_order.payload ->> 'orderKind', '') <> 'easy_erf_investigation' then
    raise exception 'Order is not an Easy Erf Stripe investigation';
  end if;

  v_from_status := coalesce(v_order.status_enum::text, v_order.status);

  case p_action
    when 'start_review' then
      if v_from_status <> 'paid' then
        raise exception 'Only paid orders can start review';
      end if;
      v_to_status := 'processing';
      update public.report_orders
      set status = 'processing',
          status_enum = 'processing'::public.report_order_status,
          failure_reason = null,
          updated_at = now()
      where id = p_order_id
      returning * into v_order;

    when 'mark_ready' then
      if v_from_status <> 'processing' then
        raise exception 'Only processing orders can be marked ready';
      end if;
      if nullif(btrim(coalesce(p_pdf_storage_path, '')), '') is null then
        raise exception 'A report PDF storage path is required before marking ready';
      end if;
      if length(p_pdf_storage_path) > 1024
         or p_pdf_storage_path like '%..%'
         or p_pdf_storage_path like '%://%' then
        raise exception 'Report PDF storage path is invalid';
      end if;
      v_to_status := 'ready';
      update public.report_orders
      set status = 'ready',
          status_enum = 'ready'::public.report_order_status,
          pdf_storage_path = btrim(p_pdf_storage_path),
          failure_reason = null,
          completed_at = now(),
          updated_at = now()
      where id = p_order_id
      returning * into v_order;

    when 'mark_failed' then
      if v_from_status not in ('paid', 'processing') then
        raise exception 'Only paid or processing orders can be marked failed';
      end if;
      if nullif(btrim(coalesce(p_failure_reason, '')), '') is null then
        raise exception 'A failure reason is required';
      end if;
      if length(p_failure_reason) > 1000 then
        raise exception 'Failure reason is too long';
      end if;
      v_to_status := 'failed';
      v_note := btrim(p_failure_reason);
      update public.report_orders
      set status = 'failed',
          status_enum = 'failed'::public.report_order_status,
          failure_reason = v_note,
          updated_at = now()
      where id = p_order_id
      returning * into v_order;

    else
      raise exception 'Unsupported fulfillment action';
  end case;

  insert into public.report_order_events (
    report_order_id,
    actor_user_id,
    action,
    from_status,
    to_status,
    note
  ) values (
    p_order_id,
    p_actor_user_id,
    p_action,
    v_from_status,
    v_to_status,
    v_note
  );

  return v_order;
end;
$$;

revoke all on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)
to service_role;

comment on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)
is 'Applies audited founder-only fulfillment transitions to paid Easy Erf Stripe investigation orders.';

commit;
