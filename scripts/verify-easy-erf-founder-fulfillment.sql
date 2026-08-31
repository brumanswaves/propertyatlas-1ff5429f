\set ON_ERROR_STOP on

\i scripts/verify-easy-erf-stripe-migration.sql
\i supabase/migrations/20260831090000_easy_erf_founder_fulfillment_controls.sql

do $$
declare
  v_order_id uuid;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_row public.report_orders%rowtype;
  v_event_count integer;
begin
  select public.record_easy_erf_stripe_payment(
    'cs_test_founder_ops_1',
    'evt_test_founder_ops_1',
    'plink_easy_erf_test',
    null,
    null,
    null,
    'founder-ops@example.com',
    'Founder Ops Test',
    'Erf 1570',
    'Test fulfillment transitions',
    'zar',
    99900,
    false,
    null,
    'csg:lpi:c03400140000157000000'
  ) into v_order_id;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'start_review', v_actor_id, null, null
  );
  if v_row.status <> 'processing' or v_row.status_enum <> 'processing'::public.report_order_status then
    raise exception 'start_review did not move paid order to processing';
  end if;

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, null, null
    );
    raise exception 'mark_ready accepted missing PDF path';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted missing PDF path' then raise; end if;
      if sqlerrm not like '%report PDF storage path is required%' then
        raise exception 'Unexpected missing-PDF error: %', sqlerrm;
      end if;
  end;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id,
    'mark_ready',
    v_actor_id,
    'report-orders/test/easy-erf-1570.pdf',
    null
  );
  if v_row.status <> 'ready'
     or v_row.status_enum <> 'ready'::public.report_order_status
     or v_row.pdf_storage_path <> 'report-orders/test/easy-erf-1570.pdf'
     or v_row.completed_at is null then
    raise exception 'mark_ready did not persist ready artifact state';
  end if;

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'start_review', v_actor_id, null, null
    );
    raise exception 'ready order regressed to processing';
  exception
    when others then
      if sqlerrm = 'ready order regressed to processing' then raise; end if;
      if sqlerrm not like '%Only paid orders can start review%' then
        raise exception 'Unexpected regression error: %', sqlerrm;
      end if;
  end;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id;
  if v_event_count <> 2 then
    raise exception 'Expected exactly two successful fulfillment events, got %', v_event_count;
  end if;

  if has_function_privilege(
    'authenticated',
    'public.transition_easy_erf_report_order(uuid,text,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute founder fulfillment transition';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.transition_easy_erf_report_order(uuid,text,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot execute founder fulfillment transition';
  end if;

  if has_table_privilege('authenticated', 'public.report_order_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.report_order_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.report_order_events', 'DELETE') then
    raise exception 'Authenticated role can mutate report_order_events';
  end if;
end
$$;

select 'Easy Erf founder fulfillment verification passed' as result;
