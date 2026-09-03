\set ON_ERROR_STOP on

\i scripts/verify-easy-erf-founder-fulfillment.sql

create table if not exists auth.users (
  id uuid primary key
);

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid)
on conflict (id) do nothing;

\i supabase/migrations/20260831160318_controlled_human_review_product_v2.sql
\i supabase/migrations/20260903111500_require_resolved_founder_investigation_checklist.sql

do $$
declare
  v_order_id uuid;
  v_request_id uuid;
  v_request public.human_review_requests%rowtype;
  v_order public.report_orders%rowtype;
  v_policy_count integer;
  v_rls_enabled boolean;
begin
  select id into v_order_id
  from public.report_orders
  where provider_order_ref = 'cs_test_founder_ops_1';

  if v_order_id is null then
    raise exception 'Founder verification order was not available for Human Review proof';
  end if;

  insert into public.human_review_requests (
    parcel_id,
    property_reference_hint,
    focus,
    intended_use,
    context,
    source_surface,
    scope_acknowledged_at,
    status
  ) values (
    'csg:lpi:c03400140000157000000',
    'Erf 1570',
    'intended_use',
    'second_dwelling',
    'Considering the property and want the evidence checked against an additional dwelling use.',
    'workbench-zoning-build',
    now(),
    'checkout_started'
  )
  returning id into v_request_id;

  perform public.attach_easy_erf_human_review_request(v_order_id, v_request_id);

  select * into v_request
  from public.human_review_requests
  where id = v_request_id;

  select * into v_order
  from public.report_orders
  where id = v_order_id;

  if v_request.status <> 'paid'
     or v_request.report_order_id <> v_order_id
     or v_request.user_id <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'Controlled Human Review request did not attach to the paid order correctly';
  end if;

  if v_order.review_request_id <> v_request_id
     or v_order.review_focus <> 'intended_use'
     or v_order.intended_use <> 'second_dwelling'
     or v_order.review_context is null
     or v_order.review_scope_acknowledged_at is null
     or v_order.parcel_id <> 'csg:lpi:c03400140000157000000' then
    raise exception 'Paid order did not receive the controlled Human Review brief';
  end if;

  select relrowsecurity into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'human_review_requests';

  if v_rls_enabled is not true then
    raise exception 'human_review_requests does not have RLS enabled';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'human_review_requests';

  if v_policy_count <> 0 then
    raise exception 'human_review_requests unexpectedly has public/customer RLS policies';
  end if;

  if has_table_privilege('authenticated', 'public.human_review_requests', 'SELECT')
     or has_table_privilege('authenticated', 'public.human_review_requests', 'INSERT')
     or has_table_privilege('authenticated', 'public.human_review_requests', 'UPDATE')
     or has_table_privilege('authenticated', 'public.human_review_requests', 'DELETE') then
    raise exception 'Authenticated role can access service-role-only Human Review requests';
  end if;

  if not has_table_privilege('service_role', 'public.human_review_requests', 'SELECT')
     or not has_table_privilege('service_role', 'public.human_review_requests', 'INSERT')
     or not has_table_privilege('service_role', 'public.human_review_requests', 'UPDATE') then
    raise exception 'Service role cannot manage Human Review requests';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.attach_easy_erf_human_review_request(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can attach Human Review requests';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.attach_easy_erf_human_review_request(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot attach Human Review requests';
  end if;

  begin
    insert into public.human_review_requests (focus, status)
    values ('property_check', 'checkout_started');
    raise exception 'Human Review request omitted required scope acknowledgement';
  exception
    when not_null_violation then null;
  end;

  begin
    insert into public.human_review_requests (focus, scope_acknowledged_at, status)
    values ('legal_advice', now(), 'checkout_started');
    raise exception 'Unsupported Human Review focus bypassed database constraint';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.human_review_requests (
      focus,
      intended_use,
      scope_acknowledged_at,
      status
    ) values (
      'property_check',
      'second_dwelling',
      now(),
      'checkout_started'
    );
    raise exception 'Intended use was accepted outside the intended_use focus';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.human_review_requests (
      focus,
      context,
      scope_acknowledged_at,
      status
    ) values (
      'property_check',
      repeat('x', 501),
      now(),
      'checkout_started'
    );
    raise exception 'Overlong customer context bypassed database constraint';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  v_order_id uuid;
  v_row public.report_orders%rowtype;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
begin
  select public.record_easy_erf_stripe_payment(
    'cs_test_web_report_only_1',
    'evt_test_web_report_only_1',
    'plink_easy_erf_test',
    null,
    null,
    null,
    'web-report@example.com',
    'Web Report Test',
    'Erf 9001',
    null,
    'zar',
    99900,
    false,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'csg:lpi:c03400140000900100000'
  ) into v_order_id;

  perform public.transition_easy_erf_report_order(
    v_order_id, 'start_review', v_actor_id, null, null
  );

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, null, null
    );
    raise exception 'mark_ready accepted an empty structured Human Review report';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted an empty structured Human Review report' then raise; end if;
      if sqlerrm not like '%structured Human Review web report is required%' then
        raise exception 'Unexpected missing-web-report error: %', sqlerrm;
      end if;
  end;

  update public.report_orders
  set review_focus = 'property_check',
      review_content = jsonb_build_object(
        'bottomLine', 'Reviewed bottom line',
        'known', jsonb_build_array('Known fact'),
        'potential', jsonb_build_array('Evidence-supported potential'),
        'risks', jsonb_build_array('Risk'),
        'unknowns', jsonb_build_array('Unknown'),
        'nextSteps', jsonb_build_array('Verify next step')
      ),
      reviewed_by = v_actor_id,
      review_content_updated_at = now()
  where id = v_order_id;

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, null, null
    );
    raise exception 'mark_ready accepted a report without the standard investigation checklist';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted a report without the standard investigation checklist' then
        raise;
      end if;
      if sqlerrm not like '%complete standard investigation checklist is required%' then
        raise exception 'Unexpected missing-checklist error: %', sqlerrm;
      end if;
  end;

  update public.report_orders
  set review_content = review_content || jsonb_build_object(
    'investigationChecklist',
    jsonb_build_object(
      'parcel_identity', 'complete',
      'cadastral_evidence', 'complete',
      'ownership_title', 'complete',
      'zoning_planning', 'complete',
      'property_checks', 'complete',
      'market_evidence', 'complete',
      'strategy_calculations', 'complete',
      'site_potential', 'blocked',
      'reviewed_report', 'complete'
    )
  )
  where id = v_order_id;

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, null, null
    );
    raise exception 'mark_ready accepted a blocked standard investigation item';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted a blocked standard investigation item' then raise; end if;
      if sqlerrm not like '%must be complete or not applicable before marking ready%' then
        raise exception 'Unexpected unresolved-checklist error: %', sqlerrm;
      end if;
  end;

  update public.report_orders
  set review_content = jsonb_set(
    review_content,
    '{investigationChecklist,site_potential}',
    '"not_applicable"'::jsonb,
    false
  )
  where id = v_order_id;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'mark_ready', v_actor_id, null, null
  );

  if v_row.status <> 'ready'
     or v_row.status_enum <> 'complete'::public.report_order_status
     or v_row.pdf_storage_path is not null
     or v_row.completed_at is null then
    raise exception 'Resolved checklist and structured web report did not become ready without a PDF';
  end if;

  begin
    update public.report_orders
    set review_content = jsonb_set(
      review_content,
      '{investigationChecklist,site_potential}',
      '"blocked"'::jsonb,
      false
    )
    where id = v_order_id;
    raise exception 'A ready order accepted a later unresolved checklist edit';
  exception
    when others then
      if sqlerrm = 'A ready order accepted a later unresolved checklist edit' then raise; end if;
      if sqlerrm not like '%must be complete or not applicable before marking ready%' then
        raise exception 'Unexpected ready-order checklist edit error: %', sqlerrm;
      end if;
  end;
end
$$;

select 'Easy Erf controlled Human Review product verification passed' as result;
