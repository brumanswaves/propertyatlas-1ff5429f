\set ON_ERROR_STOP on

\i scripts/verify-easy-erf-human-review-product.sql

alter table auth.users
add column if not exists email text;

update auth.users
set email = case id
  when '11111111-1111-4111-8111-111111111111'::uuid then 'founder@example.com'
  when '22222222-2222-4222-8222-222222222222'::uuid then 'customer@example.com'
  else email
end;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = '11111111-1111-4111-8111-111111111111'::uuid
    and _role = 'admin'::public.app_role
$$;

\i supabase/migrations/20260903211000_record_manual_report_notification.sql

do $$
declare
  v_order_id uuid;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_customer_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_row public.report_orders%rowtype;
  v_hash_before text;
  v_hash_after text;
  v_first_sent_at text;
  v_event_count integer;
begin
  select id into v_order_id
  from public.report_orders
  where provider_order_ref = 'cs_test_web_report_only_1';

  if v_order_id is null then
    raise exception 'Ready Human Review order was not available for notification proof';
  end if;

  select md5((review_content - 'customerNotification')::text)
  into v_hash_before
  from public.report_orders
  where id = v_order_id;

  begin
    perform public.record_easy_erf_customer_notification(
      v_order_id,
      v_customer_id,
      'customer@example.com'
    );
    raise exception 'Notification accepted a non-admin actor';
  exception
    when others then
      if sqlerrm = 'Notification accepted a non-admin actor' then raise; end if;
      if sqlerrm not like '%Founder actor must have admin role%' then
        raise exception 'Unexpected non-admin actor error: %', sqlerrm;
      end if;
  end;

  update public.report_orders
  set review_content = jsonb_set(
    review_content,
    '{customerNotification}',
    jsonb_build_object(
      'status', 'sent',
      'channel', 'sms',
      'recipient', 'customer@example.com',
      'sentAt', '2026-09-04T00:00:00.000Z',
      'sentBy', v_actor_id::text
    ),
    true
  )
  where id = v_order_id;

  begin
    perform public.record_easy_erf_customer_notification(
      v_order_id,
      v_actor_id,
      'wrong-customer@example.com'
    );
    raise exception 'Notification accepted a recipient that did not own the order';
  exception
    when others then
      if sqlerrm = 'Notification accepted a recipient that did not own the order' then raise; end if;
      if sqlerrm not like '%recipient does not match the order customer%' then
        raise exception 'Unexpected wrong-recipient error: %', sqlerrm;
      end if;
  end;

  select * into v_row
  from public.record_easy_erf_customer_notification(
    v_order_id,
    v_actor_id,
    'customer@example.com'
  );

  if v_row.review_content -> 'customerNotification' ->> 'status' <> 'sent'
     or v_row.review_content -> 'customerNotification' ->> 'channel' <> 'manual_email'
     or v_row.review_content -> 'customerNotification' ->> 'recipient' <> 'customer@example.com'
     or v_row.review_content -> 'customerNotification' ->> 'sentBy' <> v_actor_id::text
     or nullif(v_row.review_content -> 'customerNotification' ->> 'sentAt', '') is null then
    raise exception 'Customer notification receipt was not persisted correctly';
  end if;

  v_first_sent_at := v_row.review_content -> 'customerNotification' ->> 'sentAt';
  v_hash_after := md5((v_row.review_content - 'customerNotification')::text);
  if v_hash_after <> v_hash_before then
    raise exception 'Recording notification changed the reviewed report body';
  end if;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 1 then
    raise exception 'Expected one customer_notified event, got %', v_event_count;
  end if;

  select * into v_row
  from public.record_easy_erf_customer_notification(
    v_order_id,
    v_actor_id,
    'CUSTOMER@example.com'
  );

  if v_row.review_content -> 'customerNotification' ->> 'sentAt' <> v_first_sent_at then
    raise exception 'Idempotent notification recording replaced the original receipt';
  end if;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 1 then
    raise exception 'Idempotent notification recording created a duplicate event';
  end if;

  select * into v_row
  from public.transition_easy_erf_report_order(
    v_order_id,
    'reopen_review',
    v_actor_id,
    null,
    null
  );

  if v_row.status <> 'processing'
     or v_row.review_content ? 'customerNotification' then
    raise exception 'Reopening the report did not clear the prior notification receipt';
  end if;

  begin
    perform public.record_easy_erf_customer_notification(
      v_order_id,
      v_actor_id,
      'customer@example.com'
    );
    raise exception 'Notification was recorded while the report was still in review';
  exception
    when others then
      if sqlerrm = 'Notification was recorded while the report was still in review' then raise; end if;
      if sqlerrm not like '%Only a ready report can be recorded as customer notified%' then
        raise exception 'Unexpected in-review notification error: %', sqlerrm;
      end if;
  end;

  select * into v_row
  from public.transition_easy_erf_report_order(
    v_order_id,
    'mark_ready',
    v_actor_id,
    null,
    null
  );

  select * into v_row
  from public.record_easy_erf_customer_notification(
    v_order_id,
    v_actor_id,
    'customer@example.com'
  );

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 2 then
    raise exception 'Corrected report notification did not create one new receipt event';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.record_easy_erf_customer_notification(uuid,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated customers can record notification receipts';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_easy_erf_customer_notification(uuid,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot record customer notification receipts';
  end if;

  if v_row.user_id <> v_customer_id then
    raise exception 'Notification flow changed the order customer';
  end if;
end
$$;

select 'Easy Erf manual customer notification verification passed' as result;
