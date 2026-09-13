-- Reversible Auth suspension; never delete users, reports, assignments or evidence.
create table public.account_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  action text not null check (action in ('suspend', 'restore')),
  reason text not null check (length(reason) between 8 and 500),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index account_access_one_pending on public.account_access_events(target_id)
  where completed_at is null;
alter table public.account_access_events enable row level security;
revoke all on public.account_access_events from public, anon, authenticated;
grant select on public.account_access_events to service_role;

create function public.founder_begin_account_access(p_actor uuid, p_target uuid, p_email text, p_action text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user auth.users; v_id uuid;
begin
  if not coalesce(public.has_role(p_actor, 'admin'), false)
     or not exists (select 1 from auth.users where id = p_actor and (banned_until is null or banned_until <= now())) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  select * into v_user from auth.users where id = p_target for update;
  if not found or p_actor = p_target or coalesce(public.has_role(p_target, 'admin'), false)
     or lower(trim(p_email)) is distinct from lower(v_user.email)
     or p_action not in ('suspend', 'restore') or p_action is null then
    raise exception 'Account is protected or does not match' using errcode = '42501';
  end if;
  if (coalesce(v_user.banned_until > now(), false)) = (p_action = 'suspend') then
    raise exception 'Account state changed; refresh first' using errcode = '40001';
  end if;
  insert into public.account_access_events(actor_id, target_id, action, reason)
    values(p_actor, p_target, p_action, trim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

create function public.founder_finish_account_access(p_attempt uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.account_access_events;
begin
  select * into v_event from public.account_access_events where id = p_attempt for update;
  if not found or not exists (
    select 1 from auth.users where id = v_event.target_id
      and coalesce(banned_until > now(), false) = (v_event.action = 'suspend')
  ) then
    raise exception 'Access change not confirmed' using errcode = '40001';
  end if;
  update public.account_access_events set completed_at = coalesce(completed_at, now()) where id = p_attempt;
end;
$$;
revoke all on function public.founder_begin_account_access(uuid, uuid, text, text, text),
  public.founder_finish_account_access(uuid) from public, anon, authenticated;
grant execute on function public.founder_begin_account_access(uuid, uuid, text, text, text),
  public.founder_finish_account_access(uuid) to service_role;

-- Defend against a concurrent role promotion between the check and Auth update.
create function public.protect_admin_from_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.banned_until > now() and coalesce(public.has_role(new.id, 'admin'), false) then
    raise exception 'Founder/admin accounts are protected' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger protect_admin_from_suspension before update of banned_until on auth.users
  for each row execute function public.protect_admin_from_suspension();

create function public.protect_suspended_role_grant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id = new.user_id for update;
  if exists(select 1 from auth.users where id = new.user_id and banned_until > now()) then
    raise exception 'Suspended account cannot receive privileges' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger protect_suspended_role_grant before insert or update on public.user_roles
  for each row execute function public.protect_suspended_role_grant();

create function public.protect_suspended_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is null then
    perform 1 from auth.users where id = new.worker_id for update;
    if exists(select 1 from auth.users where id = new.worker_id and banned_until > now()) then
      raise exception 'Suspended account cannot receive assignments' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_suspended_assignment before insert or update on public.investigation_assignments
  for each row execute function public.protect_suspended_assignment();
revoke all on function public.protect_admin_from_suspension(),
  public.protect_suspended_role_grant(), public.protect_suspended_assignment() from public, anon, authenticated;

-- Auth ban rejects sign-in/refresh/getUser. REST must also reject still-valid JWTs,
-- including SECURITY DEFINER RPCs. Do not overwrite an existing pre-request hook.
create function public.require_active_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from auth.users where id = auth.uid() and banned_until > now()) then
    raise exception 'Account access is suspended' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_active_account() from public;
grant execute on function public.require_active_account() to anon, authenticated, service_role;
do $$
declare v_setting text;
begin
  select setting into v_setting from pg_roles r, unnest(r.rolconfig) setting
    where r.rolname = 'authenticator' and setting like 'pgrst.db_pre_request=%';
  if v_setting is not null and v_setting <> 'pgrst.db_pre_request=public.require_active_account' then
    raise exception 'Existing pre-request hook must be reviewed before this migration';
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request = 'public.require_active_account';
notify pgrst, 'reload config';

-- Storage and realtime do not use the REST pre-request hook. Restrictive policies
-- only subtract access; all existing row-ownership policies still apply.
create function public.account_access_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from auth.users where id = auth.uid() and banned_until > now());
$$;
revoke all on function public.account_access_allowed() from public;
grant execute on function public.account_access_allowed() to anon, authenticated, service_role;
do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and c.relrowsecurity
      and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname in ('objects', 'buckets')))
  loop
    execute format('create policy account_not_suspended on %I.%I as restrictive for all to authenticated using ((select public.account_access_allowed())) with check ((select public.account_access_allowed()))', t.nspname, t.relname);
  end loop;
end;
$$;
