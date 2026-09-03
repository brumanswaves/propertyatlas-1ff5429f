begin;

create or replace function public.record_easy_erf_customer_notification(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_recipient_email text
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
  v_existing_notification jsonb;
  v_notification jsonb;
  v_now timestamptz := now();
begin
  if p_order_id is null then
    raise exception 'Report order id is required';
  end if;
  if p_actor_user_id is null then
    raise exception 'Founder actor id is required';
  end if;
  if nullif(lower(btrim(coalesce(p_recipient_email, ''))), '') is null then
    raise exception 'Customer email is required';
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

  v_raw_status := coalesce(v_order.status_enum::text, v_order.status);
  v_status := case v_raw_status
    when 'complete' then 'ready'
    when 'fulfilling' then 'processing'
    else v_raw_status
  end;
  if v_status <> 'ready' then
    raise exception 'Only a ready report can be recorded as customer notified';
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
     or nullif(btrim(v_order.review_content ->> 'bottomLine'), '') is null then
    raise exception 'A complete structured Human Review web report is required before notification';
  end if;

  v_existing_notification := v_order.review_content -> 'customerNotification';
  if jsonb_typeof(v_existing_notification) = 'object'
     and v_existing_notification ->> 'status' = 'sent'
     and lower(coalesce(v_existing_notification ->> 'recipient', '')) = v_expected_email
     and nullif(v_existing_notification ->> 'sentAt', '') is not null then
    return v_order;
  end if;

  v_notification := jsonb_build_object(
    'status', 'sent',
    'channel', 'manual_email',
    'recipient', v_expected_email,
    'sentAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'sentBy', p_actor_user_id::text
  );

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
    'customer_notified',
    'ready',
    'ready',
    'manual_email'
  );

  return v_order;
end;
$$;

revoke all on function public.record_easy_erf_customer_notification(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.record_easy_erf_customer_notification(uuid, uuid, text)
to service_role;

create or replace function public.clear_easy_erf_customer_notification_on_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  v_old_status := case coalesce(old.status_enum::text, old.status)
    when 'complete' then 'ready'
    when 'fulfilling' then 'processing'
    else coalesce(old.status_enum::text, old.status)
  end;
  v_new_status := case coalesce(new.status_enum::text, new.status)
    when 'complete' then 'ready'
    when 'fulfilling' then 'processing'
    else coalesce(new.status_enum::text, new.status)
  end;

  if v_old_status = 'ready'
     and v_new_status = 'processing'
     and jsonb_typeof(new.review_content) = 'object' then
    new.review_content := new.review_content - 'customerNotification';
    new.review_content_updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.clear_easy_erf_customer_notification_on_reopen()
from public, anon, authenticated;

drop trigger if exists clear_easy_erf_customer_notification_on_reopen
on public.report_orders;

create trigger clear_easy_erf_customer_notification_on_reopen
before update of status, status_enum
on public.report_orders
for each row
execute function public.clear_easy_erf_customer_notification_on_reopen();

comment on function public.record_easy_erf_customer_notification(uuid, uuid, text)
is 'Records the founder-confirmed manual customer email receipt for one ready Easy Erf R999 report. The function does not send email.';

comment on function public.clear_easy_erf_customer_notification_on_reopen()
is 'Clears the prior customer-notification receipt when a delivered Easy Erf R999 report is reopened for correction.';

commit;
