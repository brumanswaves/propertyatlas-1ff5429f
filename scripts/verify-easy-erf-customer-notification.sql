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
\i supabase/migrations/20260904114500_automatic_report_ready_email.sql

do $$
declare
  v_order_id uuid;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_customer_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_row public.report_orders%rowtype;
  v_hash_before text;
  v_hash_after text;
  v_first_sent_at text;
  v_report_version timestamptz;
  v_report_version_text text;
  v_event_count integer;
begin
  select id, completed_at into v_order_id, v_report_version
  from public.report_orders
  where provider_order_ref = 'cs_test_web_report_only_1';

  if v_order_id is null or v_report_version is null then
    raise exception 'Ready Human Review order was not available for automatic email proof';
  end if;

  v_report_version_text := to_char(
    v_report_version at time zone 'utc',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  select md5((review_content - 'customerNotification')::text)
  into v_hash_before
  from public.report_orders
  where id = v_order_id;

  begin
    perform public.record_easy_erf_customer_email_attempt(
      v_order_id,
      v_customer_id,
      'customer@example.com',
      'sent',
      'resend',
      v_report_version,
      'email_non_admin',
      null
    );
    raise exception 'Automatic email receipt accepted a non-admin actor';
  exception
    when others then
      if sqlerrm = 'Automatic email receipt accepted a non-admin actor' then raise; end if;
      if sqlerrm not like '%Founder actor must have admin role%' then
        raise exception 'Unexpected non-admin actor error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.record_easy_erf_customer_email_attempt(
      v_order_id,
      v_actor_id,
      'wrong-customer@example.com',
      'sent',
      'resend',
      v_report_version,
      'email_wrong_recipient',
      null
    );
    raise exception 'Automatic email receipt accepted a recipient that did not own the order';
  exception
    when others then
      if sqlerrm = 'Automatic email receipt accepted a recipient that did not own the order' then raise; end if;
      if sqlerrm not like '%recipient does not match the order customer%' then
        raise exception 'Unexpected wrong-recipient error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.record_easy_erf_customer_email_attempt(
      v_order_id,
      v_actor_id,
      'customer@example.com',
      'sent',
      'resend',
      v_report_version - interval '1 second',
      'email_wrong_version',
      null
    );
    raise exception 'Automatic email receipt accepted the wrong report version';
  exception
    when others then
      if sqlerrm = 'Automatic email receipt accepted the wrong report version' then raise; end if;
      if sqlerrm not like '%report version does not match%' then
        raise exception 'Unexpected report-version error: %', sqlerrm;
      end if;
  end;

  select * into v_row
  from public.record_easy_erf_customer_email_attempt(
    v_order_id,
    v_actor_id,
    'customer@example.com',
    'failed',
    'resend',
    v_report_version,
    null,
    'provider_unreachable'
  );

  if v_row.review_content -> 'customerNotification' ->> 'status' <> 'failed'
     or v_row.review_content -> 'customerNotification' ->> 'channel' <> 'automatic_email'
     or v_row.review_content -> 'customerNotification' ->> 'provider' <> 'resend'
     or v_row.review_content -> 'customerNotification' ->> 'recipient' <> 'customer@example.com'
     or v_row.review_content -> 'customerNotification' ->> 'reportVersion' <> v_report_version_text
     or v_row.review_content -> 'customerNotification' ->> 'errorCode' <> 'provider_unreachable' then
    raise exception 'Failed automatic email attempt was not persisted correctly';
  end if;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notification_failed';
  if v_event_count <> 1 then
    raise exception 'Expected one customer_notification_failed event, got %', v_event_count;
  end if;

  select * into v_row
  from public.record_easy_erf_customer_email_attempt(
    v_order_id,
    v_actor_id,
    'CUSTOMER@example.com',
    'sent',
    'resend',
    v_report_version,
    'email_automatic_1',
    null
  );

  if v_row.review_content -> 'customerNotification' ->> 'status' <> 'sent'
     or v_row.review_content -> 'customerNotification' ->> 'channel' <> 'automatic_email'
     or v_row.review_content -> 'customerNotification' ->> 'provider' <> 'resend'
     or v_row.review_content -> 'customerNotification' ->> 'recipient' <> 'customer@example.com'
     or v_row.review_content -> 'customerNotification' ->> 'reportVersion' <> v_report_version_text
     or v_row.review_content -> 'customerNotification' ->> 'providerMessageId' <> 'email_automatic_1'
     or v_row.review_content -> 'customerNotification' ->> 'sentBy' <> v_actor_id::text
     or nullif(v_row.review_content -> 'customerNotification' ->> 'sentAt', '') is null then
    raise exception 'Sent automatic email receipt was not persisted correctly';
  end if;

  v_first_sent_at := v_row.review_content -> 'customerNotification' ->> 'sentAt';
  v_hash_after := md5((v_row.review_content - 'customerNotification')::text);
  if v_hash_after <> v_hash_before then
    raise exception 'Recording automatic email changed the reviewed report body';
  end if;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 1 then
    raise exception 'Expected one customer_notified event, got %', v_event_count;
  end if;

  select * into v_row
  from public.record_easy_erf_customer_email_attempt(
    v_order_id,
    v_actor_id,
    'customer@example.com',
    'sent',
    'resend',
    v_report_version,
    'email_automatic_duplicate',
    null
  );

  if v_row.review_content -> 'customerNotification' ->> 'sentAt' <> v_first_sent_at
     or v_row.review_content -> 'customerNotification' ->> 'providerMessageId' <> 'email_automatic_1' then
    raise exception 'Idempotent automatic email recording replaced the original receipt';
  end if;

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 1 then
    raise exception 'Idempotent automatic email recording created a duplicate event';
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
    raise exception 'Reopening the report did not clear the prior automatic email receipt';
  end if;

  begin
    perform public.record_easy_erf_customer_email_attempt(
      v_order_id,
      v_actor_id,
      'customer@example.com',
      'sent',
      'resend',
      v_report_version,
      'email_while_processing',
      null
    );
    raise exception 'Automatic email was recorded while the report was still in review';
  exception
    when others then
      if sqlerrm = 'Automatic email was recorded while the report was still in review' then raise; end if;
      if sqlerrm not like '%Only a ready report can send a customer email%' then
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
  v_report_version := v_row.completed_at;

  select * into v_row
  from public.record_easy_erf_customer_email_attempt(
    v_order_id,
    v_actor_id,
    'customer@example.com',
    'sent',
    'resend',
    v_report_version,
    'email_automatic_2',
    null
  );

  select count(*) into v_event_count
  from public.report_order_events
  where report_order_id = v_order_id
    and action = 'customer_notified';
  if v_event_count <> 2 then
    raise exception 'Corrected report automatic email did not create one new event';
  end if;

  if to_regprocedure('public.record_easy_erf_customer_notification(uuid,uuid,text)') is not null then
    raise exception 'Retired manual customer-notification function still exists';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.record_easy_erf_customer_email_attempt(uuid,uuid,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated customers can record automatic email receipts';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_easy_erf_customer_email_attempt(uuid,uuid,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot record automatic email receipts';
  end if;

  if v_row.user_id <> v_customer_id then
    raise exception 'Automatic email flow changed the order customer';
  end if;
end
$$;

select 'Easy Erf automatic customer report email verification passed' as result;
