-- Investigator accounts remain normal Supabase Auth users. The existing
-- moderator role is the least-privilege investigator marker; it grants no
-- customer access by itself. Access to customer work remains order-scoped.
create table public.investigator_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in (
    'invite_sent',
    'existing_customer_role_granted',
    'investigator_role_granted',
    'legacy_assignment_role_backfilled'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index investigator_onboarding_events_target_created_idx
  on public.investigator_onboarding_events(target_user_id, created_at desc);

alter table public.investigator_onboarding_events enable row level security;
revoke all on table public.investigator_onboarding_events from public, anon, authenticated;
grant select, insert on table public.investigator_onboarding_events to service_role;

comment on table public.investigator_onboarding_events is
  'Server-only audit trail for founder-initiated investigator onboarding and role grants.';

create function public.founder_grant_investigator_role(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor_user_id is null
     or not coalesce(public.has_role(p_actor_user_id, 'admin'::public.app_role), false) then
    raise exception 'Founder Operations access is required' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_action not in ('invite_sent', 'existing_customer_role_granted') then
    raise exception 'Invalid investigator role grant' using errcode = '22023';
  end if;
  if coalesce(public.has_role(p_target_user_id, 'admin'::public.app_role), false) then
    raise exception 'Founder/admin accounts are managed separately' using errcode = '22023';
  end if;
  insert into public.user_roles(user_id, role)
    values(p_target_user_id, 'moderator'::public.app_role)
    on conflict(user_id, role) do nothing;
  insert into public.investigator_onboarding_events(
    actor_user_id, target_user_id, action, metadata
  ) values (
    p_actor_user_id, p_target_user_id, p_action,
    jsonb_build_object('role', 'moderator', 'access', 'order_scoped')
  );
end;
$$;

revoke all on function public.founder_grant_investigator_role(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.founder_grant_investigator_role(uuid, uuid, text)
  to service_role;

-- Preserve previously delegated investigators before enforcing the explicit
-- role marker. Moderator has no broad table or Founder Operations privileges.
with granted as (
  insert into public.user_roles(user_id, role)
  select distinct assignment.worker_id, 'moderator'::public.app_role
  from public.investigation_assignments assignment
  join auth.users account on account.id = assignment.worker_id
  join public.report_orders report_order on report_order.id = assignment.order_id
  where assignment.revoked_at is null
    and assignment.worker_id is distinct from report_order.user_id
  on conflict(user_id, role) do nothing
  returning user_id
)
insert into public.investigator_onboarding_events(target_user_id, action, metadata)
select user_id, 'legacy_assignment_role_backfilled', '{"source":"active_order_assignment"}'::jsonb
from granted;

create or replace function investigation_private.require_order(p_order uuid, p_actor uuid, p_action text)
returns public.report_orders language plpgsql security definer set search_path = '' as $$
declare
  v_order public.report_orders;
  v_admin boolean;
  v_investigator boolean;
  v_assignment public.investigation_assignments;
begin
  if p_actor is null or p_action not in ('read', 'write', 'approve') then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  select * into v_order from public.report_orders where id = p_order for update;
  if not found or v_order.provider is distinct from 'stripe'
     or v_order.payload->>'orderKind' is distinct from 'easy_erf_investigation'
     or v_order.user_id is null or v_order.parcel_id is null then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  v_admin := coalesce(public.has_role(p_actor, 'admin'), false);
  v_investigator := coalesce(public.has_role(p_actor, 'moderator'), false);
  select * into v_assignment from public.investigation_assignments
    where order_id = p_order and worker_id = p_actor and revoked_at is null;
  if not v_admin and not (p_action = 'read' and v_order.user_id = p_actor)
     and (not v_investigator or v_assignment.worker_id is null
       or (p_action = 'approve' and not v_assignment.can_approve)) then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  if p_action <> 'read' and coalesce(v_order.status_enum::text, v_order.status) <> 'fulfilling' then
    raise exception 'Investigation is not open for work' using errcode = '55000';
  end if;
  perform investigation_private.lock_property(v_order.user_id, v_order.parcel_id);
  return v_order;
end;
$$;

create or replace function public.assign_order_investigator(
  p_order_id uuid,
  p_worker_id uuid,
  p_can_approve boolean,
  p_revoke boolean default false
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders;
begin
  if auth.uid() is null or not coalesce(public.has_role(auth.uid(), 'admin'), false) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  if p_worker_id = v_order.user_id then
    raise exception 'Customer is not a delegated reviewer' using errcode = '22023';
  end if;
  if not p_revoke and (
    not coalesce(public.has_role(p_worker_id, 'moderator'), false)
    or not exists (
      select 1 from auth.users
      where id = p_worker_id and email_confirmed_at is not null
    )
  ) then
    raise exception 'An active investigator account is required' using errcode = '22023';
  end if;
  insert into public.investigation_assignments(order_id, worker_id, can_approve, assigned_by, revoked_at)
    values(p_order_id, p_worker_id, p_can_approve, auth.uid(), case when p_revoke then now() end)
    on conflict(order_id, worker_id) do update set can_approve = excluded.can_approve,
      assigned_by = excluded.assigned_by, assigned_at = now(), revoked_at = excluded.revoked_at;
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, auth.uid(), case when p_revoke then 'investigator_revoked' else 'investigator_assigned' end,
      v_order.status, v_order.status,
      jsonb_build_object('workerId', p_worker_id, 'canApprove', p_can_approve, 'role', 'moderator'));
end;
$$;

revoke all on function public.assign_order_investigator(uuid, uuid, boolean, boolean)
  from public, anon, service_role;
grant execute on function public.assign_order_investigator(uuid, uuid, boolean, boolean)
  to authenticated;
