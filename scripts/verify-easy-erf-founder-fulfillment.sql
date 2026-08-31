\set ON_ERROR_STOP on

\i scripts/verify-easy-erf-stripe-migration.sql

create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  metadata jsonb,
  unique (bucket_id, name)
);

\i supabase/migrations/20260831090000_easy_erf_founder_fulfillment_controls.sql
\i supabase/migrations/20260831113000_secure_easy_erf_report_delivery.sql
\i supabase/migrations/20260831130000_align_easy_erf_fulfillment_status_enum.sql
\i supabase/migrations/20260831142610_reopen_easy_erf_human_review.sql

do $$
declare
  v_order_id uuid;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_customer_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_expected_path text;
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
    v_customer_id,
    'csg:lpi:c03400140000157000000'
  ) into v_order_id;

  v_expected_path := v_customer_id::text
    || '/paid-reports/'
    || v_order_id::text
    || '/report.pdf';

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'start_review', v_actor_id, null, null
  );
  if v_row.status <> 'processing' or v_row.status_enum <> 'fulfilling'::public.report_order_status then
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

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id,
      'mark_ready',
      v_actor_id,
      v_customer_id::text || '/paid-reports/not-this-order/report.pdf',
      null
    );
    raise exception 'mark_ready accepted wrong customer-order PDF path';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted wrong customer-order PDF path' then raise; end if;
      if sqlerrm not like '%storage path does not match the customer order%' then
        raise exception 'Unexpected wrong-path error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, v_expected_path, null
    );
    raise exception 'mark_ready accepted a PDF path with no stored object';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted a PDF path with no stored object' then raise; end if;
      if sqlerrm not like '%Report PDF is not present in private storage%' then
        raise exception 'Unexpected missing-object error: %', sqlerrm;
      end if;
  end;

  insert into storage.objects (bucket_id, name, metadata)
  values ('erf-files', v_expected_path, '{"mimetype":"application/pdf"}'::jsonb);

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id,
    'mark_ready',
    v_actor_id,
    v_expected_path,
    null
  );
  if v_row.status <> 'ready'
     or v_row.status_enum <> 'complete'::public.report_order_status
     or v_row.pdf_storage_path <> v_expected_path
     or v_row.completed_at is null then
    raise exception 'mark_ready did not persist verified ready artifact state';
  end if;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'reopen_review', v_actor_id, null, null
  );
  if v_row.status <> 'processing'
     or v_row.status_enum <> 'fulfilling'::public.report_order_status
     or v_row.completed_at is not null then
    raise exception 'reopen_review did not move ready order back to processing';
  end if;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id,
    'mark_ready',
    v_actor_id,
    v_expected_path,
    null
  );
  if v_row.status <> 'ready'
     or v_row.status_enum <> 'complete'::public.report_order_status
     or v_row.completed_at is null then
    raise exception 'reopened report could not be marked ready again';
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
  if v_event_count <> 4 then
    raise exception 'Expected exactly four successful fulfillment events, got %', v_event_count;
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

select 'Easy Erf founder fulfillment and report delivery verification passed' as result;
