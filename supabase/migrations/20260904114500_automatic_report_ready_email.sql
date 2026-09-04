begin;

revoke all on function public.record_easy_erf_customer_notification(uuid, uuid, text)
from public, anon, authenticated, service_role;
drop function if exists public.record_easy_erf_customer_notification(uuid, uuid, text);

create or replace function public.record_easy_erf_customer_email_attempt(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_recipient_email text,
  p_delivery_status text,
  p_provider text,
  p_report_version timestamptz,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns public.report_orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order public.report_orders%rowtype;
  v_raw_status text;
  v_status text;
  v_expected_email text;
  v_delivery_status text;
  v_provider text;
  v_report_version_text text;
  v_section text;
  v_item text;
  v_checklist jsonb;
  v_checklist_count integer;
  v_item_status text;
  v_existing_notification jsonb;
  v_notification jsonb;
  v_event_action text;
  v_event_note text;
  v_now timestamptz := now();
begin
  if p_order_id is null then
    raise exception 'Report order id is required';
  end if;
  if p_actor_user_id is null then
    raise exception 'Founder actor id is required';
  end if;
  if public.has_role(p_actor_user_id, 'admin'::public.app_role) is not true then
    raise exception 'Founder actor must have admin role';
  end if;

  v_delivery_status := lower(btrim(coalesce(p_delivery_status, '')));
  if v_delivery_status not in ('sent', 'failed') then
    raise exception 'Email delivery status must be sent or failed';
  end if;

  v_provider := lower(btrim(coalesce(p_provider, '')));
  if v_provider <> 'resend' then
    raise exception 'Unsupported customer email provider';
  end if;

  if nullif(lower(btrim(coalesce(p_recipient_email, ''))), '') is null then
    raise exception 'Customer email is required';
  end if;
  if p_report_version is null then
    raise exception 'Report version is required';
  end if;
  if v_delivery_status = 'sent'
     and nullif(btrim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'Provider message id is required for a sent email';
  end if;
  if char_length(coalesce(p_provider_message_id, '')) > 255 then
    raise exception 'Provider message id is too long';
  end if;
  if char_length(coalesce(p_error_code, '')) > 255 then
    raise exception 'Email error code is too long';
  end if;

  select * into v_order
  from public.report_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Report order not found';
  end if;

  if v_order.provider is distinct from 'stripe'
     or coalesce(v_order.payload ->> 'orderKind', '') <> 'easy_erf_investigation' then
    raise exception 'Order is not an Easy Erf Stripe investigation';
  end if;

  v_raw_status := coalesce(v_order.status_enum::text, v_order.status);
  v_status := case v_raw_status
    when 'complete' then 'ready'
    when 'fulfilling' then 'processing'
    else v_raw_status
  end;
  if v_status is distinct from 'ready' then
    raise exception 'Only a ready report can send a customer email';
  end if;
  if v_order.completed_at is null or v_order.completed_at <> p_report_version then
    raise exception 'Email report version does not match the delivered report';
  end if;

  if v_order.user_id is null then
    raise exception 'A matched customer account is required before notification';
  end if;

  select lower(btrim(email)) into v_expected_email
  from auth.users
  where id = v_order.user_id;

  if nullif(v_expected_email, '') is null then
    raise exception 'The customer account does not have a deliverable email address';
  end if;
  if lower(btrim(p_recipient_email)) <> v_expected_email then
    raise exception 'Notification recipient does not match the order customer';
  end if;

  if v_order.review_content is null
     or jsonb_typeof(v_order.review_content) is distinct from 'object'
     or jsonb_typeof(v_order.review_content -> 'bottomLine') is distinct from 'string'
     or nullif(btrim(v_order.review_content ->> 'bottomLine'), '') is null then
    raise exception 'A complete structured Human Review web report is required before notification';
  end if;

  foreach v_section in array array['known', 'potential', 'risks', 'unknowns', 'nextSteps']
  loop
    if jsonb_typeof(v_order.review_content -> v_section) is distinct from 'array'
       or jsonb_array_length(v_order.review_content -> v_section) < 1
       or jsonb_array_length(v_order.review_content -> v_section) > 8 then
      raise exception 'A complete structured Human Review web report is required before notification';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_order.review_content -> v_section) as entry(value)
      where jsonb_typeof(entry.value) <> 'string'
         or nullif(btrim(entry.value #>> '{}'), '') is null
    ) then
      raise exception 'A complete structured Human Review web report is required before notification';
    end if;
  end loop;

  v_checklist := v_order.review_content -> 'investigationChecklist';
  if jsonb_typeof(v_checklist) is distinct from 'object' then
    raise exception 'A resolved standard investigation checklist is required before notification';
  end if;

  select count(*) into v_checklist_count
  from jsonb_object_keys(v_checklist);
  if v_checklist_count <> 9 then
    raise exception 'A resolved standard investigation checklist is required before notification';
  end if;

  foreach v_item in array array[
    'parcel_identity',
    'cadastral_evidence',
    'ownership_title',
    'zoning_planning',
    'property_checks',
    'market_evidence',
    'strategy_calculations',
    'site_potential',
    'reviewed_report'
  ]
  loop
    v_item_status := v_checklist ->> v_item;
    if v_item_status is null then
      raise exception 'A resolved standard investigation checklist is required before notification';
    end if;
    if v_item_status not in ('complete', 'not_applicable') then
      raise exception 'Every standard investigation checklist item must be complete or not applicable before notification';
    end if;
  end loop;

  v_report_version_text := to_char(
    p_report_version at time zone 'utc',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_existing_notification := v_order.review_content -> 'customerNotification';

  if jsonb_typeof(v_existing_notification) = 'object'
     and v_existing_notification ->> 'status' = 'sent'
     and v_existing_notification ->> 'channel' = 'automatic_email'
     and v_existing_notification ->> 'provider' = v_provider
     and lower(coalesce(v_existing_notification ->> 'recipient', '')) = v_expected_email
     and v_existing_notification ->> 'reportVersion' = v_report_version_text
     and nullif(v_existing_notification ->> 'providerMessageId', '') is not null then
    return v_order;
  end if;

  if v_delivery_status = 'sent' then
    v_notification := jsonb_strip_nulls(jsonb_build_object(
      'status', 'sent',
      'channel', 'automatic_email',
      'provider', v_provider,
      'recipient', v_expected_email,
      'reportVersion', v_report_version_text,
      'attemptedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sentAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sentBy', p_actor_user_id::text,
      'providerMessageId', btrim(p_provider_message_id)
    ));
    v_event_action := 'customer_notified';
    v_event_note := left(v_provider || ':' || btrim(p_provider_message_id), 1000);
  else
    v_notification := jsonb_strip_nulls(jsonb_build_object(
      'status', 'failed',
      'channel', 'automatic_email',
      'provider', v_provider,
      'recipient', v_expected_email,
      'reportVersion', v_report_version_text,
      'attemptedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sentBy', p_actor_user_id::text,
      'errorCode', coalesce(nullif(btrim(p_error_code), ''), 'unknown_error')
    ));
    v_event_action := 'customer_notification_failed';
    v_event_note := left(
      v_provider || ':' || coalesce(nullif(btrim(p_error_code), ''), 'unknown_error'),
      1000
    );
  end if;

  update public.report_orders
  set review_content = jsonb_set(
        coalesce(review_content, '{}'::jsonb),
        '{customerNotification}',
        v_notification,
        true
      ),
      review_content_updated_at = v_now,
      updated_at = v_now
  where id = p_order_id
  returning * into v_order;

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
    v_event_action,
    'ready',
    'ready',
    v_event_note
  );

  return v_order;
end;
$$;

revoke all on function public.record_easy_erf_customer_email_attempt(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text,
  text
)
from public, anon, authenticated;
grant execute on function public.record_easy_erf_customer_email_attempt(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text,
  text
)
to service_role;

comment on function public.record_easy_erf_customer_email_attempt(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text,
  text
)
is 'Records an automatic report-ready email success or failure for the exact delivered Easy Erf report version. The function does not send email.';

comment on function public.clear_easy_erf_customer_notification_on_reopen()
is 'Clears the prior automatic customer-email receipt when a delivered Easy Erf report is reopened for correction.';

commit;
