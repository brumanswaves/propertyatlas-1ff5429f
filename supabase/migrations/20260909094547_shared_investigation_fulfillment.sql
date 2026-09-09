-- Customer-owned investigation data stays in saved_properties and the File Vault.
-- These tables record delegation, concurrency and review history, not competing facts.
create schema if not exists investigation_private;
revoke all on schema investigation_private from public, anon, authenticated;
alter table public.report_order_events add column if not exists metadata jsonb not null default '{}'::jsonb;

create table public.investigation_assignments (
  order_id uuid not null references public.report_orders(id) on delete cascade,
  worker_id uuid not null references auth.users(id),
  can_approve boolean not null default false,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (order_id, worker_id)
);
alter table public.investigation_assignments enable row level security;
revoke all on public.investigation_assignments from public, anon, authenticated;

create table investigation_private.revisions (
  customer_id uuid not null references auth.users(id) on delete cascade,
  parcel_id text not null,
  revision bigint not null default 0,
  primary key (customer_id, parcel_id)
);
alter table investigation_private.revisions enable row level security;

create table public.investigation_review_versions (
  id uuid primary key default gen_random_uuid(),
  version_sequence bigint generated always as identity unique,
  order_id uuid not null references public.report_orders(id),
  customer_id uuid not null references auth.users(id),
  parcel_id text not null,
  evidence_revision bigint not null,
  evidence_snapshot jsonb not null,
  report_assembly jsonb not null,
  evidence_manifest jsonb not null,
  signoff_assessment jsonb not null,
  generated_brief jsonb not null,
  provider_model text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid not null references auth.users(id),
  edited_brief jsonb not null,
  brief_revision bigint not null default 1,
  approved_by uuid references auth.users(id),
  approved_reviewer_label text,
  approved_at timestamptz,
  approved_content jsonb,
  delivered_at timestamptz
);
alter table public.investigation_review_versions enable row level security;
revoke all on public.investigation_review_versions from public, anon, authenticated;
create index investigation_review_versions_order_idx
  on public.investigation_review_versions(order_id, version_sequence desc);

-- Same lock is acquired by every canonical write, including existing customer paths.
create function investigation_private.lock_property(p_customer uuid, p_parcel text)
returns void language sql set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer::text || ':' || p_parcel, 0));
$$;
create function investigation_private.guard_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_customer uuid; v_parcel text; v_before jsonb; v_after jsonb;
  v_shared_keys text[] := array['easyErfInvestigation','strategyWorkspace','savedMarketEvidence','marketEvidenceCandidates',
    'marketAddressIntelligence','dismissedMarketEvidenceCandidateIds','propertyIdentity','buildEnvelopeInputs','streetFrontage','sitePotentialStrategyDraft',
    'normalizedParcel','parcelRing','investigationWork'];
begin
  if tg_op = 'UPDATE' and (new.user_id, new.parcel_id) is distinct from (old.user_id, old.parcel_id) then
    raise exception 'Investigation ownership cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then v_customer := old.user_id; v_parcel := old.parcel_id;
  else v_customer := new.user_id; v_parcel := new.parcel_id; end if;
  if tg_table_name = 'saved_properties' and auth.uid() = v_customer and tg_op in ('UPDATE','DELETE')
    and exists(select 1 from public.report_orders o where o.user_id = v_customer and o.parcel_id = v_parcel
      and (exists(select 1 from public.investigation_assignments a where a.order_id = o.id)
        or exists(select 1 from public.investigation_review_versions r where r.order_id = o.id))) then
    if tg_op = 'DELETE' then
      raise exception 'A shared investigation cannot be removed from its customer file' using errcode = '42501';
    end if;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_before
      from jsonb_each(coalesce(old.user_data,'{}'::jsonb)) where key = any(v_shared_keys);
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_after
      from jsonb_each(coalesce(new.user_data,'{}'::jsonb)) where key = any(v_shared_keys);
    if v_before is distinct from v_after and current_setting('easyerf.guarded_investigation',true)
      is distinct from v_customer::text || ':' || v_parcel then
      raise exception 'Shared investigation changed. Reload and use a guarded save.' using errcode = '40001';
    end if;
  end if;
  perform investigation_private.lock_property(v_customer, v_parcel);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- AFTER ignores attempted INSERTs skipped by ON CONFLICT. Only a stored change
-- advances the evidence revision; the BEFORE guard still serializes each write.
create function investigation_private.record_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_customer uuid; v_parcel text;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then return new; end if;
  if tg_op = 'DELETE' then v_customer := old.user_id; v_parcel := old.parcel_id;
  else v_customer := new.user_id; v_parcel := new.parcel_id; end if;
  insert into investigation_private.revisions(customer_id, parcel_id, revision)
    values(v_customer, v_parcel, 1)
    on conflict(customer_id, parcel_id) do update set revision = investigation_private.revisions.revision + 1;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger investigation_saved_property_guard before insert or update or delete on public.saved_properties
  for each row execute function investigation_private.guard_write();
create trigger investigation_asset_guard before insert or update or delete on public.erf_assets
  for each row execute function investigation_private.guard_write();
create trigger investigation_site_guard before insert or update or delete on public.erf_site_projects
  for each row execute function investigation_private.guard_write();
create trigger investigation_saved_property_revision after insert or update or delete on public.saved_properties
  for each row execute function investigation_private.record_revision();
create trigger investigation_asset_revision after insert or update or delete on public.erf_assets
  for each row execute function investigation_private.record_revision();
create trigger investigation_site_revision after insert or update or delete on public.erf_site_projects
  for each row execute function investigation_private.record_revision();

-- Compare only the namespaces the customer is changing. Unrelated writes are preserved.
create function public.patch_saved_property_user_data_if_unchanged(p_parcel_id text, p_user_data_patch jsonb, p_expected jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing jsonb; v_key text; v_result jsonb; v_previous text;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_parcel_id is null or btrim(p_parcel_id) = '' or jsonb_typeof(p_user_data_patch) is distinct from 'object'
    or jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'Invalid investigation patch' using errcode = '22023'; end if;
  perform investigation_private.lock_property(auth.uid(), p_parcel_id);
  select coalesce(user_data,'{}'::jsonb) into v_existing from public.saved_properties
    where user_id = auth.uid() and parcel_id = p_parcel_id for update;
  v_existing := coalesce(v_existing,'{}'::jsonb);
  for v_key in select jsonb_object_keys(p_user_data_patch) loop
    if (v_existing->v_key) is distinct from (p_expected->v_key) then
      raise exception 'This investigation changed. Reload before saving.' using errcode = '40001';
    end if;
  end loop;
  v_previous := current_setting('easyerf.guarded_investigation',true);
  perform set_config('easyerf.guarded_investigation', auth.uid()::text || ':' || p_parcel_id, true);
  v_result := public.patch_saved_property_user_data(p_parcel_id,p_user_data_patch);
  perform set_config('easyerf.guarded_investigation', coalesce(v_previous,''), true);
  return v_result;
end;
$$;
revoke all on function public.patch_saved_property_user_data_if_unchanged(text,jsonb,jsonb) from public, anon, service_role;
grant execute on function public.patch_saved_property_user_data_if_unchanged(text,jsonb,jsonb) to authenticated;

create function investigation_private.require_order(p_order uuid, p_actor uuid, p_action text)
returns public.report_orders language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_admin boolean; v_assignment public.investigation_assignments;
begin
  if p_actor is null or p_action not in ('read', 'write', 'approve') then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  -- Locking the order serializes assignment/revocation against authorized operations.
  select * into v_order from public.report_orders where id = p_order for update;
  if not found or v_order.provider is distinct from 'stripe' or v_order.payload->>'orderKind' is distinct from 'easy_erf_investigation'
     or v_order.user_id is null or v_order.parcel_id is null then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  v_admin := coalesce(public.has_role(p_actor, 'admin'), false);
  select * into v_assignment from public.investigation_assignments
    where order_id = p_order and worker_id = p_actor and revoked_at is null;
  if not v_admin and not (p_action = 'read' and v_order.user_id = p_actor)
     and (v_assignment.worker_id is null or (p_action = 'approve' and not v_assignment.can_approve)) then
    raise exception 'Investigation access denied' using errcode = '42501';
  end if;
  if p_action <> 'read' and coalesce(v_order.status_enum::text, v_order.status) <> 'fulfilling' then
    raise exception 'Investigation is not open for work' using errcode = '55000';
  end if;
  perform investigation_private.lock_property(v_order.user_id, v_order.parcel_id);
  return v_order;
end;
$$;

create function public.assign_order_investigator(p_order_id uuid, p_worker_id uuid, p_can_approve boolean, p_revoke boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders;
begin
  if auth.uid() is null or not coalesce(public.has_role(auth.uid(), 'admin'), false) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  if p_worker_id = v_order.user_id then raise exception 'Customer is not a delegated reviewer' using errcode = '22023'; end if;
  insert into public.investigation_assignments(order_id, worker_id, can_approve, assigned_by, revoked_at)
    values(p_order_id, p_worker_id, p_can_approve, auth.uid(), case when p_revoke then now() end)
    on conflict(order_id, worker_id) do update set can_approve = excluded.can_approve,
      assigned_by = excluded.assigned_by, assigned_at = now(), revoked_at = excluded.revoked_at;
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, auth.uid(), case when p_revoke then 'investigator_revoked' else 'investigator_assigned' end,
      v_order.status, v_order.status,
      jsonb_build_object('workerId', p_worker_id, 'canApprove', p_can_approve));
end;
$$;

create function investigation_private.snapshot(p_customer uuid, p_parcel text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'schemaVersion', 1, 'parcelId', p_parcel,
    'revision', coalesce((select revision from investigation_private.revisions where customer_id = p_customer and parcel_id = p_parcel), 0),
    'userData', coalesce((select jsonb_object_agg(k, v) from public.saved_properties s,
      lateral jsonb_each(coalesce(s.user_data, '{}'::jsonb)) e(k,v)
      where s.user_id = p_customer and s.parcel_id = p_parcel and k = any(array[
        'normalizedParcelId','provider','sourceLayer','displayTitle','displaySubtitle','approximateAddress',
        'streetNumber','streetName','nearestRoad','erfNumber','portion','lpi','parcelKey','municipality','province',
        'town','majorRegion','minorRegion','geometryArea','zoningCode','zoningType','lng','lat','longitude','latitude',
        'addressSource','addressConfidence','userEntered','fetchedAt','normalizedParcel','parcelRing',
        'easyErfInvestigation','strategyWorkspace','savedMarketEvidence','marketEvidenceCandidates',
        'dismissedMarketEvidenceCandidateIds','propertyIdentity','marketAddressIntelligence',
        'buildEnvelopeInputs','streetFrontage','investigationWork'
      ])), '{}'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.erf_assets a
      where user_id = p_customer and parcel_id = p_parcel and status not in ('deleted', 'archived')), '[]'::jsonb),
    'siteProject', (select to_jsonb(s) from public.erf_site_projects s where user_id = p_customer and parcel_id = p_parcel)
  );
$$;

create function public.read_order_investigation(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_result jsonb;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  v_result := investigation_private.snapshot(v_order.user_id, v_order.parcel_id);
  return v_result || jsonb_build_object('orderId', v_order.id, 'customerId', v_order.user_id,
    'canWork', coalesce(v_order.status_enum::text, v_order.status) = 'fulfilling' and (coalesce(public.has_role(auth.uid(), 'admin'), false) or exists (
      select 1 from public.investigation_assignments where order_id = p_order_id and worker_id = auth.uid() and revoked_at is null)),
    'canApprove', coalesce(v_order.status_enum::text, v_order.status) = 'fulfilling' and (coalesce(public.has_role(auth.uid(), 'admin'), false) or exists (
      select 1 from public.investigation_assignments where order_id = p_order_id and worker_id = auth.uid() and revoked_at is null and can_approve)));
end;
$$;

create function public.patch_order_investigation(p_order_id uuid, p_expected_revision bigint, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_snapshot jsonb; v_key text; v_previous text;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'write');
  v_snapshot := investigation_private.snapshot(v_order.user_id, v_order.parcel_id);
  if (v_snapshot->>'revision')::bigint is distinct from p_expected_revision then
    raise exception 'Investigation changed. Reload before saving.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or octet_length(p_patch::text) > 2097152 then
    raise exception 'Invalid investigation patch' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('easyErfInvestigation', 'strategyWorkspace', 'savedMarketEvidence', 'marketEvidenceCandidates',
      'dismissedMarketEvidenceCandidateIds', 'propertyIdentity', 'marketAddressIntelligence',
      'buildEnvelopeInputs', 'streetFrontage', 'investigationWork', 'normalizedParcel', 'parcelRing') then
      raise exception 'Unsupported investigation field' using errcode = '22023';
    end if;
  end loop;
  if p_patch ? 'normalizedParcel' and p_patch->'normalizedParcel'->>'id' is distinct from v_order.parcel_id then
    raise exception 'Parcel identity does not match the order' using errcode = '22023';
  end if;
  v_previous := current_setting('easyerf.guarded_investigation',true);
  perform set_config('easyerf.guarded_investigation', v_order.user_id::text || ':' || v_order.parcel_id, true);
  insert into public.saved_properties(user_id, parcel_id, user_data) values(v_order.user_id, v_order.parcel_id, p_patch)
    on conflict(user_id, parcel_id) do update set user_data = coalesce(public.saved_properties.user_data, '{}'::jsonb) || p_patch;
  perform set_config('easyerf.guarded_investigation', coalesce(v_previous,''), true);
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, auth.uid(), 'investigation_saved', v_order.status, v_order.status,
      jsonb_build_object('previousRevision', p_expected_revision, 'fields', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return public.read_order_investigation(p_order_id);
end;
$$;

-- No default PUBLIC execute, including helpers. Only reviewed RPCs are exposed.
revoke all on all functions in schema investigation_private from public, anon, authenticated, service_role;
revoke all on function public.assign_order_investigator(uuid, uuid, boolean, boolean) from public, anon, service_role;
revoke all on function public.read_order_investigation(uuid) from public, anon, service_role;
revoke all on function public.patch_order_investigation(uuid, bigint, jsonb) from public, anon, service_role;
grant execute on function public.assign_order_investigator(uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.read_order_investigation(uuid) to authenticated;
grant execute on function public.patch_order_investigation(uuid, bigint, jsonb) to authenticated;

create function public.record_investigation_brief(
  p_order_id uuid, p_actor_id uuid, p_expected_revision bigint,
  p_assembly jsonb, p_manifest jsonb, p_assessment jsonb, p_brief jsonb, p_model text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_snapshot jsonb; v_id uuid;
begin
  -- Service-only: the authenticated server assembles evidence and validates provider output.
  v_order := investigation_private.require_order(p_order_id, p_actor_id, 'write');
  v_snapshot := investigation_private.snapshot(v_order.user_id, v_order.parcel_id);
  if (v_snapshot->>'revision')::bigint is distinct from p_expected_revision then
    raise exception 'Evidence changed during generation. Generate again.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_assembly) is distinct from 'object' or jsonb_typeof(p_brief) is distinct from 'object'
     or jsonb_typeof(p_manifest) is distinct from 'array' or jsonb_typeof(p_assessment) is distinct from 'object'
     or nullif(btrim(p_model), '') is null then
    raise exception 'Incomplete generation result' using errcode = '22023';
  end if;
  insert into public.investigation_review_versions(order_id, customer_id, parcel_id, evidence_revision,
    evidence_snapshot, report_assembly, evidence_manifest, signoff_assessment, generated_brief, edited_brief, provider_model, generated_by)
  values(v_order.id, v_order.user_id, v_order.parcel_id, p_expected_revision,
    v_snapshot, p_assembly, p_manifest, p_assessment, p_brief, p_brief, p_model, p_actor_id) returning id into v_id;
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, p_actor_id, 'investigation_brief_generated', v_order.status, v_order.status,
      jsonb_build_object('versionId', v_id, 'evidenceRevision', p_expected_revision));
  return v_id;
end;
$$;

create function public.read_investigation_review(p_order_id uuid, p_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_version public.investigation_review_versions;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  select * into v_version from public.investigation_review_versions
    where order_id = p_order_id and (p_version_id is null or id = p_version_id)
      and (v_order.user_id <> auth.uid() or delivered_at is not null)
    order by version_sequence desc limit 1;
  if not found then return null; end if;
  return to_jsonb(v_version) || jsonb_build_object('currentEvidenceRevision',
    coalesce((select revision from investigation_private.revisions where customer_id = v_order.user_id and parcel_id = v_order.parcel_id), 0));
end;
$$;

create function public.edit_investigation_brief(p_order_id uuid, p_version_id uuid, p_expected_brief_revision bigint, p_brief jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_version public.investigation_review_versions; v_id uuid; v_latest uuid;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'write');
  select id into v_latest from public.investigation_review_versions where order_id = p_order_id
    order by version_sequence desc limit 1;
  select * into v_version from public.investigation_review_versions where id = p_version_id and order_id = p_order_id;
  if not found or p_version_id is distinct from v_latest or v_version.brief_revision is distinct from p_expected_brief_revision
     or v_version.evidence_revision is distinct from coalesce((select revision from investigation_private.revisions
       where customer_id = v_order.user_id and parcel_id = v_order.parcel_id), 0) then
    raise exception 'Review changed. Reload before saving.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_brief) is distinct from 'object' or octet_length(p_brief::text) > 131072 then
    raise exception 'Invalid review draft' using errcode = '22023';
  end if;
  -- Append edits; never rewrite an approved or delivered version or the AI original.
  insert into public.investigation_review_versions(order_id, customer_id, parcel_id, evidence_revision,
    evidence_snapshot, report_assembly, evidence_manifest, signoff_assessment, generated_brief,
    edited_brief, provider_model, generated_by, generated_at, brief_revision)
  values(v_order.id, v_order.user_id, v_order.parcel_id, v_version.evidence_revision,
    v_version.evidence_snapshot, v_version.report_assembly, v_version.evidence_manifest, v_version.signoff_assessment,
    v_version.generated_brief, p_brief, v_version.provider_model, v_version.generated_by,
    v_version.generated_at, v_version.brief_revision + 1) returning id into v_id;
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, auth.uid(), 'investigation_brief_edited', v_order.status, v_order.status,
      jsonb_build_object('previousVersionId', p_version_id, 'versionId', v_id));
  return v_id;
end;
$$;

create function public.approve_investigation_review(p_order_id uuid, p_version_id uuid, p_actor_id uuid, p_expected_brief_revision bigint, p_validated_content jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_version public.investigation_review_versions; v_latest uuid;
begin
  -- Service-only after canonical signoff and citation validation; actor remains the real caller.
  v_order := investigation_private.require_order(p_order_id, p_actor_id, 'approve');
  select id into v_latest from public.investigation_review_versions where order_id = p_order_id
    order by version_sequence desc limit 1;
  select * into v_version from public.investigation_review_versions where id = p_version_id and order_id = p_order_id for update;
  if not found or p_version_id is distinct from v_latest or v_version.approved_at is not null
     or v_version.brief_revision is distinct from p_expected_brief_revision
     or v_version.evidence_revision is distinct from coalesce((select revision from investigation_private.revisions
       where customer_id = v_order.user_id and parcel_id = v_order.parcel_id), 0) then
    raise exception 'Review or evidence changed. Review the current version.' using errcode = '40001';
  end if;
  if v_version.signoff_assessment->>'eligible' is distinct from 'true'
     or jsonb_typeof(p_validated_content) is distinct from 'object' then
    raise exception 'Investigation work remains unresolved' using errcode = '23514';
  end if;
  update public.investigation_review_versions set approved_by = p_actor_id,
    approved_reviewer_label = coalesce((select nullif(btrim(full_name), '') from public.profiles where id = p_actor_id), 'Reviewer ' || left(p_actor_id::text, 8)),
    approved_at = now(), approved_content = p_validated_content where id = p_version_id;
  update public.report_orders set review_content = coalesce(review_content, '{}'::jsonb) || p_validated_content ||
    jsonb_build_object('combinedReviewVersionId', p_version_id), reviewed_by = p_actor_id,
    review_content_updated_at = now(), updated_at = now() where id = p_order_id;
  insert into public.report_order_events(report_order_id, actor_user_id, action, from_status, to_status, metadata)
    values(p_order_id, p_actor_id, 'investigation_review_approved', v_order.status, v_order.status,
      jsonb_build_object('versionId', p_version_id, 'evidenceRevision', v_version.evidence_revision, 'briefRevision', v_version.brief_revision));
end;
$$;

revoke all on function public.record_investigation_brief(uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.approve_investigation_review(uuid,uuid,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.record_investigation_brief(uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.approve_investigation_review(uuid,uuid,uuid,bigint,jsonb) to service_role;
revoke all on function public.read_investigation_review(uuid,uuid) from public, anon, service_role;
revoke all on function public.edit_investigation_brief(uuid,uuid,bigint,jsonb) from public, anon, service_role;
grant execute on function public.read_investigation_review(uuid,uuid) to authenticated;
grant execute on function public.edit_investigation_brief(uuid,uuid,bigint,jsonb) to authenticated;

create function public.read_customer_investigation(p_parcel_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform investigation_private.lock_property(auth.uid(), p_parcel_id);
  return investigation_private.snapshot(auth.uid(), p_parcel_id);
end;
$$;
revoke all on function public.read_customer_investigation(text) from public, anon, service_role;
grant execute on function public.read_customer_investigation(text) to authenticated;

create function public.read_order_investigation_asset(p_order_id uuid, p_asset_id uuid, p_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_asset public.erf_assets; v_version jsonb; v_saved jsonb;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  if p_version_id is not null then
    v_version := public.read_investigation_review(p_order_id, p_version_id);
    select a into v_saved from jsonb_array_elements(v_version->'evidence_snapshot'->'assets') a
      where a->>'id' = p_asset_id::text and a->>'user_id' = v_order.user_id::text and a->>'parcel_id' = v_order.parcel_id;
    if v_saved is null then raise exception 'Asset unavailable for this investigation' using errcode = '42501'; end if;
    return v_saved;
  end if;
  select * into v_asset from public.erf_assets where id = p_asset_id and user_id = v_order.user_id
    and parcel_id = v_order.parcel_id and status not in ('deleted','archived');
  if not found then raise exception 'Asset unavailable for this investigation' using errcode = '42501'; end if;
  return to_jsonb(v_asset);
end;
$$;
revoke all on function public.read_order_investigation_asset(uuid,uuid,uuid) from public, anon, service_role;
grant execute on function public.read_order_investigation_asset(uuid,uuid,uuid) to authenticated;

create function public.reserve_order_investigation_asset(p_order_id uuid, p_expected_revision bigint, p_category text, p_name text, p_mime text, p_size bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders; v_asset public.erf_assets; v_id uuid := gen_random_uuid(); v_name text; v_parcel text;
begin
  v_order := investigation_private.require_order(p_order_id, auth.uid(), 'write');
  if coalesce((select revision from investigation_private.revisions where customer_id = v_order.user_id and parcel_id = v_order.parcel_id),0) is distinct from p_expected_revision then
    raise exception 'Evidence changed. Reload before upload.' using errcode = '40001'; end if;
  if p_category is null or p_category not in ('official_document','sg_diagram','paid_report','title_deed','zoning_document','topography','site_photo','existing_house_photo','architectural_plan','other')
    or p_mime is null or p_mime not in ('application/pdf','image/png','image/jpeg','image/tiff','image/webp')
    or p_size is null or p_size <= 0 or p_size > 26214400 or nullif(btrim(p_name),'') is null then
    raise exception 'Unsupported document' using errcode = '22023'; end if;
  v_name := left(regexp_replace(p_name, '[^a-zA-Z0-9._-]', '-', 'g'), 120);
  v_parcel := left(btrim(regexp_replace(normalize(v_order.parcel_id, NFKC), '[[:cntrl:]/\\]+', '-', 'g')), 180);
  insert into public.erf_assets(id,user_id,parcel_id,asset_category,asset_type,source_label,storage_bucket,storage_path,original_file_name,mime_type,size_bytes,status,metadata)
    values(v_id,v_order.user_id,v_order.parcel_id,p_category,p_category,'Investigation upload','erf-files',
      v_order.user_id::text || '/' || v_parcel || '/' || p_category || '/' || v_id::text || '/' || v_name,
      p_name,p_mime,p_size,'pending_upload',jsonb_build_object('uploadedBy',auth.uid(),'investigationOrderId',p_order_id))
    returning * into v_asset;
  insert into public.report_order_events(report_order_id,actor_user_id,action,from_status,to_status,metadata)
    values(p_order_id,auth.uid(),'investigation_asset_reserved',v_order.status,v_order.status,jsonb_build_object('assetId',v_id));
  return to_jsonb(v_asset);
end;
$$;
revoke all on function public.reserve_order_investigation_asset(uuid,bigint,text,text,text,bigint) from public, anon, service_role;
grant execute on function public.reserve_order_investigation_asset(uuid,bigint,text,text,text,bigint) to authenticated;

create function public.finish_order_investigation_asset(p_order_id uuid, p_asset_id uuid, p_actor_id uuid, p_uploaded boolean, p_checksum text default null, p_permissions jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.report_orders;
begin
  v_order := investigation_private.require_order(p_order_id, p_actor_id, 'write');
  if p_uploaded and (p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$') then raise exception 'Upload checksum required' using errcode = '22023'; end if;
  update public.erf_assets set status = case when p_uploaded then 'uploaded_reference_only' else 'failed' end,
    asset_type = coalesce(nullif(left(btrim(p_permissions->>'assetType'),120),''),asset_type),
    source_label = coalesce(nullif(left(btrim(p_permissions->>'sourceLabel'),200),''),source_label),
    checksum_sha256 = p_checksum, metadata = metadata || jsonb_build_object(
      'aiProcessingAllowed', p_permissions->'aiProcessingAllowed' = 'true'::jsonb,
      'redistributionAllowed', p_permissions->'redistributionAllowed' = 'true'::jsonb) ||
      case when asset_category = 'sg_diagram' then jsonb_build_object('identityBinding','user_confirmed',
        'identityUserConfirmedParcelId',v_order.parcel_id,'identityUserConfirmedAt',now(),'identityUserConfirmedBy',p_actor_id) else '{}'::jsonb end
    where id = p_asset_id and user_id = v_order.user_id and parcel_id = v_order.parcel_id and status = 'pending_upload'
      and metadata->>'uploadedBy' = p_actor_id::text;
  if not found then raise exception 'Upload reservation unavailable' using errcode = '42501'; end if;
  insert into public.report_order_events(report_order_id,actor_user_id,action,from_status,to_status,metadata)
    values(p_order_id,p_actor_id,case when p_uploaded then 'investigation_asset_uploaded' else 'investigation_asset_upload_failed' end,
      v_order.status,v_order.status,jsonb_build_object('assetId',p_asset_id));
end;
$$;
revoke all on function public.finish_order_investigation_asset(uuid,uuid,uuid,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.finish_order_investigation_asset(uuid,uuid,uuid,boolean,text,jsonb) to service_role;

create table investigation_private.release_boundary (
  id boolean primary key default true check(id),
  activated_at timestamptz not null default now()
);
alter table investigation_private.release_boundary enable row level security;
insert into investigation_private.release_boundary(id) values(true);

create function investigation_private.require_combined_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_version public.investigation_review_versions; v_key text;
begin
  if new.status_enum::text is distinct from 'complete' or old.status_enum::text = 'complete'
    or new.provider is distinct from 'stripe' or new.payload->>'orderKind' is distinct from 'easy_erf_investigation' then return new; end if;
  -- Keep pre-existing delivered reports readable. Newly enrolled and new orders must use the combined product.
  if new.created_at < (select activated_at from investigation_private.release_boundary where id)
    and not exists(select 1 from public.investigation_assignments where order_id = new.id)
    and not exists(select 1 from public.investigation_review_versions where order_id = new.id) then return new; end if;
  perform investigation_private.lock_property(new.user_id, new.parcel_id);
  select * into v_version from public.investigation_review_versions
    where id::text = new.review_content->>'combinedReviewVersionId' and order_id = new.id
      and customer_id = new.user_id and parcel_id = new.parcel_id and approved_at is not null;
  if not found or v_version.evidence_revision is distinct from coalesce((select revision from investigation_private.revisions
    where customer_id = new.user_id and parcel_id = new.parcel_id),0) then
    raise exception 'Current evidence-bound human approval is required before delivery' using errcode = '23514';
  end if;
  if not coalesce(public.has_role(v_version.approved_by, 'admin'), false) and not exists (
    select 1 from public.investigation_assignments where order_id = new.id and worker_id = v_version.approved_by
      and revoked_at is null and can_approve) then
    raise exception 'Review approval authority has been revoked' using errcode = '42501'; end if;
  for v_key in select jsonb_object_keys(v_version.approved_content) loop
    if new.review_content->v_key is distinct from v_version.approved_content->v_key then
      raise exception 'Report content changed after approval' using errcode = '23514'; end if;
  end loop;
  update public.investigation_review_versions set delivered_at = coalesce(delivered_at, now()) where id = v_version.id;
  return new;
end;
$$;
revoke all on function investigation_private.require_combined_delivery() from public, anon, authenticated, service_role;
create trigger require_combined_investigation_delivery before update on public.report_orders
  for each row execute function investigation_private.require_combined_delivery();

-- The assigned-worker queue contains metadata only, never report bodies or receipts.
create function public.list_assigned_investigation_queue()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'parcel_id', o.parcel_id, 'report_type', o.report_type,
    'status', o.status, 'status_enum', o.status_enum, 'provider', o.provider,
    'price_cents', o.price_cents, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'completed_at', o.completed_at,
    'payment_mode', case when o.payload->>'livemode' = 'true' then 'LIVE'
      when o.payload->>'livemode' = 'false' then 'TEST' else 'UNKNOWN' end,
    'has_property_reference', coalesce(jsonb_typeof(o.payload->'propertyReference') = 'string'
      and (o.payload->>'propertyReference') ~ '[a-zA-Z]',false),
    'has_review_focus', coalesce(o.review_focus ~ '[^[:space:]]',false),
    'has_report_content', coalesce(jsonb_typeof(o.review_content) = 'object' and (
      (jsonb_typeof(o.review_content->'bottomLine') = 'string' and (o.review_content->>'bottomLine') ~ '[^[:space:]]')
      or exists(select 1 from unnest(array['known','potential','risks','unknowns','nextSteps']) s(key)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(o.review_content->s.key) = 'array'
          then o.review_content->s.key else '[]'::jsonb end) item(value)
        where jsonb_typeof(item.value) = 'string' and (item.value #>> '{}') ~ '[^[:space:]]')
    ),false)
  ) from public.report_orders o join public.investigation_assignments a on a.order_id = o.id
  where a.worker_id = auth.uid() and a.revoked_at is null
    and o.provider = 'stripe' and o.payload->>'orderKind' = 'easy_erf_investigation'
  order by o.created_at desc, o.id limit 100;
$$;

create function public.read_assigned_investigation_header(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.report_orders;
begin
  o := investigation_private.require_order(p_order_id, auth.uid(), 'read');
  -- No notification payloads, customer identity joins, or other orders.
  return jsonb_build_object('id',o.id,'user_id',o.user_id,'parcel_id',o.parcel_id,
    'report_type',o.report_type,'status',o.status,'status_enum',o.status_enum,'provider',o.provider,
    'price_cents',o.price_cents,'created_at',o.created_at,'updated_at',o.updated_at,'completed_at',o.completed_at,
    'pdf_storage_path',null,'failure_reason',null,'review_focus',o.review_focus,'intended_use',o.intended_use,
    'review_context',o.review_context,'review_content',null,'review_content_updated_at',o.review_content_updated_at,
    'payload',jsonb_build_object('orderKind','easy_erf_investigation',
      'propertyReference',o.payload->'propertyReference','livemode',o.payload->'livemode'));
end;
$$;
revoke all on function public.list_assigned_investigation_queue() from public, anon, service_role;
revoke all on function public.read_assigned_investigation_header(uuid) from public, anon, service_role;
grant execute on function public.list_assigned_investigation_queue() to authenticated;
grant execute on function public.read_assigned_investigation_header(uuid) to authenticated;

create function public.change_order_investigation_asset(p_order_id uuid, p_asset_id uuid, p_expected_revision bigint, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.report_orders; a public.erf_assets;
begin
  o := investigation_private.require_order(p_order_id, auth.uid(), 'write');
  if coalesce((select revision from investigation_private.revisions where customer_id = o.user_id and parcel_id = o.parcel_id),0) is distinct from p_expected_revision then
    raise exception 'Evidence changed. Reload before updating the document.' using errcode = '40001'; end if;
  select * into a from public.erf_assets where id = p_asset_id and user_id = o.user_id and parcel_id = o.parcel_id and status not in ('deleted','archived') for update;
  if not found then raise exception 'Document unavailable' using errcode = '42501'; end if;
  if p_action = 'confirm_identity' then
    if a.metadata->>'identityMatchStatus' is distinct from 'unverified' or coalesce(a.metadata->>'extractionStatus','') not in ('ready','partial')
      or (a.metadata->>'identityBinding' = 'user_confirmed' and a.metadata->>'identityUserConfirmedParcelId' = o.parcel_id) then
      raise exception 'Only readable uncertain identity may be confirmed' using errcode = '23514'; end if;
    update public.erf_assets set metadata = metadata || jsonb_build_object('identityBinding','user_confirmed',
      'identityUserConfirmedParcelId',o.parcel_id,'identityUserConfirmedAt',now(),'identityUserConfirmedBy',auth.uid()) where id = a.id;
  elsif p_action = 'archive' then
    -- Retain bytes and historical version evidence; do not destroy a delivered source.
    update public.erf_assets set status = 'archived' where id = a.id;
  else raise exception 'Unsupported document action' using errcode = '22023'; end if;
  insert into public.report_order_events(report_order_id,actor_user_id,action,from_status,to_status,metadata)
    values(o.id,auth.uid(),'investigation_asset_' || p_action,o.status,o.status,jsonb_build_object('assetId',a.id,'previousRevision',p_expected_revision));
end;
$$;
revoke all on function public.change_order_investigation_asset(uuid,uuid,bigint,text) from public, anon, service_role;
grant execute on function public.change_order_investigation_asset(uuid,uuid,bigint,text) to authenticated;

create function public.authorize_order_investigation_extraction(p_order_id uuid, p_asset_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare o public.report_orders;
begin
  o := investigation_private.require_order(p_order_id, auth.uid(), 'write');
  if not exists(select 1 from public.erf_assets where id = p_asset_id and user_id = o.user_id and parcel_id = o.parcel_id
    and status not in ('deleted','archived','pending_upload') and metadata->'aiProcessingAllowed' = 'true'::jsonb) then
    raise exception 'Document processing permission is required for this investigation' using errcode = '42501'; end if;
  insert into public.report_order_events(report_order_id,actor_user_id,action,from_status,to_status,metadata)
    values(o.id,auth.uid(),'investigation_extraction_requested',o.status,o.status,jsonb_build_object('assetId',p_asset_id));
  return true;
end;
$$;
revoke all on function public.authorize_order_investigation_extraction(uuid,uuid) from public, anon, service_role;
grant execute on function public.authorize_order_investigation_extraction(uuid,uuid) to authenticated;

-- Restrictive policy supplements (never widens) the existing owner-only policy.
create function public.may_read_investigation_original(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and split_part(p_name,'/',1) = auth.uid()::text
    and not exists(select 1 from public.erf_assets a
      where a.user_id = auth.uid() and a.asset_category = 'paid_report'
        and a.metadata ? 'investigationOrderId' and a.metadata->'redistributionAllowed' is distinct from 'true'::jsonb
        and p_name in (a.storage_path, a.metadata->>'sgPreviewStoragePath'));
$$;
revoke all on function public.may_read_investigation_original(text) from public, anon, service_role;
grant execute on function public.may_read_investigation_original(text) to authenticated;
create policy "investigation originals retain licensed access" on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'erf-files' or public.may_read_investigation_original(name));

create function investigation_private.protect_asset_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and auth.uid() = old.user_id and old.metadata ? 'investigationOrderId'
    and (new.metadata->'investigationOrderId',new.metadata->'redistributionAllowed',new.metadata->'aiProcessingAllowed',
      new.storage_path,new.storage_bucket,new.asset_category)
      is distinct from (old.metadata->'investigationOrderId',old.metadata->'redistributionAllowed',old.metadata->'aiProcessingAllowed',
      old.storage_path,old.storage_bucket,old.asset_category) then
    raise exception 'Investigation document permissions cannot be changed by the customer' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.metadata ? 'investigationOrderId' then
    raise exception 'Archive investigation documents instead of deleting their provenance' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger investigation_asset_permissions before update or delete on public.erf_assets
  for each row execute function investigation_private.protect_asset_permissions();

-- A saved review keeps its original bytes even if the working asset is archived.
-- No source is silently replaced under an approved version's storage path.
create function investigation_private.protect_reviewed_file()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_target record;
begin
  if tg_op <> 'INSERT' then v_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new); end if;
  -- Reads may touch access timestamps. They neither change evidence nor invalidate approval.
  if tg_op = 'UPDATE' and v_before - 'updated_at' - 'last_accessed_at'
      = v_after - 'updated_at' - 'last_accessed_at' then return new; end if;
  for v_target in
    select a.user_id customer_id, a.parcel_id from public.erf_assets a
      where a.storage_bucket = 'erf-files' and
        ((v_before->>'bucket_id' = 'erf-files' and v_before->>'name' in (a.storage_path,a.metadata->>'sgPreviewStoragePath'))
        or (v_after->>'bucket_id' = 'erf-files' and v_after->>'name' in (a.storage_path,a.metadata->>'sgPreviewStoragePath')))
    union
    select r.customer_id, r.parcel_id from public.investigation_review_versions r
      cross join lateral jsonb_array_elements(r.evidence_snapshot->'assets') a
      where r.approved_at is not null and
        ((v_before->>'bucket_id' = 'erf-files' and v_before->>'name' in (a->>'storage_path',a->'metadata'->>'sgPreviewStoragePath'))
        or (v_after->>'bucket_id' = 'erf-files' and v_after->>'name' in (a->>'storage_path',a->'metadata'->>'sgPreviewStoragePath')))
    order by customer_id, parcel_id
  loop
    if tg_when = 'BEFORE' then
      perform investigation_private.lock_property(v_target.customer_id, v_target.parcel_id);
    else
      insert into investigation_private.revisions(customer_id,parcel_id,revision)
        values(v_target.customer_id,v_target.parcel_id,1)
        on conflict(customer_id,parcel_id) do update set revision = investigation_private.revisions.revision + 1;
    end if;
  end loop;
  if tg_when = 'BEFORE' and exists(
    select 1 from public.investigation_review_versions r
      cross join lateral jsonb_array_elements(r.evidence_snapshot->'assets') a
    where r.approved_at is not null and
      ((v_before->>'bucket_id' = 'erf-files' and v_before->>'name' in (a->>'storage_path',a->'metadata'->>'sgPreviewStoragePath'))
      or (v_after->>'bucket_id' = 'erf-files' and v_after->>'name' in (a->>'storage_path',a->'metadata'->>'sgPreviewStoragePath')))
  ) then raise exception 'This file is retained by an approved investigation version' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger investigation_reviewed_file_retained before insert or update or delete on storage.objects
  for each row execute function investigation_private.protect_reviewed_file();
create trigger investigation_storage_revision after insert or update or delete on storage.objects
  for each row execute function investigation_private.protect_reviewed_file();
revoke all on function investigation_private.protect_asset_permissions(), investigation_private.protect_reviewed_file()
  from public, anon, authenticated, service_role;
