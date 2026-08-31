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
    status
  ) values (
    'csg:lpi:c03400140000157000000',
    'Erf 1570',
    'intended_use',
    'second_dwelling',
    'Considering the property and want the evidence checked against an additional dwelling use.',
    'workbench-zoning-build',
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
    values ('legal_advice', 'checkout_started');
    raise exception 'Unsupported Human Review focus bypassed database constraint';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.human_review_requests (focus, intended_use, status)
    values ('property_check', 'second_dwelling', 'checkout_started');
    raise exception 'Intended use was accepted outside the intended_use focus';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.human_review_requests (focus, context, status)
    values ('property_check', repeat('x', 601), 'checkout_started');
    raise exception 'Overlong customer context bypassed database constraint';
  exception
    when check_violation then null;
  end;
end
$$;

select 'Easy Erf controlled Human Review product verification passed' as result;
