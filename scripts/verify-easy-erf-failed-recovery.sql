\set ON_ERROR_STOP on

-- Run after scripts/verify-easy-erf-founder-queue.sql in the same isolated PostgreSQL job.
-- The queue proof creates this paid synthetic Easy Erf order and the canonical fulfillment contracts.
\i supabase/migrations/20260911180000_recover_failed_easy_erf_investigation.sql

do $$
declare
  v_order_id uuid := '44444444-4444-4444-8444-444444444444'::uuid;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_row public.report_orders%rowtype;
  v_events_before integer;
  v_events_after integer;
  v_payload_before jsonb;
begin
  select payload, (select count(*) from public.report_order_events where report_order_id = v_order_id)
    into v_payload_before, v_events_before
  from public.report_orders
  where id = v_order_id;

  if v_payload_before is null then
    raise exception 'Synthetic paid order for recovery proof is missing';
  end if;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'start_review', v_actor_id, null, null
  );
  if v_row.status <> 'processing' or v_row.status_enum <> 'fulfilling'::public.report_order_status then
    raise exception 'Recovery proof could not start the paid investigation';
  end if;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'mark_failed', v_actor_id, null, 'Synthetic accidental-stop recovery proof'
  );
  if v_row.status <> 'failed'
     or v_row.status_enum <> 'failed'::public.report_order_status
     or v_row.failure_reason <> 'Synthetic accidental-stop recovery proof' then
    raise exception 'Failed state was not recorded as expected';
  end if;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'reopen_review', v_actor_id, null, null
  );
  if v_row.status <> 'processing'
     or v_row.status_enum <> 'fulfilling'::public.report_order_status
     or v_row.failure_reason is not null
     or v_row.completed_at is not null then
    raise exception 'Failed investigation did not reopen cleanly';
  end if;

  if v_row.payload is distinct from v_payload_before then
    raise exception 'Reopening a failed investigation changed its saved order payload';
  end if;

  select count(*) into v_events_after
  from public.report_order_events
  where report_order_id = v_order_id;
  if v_events_after <> v_events_before + 3 then
    raise exception 'Expected start, fail and reopen audit events; before %, after %', v_events_before, v_events_after;
  end if;

  if not exists (
    select 1 from public.report_order_events
    where report_order_id = v_order_id
      and action = 'reopen_review'
      and from_status = 'failed'
      and to_status = 'processing'
  ) then
    raise exception 'Failed-to-processing recovery audit event is missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.transition_easy_erf_report_order(uuid,text,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute the recovery transition directly';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.transition_easy_erf_report_order(uuid,text,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role lost recovery transition authority';
  end if;
end
$$;

select 'Failed Easy Erf investigation recovery verification passed' as result;
