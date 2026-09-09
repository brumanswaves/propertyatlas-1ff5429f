\set ON_ERROR_STOP on
\i scripts/verify-easy-erf-founder-queue.sql

-- Isolated PostgreSQL fixture: real role enforcement and committed canonical rows.
alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}';
\i supabase/migrations/20260610065719_286b13eb-4dee-460b-a0c0-6339f6162c22.sql
create or replace function public.update_updated_at_column() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
\i supabase/migrations/20260617153206_9c7217f5-c6cf-4802-97ed-89b234837e33.sql
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create function storage.foldername(text) returns text[] language sql immutable as $$
  select (string_to_array($1, '/'))[1:cardinality(string_to_array($1, '/')) - 1];
$$;
alter table storage.objects enable row level security;
alter table storage.objects add column last_accessed_at timestamptz;
\i supabase/migrations/20260713090000_erf_file_vault_site_potential.sql
\i supabase/migrations/20260720193000_patch_saved_property_user_data.sql
\i supabase/migrations/20260909094547_shared_investigation_fulfillment.sql

insert into auth.users(id) values
  ('55555555-5555-4555-8555-555555555555'), -- worker
  ('66666666-6666-4666-8666-666666666666'), -- customer B
  ('77777777-7777-4777-8777-777777777777'); -- unauthorized
insert into public.saved_properties(user_id, parcel_id, user_data) values
  ('22222222-2222-4222-8222-222222222222', 'synthetic:shared-a', '{"privateNote":"A ONLY", "strategyWorkspace":{"draftInputs":{"landCost":"900000"}}}'),
  ('66666666-6666-4666-8666-666666666666', 'synthetic:shared-b', '{"privateNote":"B PRIVATE SENTINEL"}');
insert into public.report_orders(id, user_id, parcel_id, provider, report_type, status, status_enum, payload) values
  ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','synthetic:shared-a','stripe','human_review','processing','fulfilling','{"orderKind":"easy_erf_investigation","livemode":false}'),
  ('99999999-9999-4999-8999-999999999999','66666666-6666-4666-8666-666666666666','synthetic:shared-b','stripe','human_review','processing','fulfilling','{"orderKind":"easy_erf_investigation","livemode":false}');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.assign_order_investigator('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',false);
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
do $$
declare v jsonb; saved jsonb;
begin
  v := public.read_order_investigation('88888888-8888-4888-8888-888888888888');
  if v->>'customerId' <> '22222222-2222-4222-8222-222222222222' or v->'userData' ? 'privateNote'
     or v::text like '%B PRIVATE%' or (v->>'canApprove')::boolean then raise exception 'Scope/capability mismatch'; end if;
  saved := public.patch_order_investigation('88888888-8888-4888-8888-888888888888', (v->>'revision')::bigint,
    '{"easyErfInvestigation":{"identityStatus":"checked"}}');
  if saved->'userData' ? 'privateNote' or saved->'userData'->'strategyWorkspace' is null then
    raise exception 'Private data exposed or saved strategy lost'; end if;
  begin
    perform public.patch_order_investigation('88888888-8888-4888-8888-888888888888', (v->>'revision')::bigint, '{"easyErfInvestigation":{}}');
    raise exception 'Stale save accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.read_order_investigation('99999999-9999-4999-8999-999999999999');
    raise exception 'Cross-customer read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assign_order_investigator('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',true);
    raise exception 'Worker self-promotion accepted';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.saved_properties) then raise exception 'Worker gained blanket table read'; end if;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.assign_order_investigator('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',false,true);
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
do $$ begin
  begin
    perform public.read_order_investigation('88888888-8888-4888-8888-888888888888');
    raise exception 'Revoked worker retained access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.patch_order_investigation('88888888-8888-4888-8888-888888888888',0,'{}');
    raise exception 'Revoked worker could save';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$ begin
  if public.read_order_investigation('88888888-8888-4888-8888-888888888888')->'userData'->'easyErfInvestigation'->>'identityStatus' <> 'checked' then
    raise exception 'Customer fresh read missed worker save'; end if;
end $$;
reset role;
do $$ begin
  if (select user_data->>'privateNote' from public.saved_properties where user_id = '22222222-2222-4222-8222-222222222222' and parcel_id = 'synthetic:shared-a') <> 'A ONLY' then
    raise exception 'Unrelated private namespace overwritten'; end if;
  if exists(select 1 from public.saved_properties where user_id = '55555555-5555-4555-8555-555555555555') then
    raise exception 'Worker-owned copy created'; end if;
  if has_function_privilege('anon','public.read_order_investigation(uuid)','execute')
     or has_function_privilege('authenticated','investigation_private.snapshot(uuid,text)','execute') then
    raise exception 'Private scope bypass exposed'; end if;
  if (select count(*) from public.report_order_events where action = 'investigation_saved') <> 1 then
    raise exception 'Save audit missing'; end if;
end $$;
select 'Shared investigation delegation, isolation, revocation, stale-save and customer reload checks passed' as result;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.assign_order_investigator('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',false);
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
do $$ begin
  begin
    perform public.record_investigation_brief('88888888-8888-4888-8888-888888888888',auth.uid(),0,'{}','[]','{"eligible":true}','{}','forged');
    raise exception 'Worker forged provider generation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.approve_investigation_review('88888888-8888-4888-8888-888888888888',gen_random_uuid(),auth.uid(),1,'{}');
    raise exception 'Worker forged service signoff';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Synthetic provider attestation, not a live model call. Permission/state transitions are real SQL.
insert into public.erf_assets(id,user_id,parcel_id,asset_category,asset_type,storage_bucket,storage_path,original_file_name,mime_type,size_bytes,status,metadata) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','synthetic:shared-a',
    'sg_diagram','sg_diagram','erf-files','22222222-2222-4222-8222-222222222222/synthetic:shared-a/sg_diagram/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sg.png',
    'sg.png','image/png',4,'ready','{}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','synthetic:shared-a',
    'paid_report','property_report','erf-files','22222222-2222-4222-8222-222222222222/synthetic:shared-a/paid_report/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/licensed.pdf',
    'licensed.pdf','application/pdf',4,'ready','{"investigationOrderId":"88888888-8888-4888-8888-888888888888","redistributionAllowed":false}');
insert into storage.objects(bucket_id,name)
  select storage_bucket,storage_path from public.erf_assets where parcel_id='synthetic:shared-a';
grant select,update,delete on storage.objects to authenticated;
grant usage on schema storage to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
  if (select count(*) from storage.objects where bucket_id='erf-files' and name like '%synthetic:shared-a/%') <> 1 then
    raise exception 'Customer storage access exposed a licensed original'; end if;
  begin
    update public.erf_assets set metadata = metadata || '{"redistributionAllowed":true}'
      where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'Customer changed investigator document license';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='erf-files' and name like '%synthetic:shared-a/%') then
    raise exception 'Assigned worker gained direct customer storage access'; end if;
end $$;
reset role;
do $$
declare v_id uuid; v_edited uuid; v_snapshot jsonb; v_before jsonb; v_revision bigint;
  v_content jsonb := '{"bottomLine":"Synthetic investigated result","known":["Known synthetic fact"],"potential":["Conditional potential"],"risks":["Known limitation"],"unknowns":["Unverified constraint"],"nextSteps":["Obtain professional confirmation"],"investigationChecklist":{"parcel_identity":"complete","cadastral_evidence":"complete","ownership_title":"complete","zoning_planning":"complete","property_checks":"complete","market_evidence":"complete","strategy_calculations":"complete","site_potential":"complete","reviewed_report":"complete"}}';
begin
  update public.report_orders set created_at='2000-01-01', review_content=v_content
    where id='99999999-9999-4999-8999-999999999999';
  begin
    update public.report_orders set status='ready', status_enum='complete', completed_at=now()
      where id='99999999-9999-4999-8999-999999999999';
    raise exception 'Old unenrolled order bypassed evidence-bound approval';
  exception when check_violation then null; end;
  v_snapshot := investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a');
  v_revision := (v_snapshot->>'revision')::bigint;
  v_id := public.record_investigation_brief('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',
    v_revision,'{"fixture":true}','[]','{"eligible":true}',v_content,'synthetic-provider-fixture');
  update storage.objects set metadata='{"eTag":"new-synthetic-bytes"}'
    where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sg.png';
  begin
    perform public.approve_investigation_review('88888888-8888-4888-8888-888888888888',v_id,'11111111-1111-4111-8111-111111111111',1,v_content);
    raise exception 'Changed file bytes did not invalidate the evidence revision';
  exception when serialization_failure then null; end;
  v_snapshot := investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a');
  v_revision := (v_snapshot->>'revision')::bigint;
  v_id := public.record_investigation_brief('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',
    v_revision,'{"fixture":true}','[]','{"eligible":true}',v_content,'synthetic-provider-fixture');
  begin
    perform public.approve_investigation_review('88888888-8888-4888-8888-888888888888',v_id,'55555555-5555-4555-8555-555555555555',1,v_content);
    raise exception 'Non-approving worker approved';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  if public.read_investigation_review('88888888-8888-4888-8888-888888888888',v_id) is not null then
    raise exception 'Customer saw undelivered draft'; end if;
  perform public.patch_saved_property_user_data('synthetic:shared-a','{"customerConcurrentNote":"kept"}');
  begin
    perform public.approve_investigation_review('88888888-8888-4888-8888-888888888888',v_id,'11111111-1111-4111-8111-111111111111',1,v_content);
    raise exception 'Stale evidence approved';
  exception when serialization_failure then null; end;
  v_snapshot := investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a');
  v_revision := (v_snapshot->>'revision')::bigint;
  v_id := public.record_investigation_brief('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',
    v_revision,'{"fixture":true}','[]','{"eligible":true}',v_content,'synthetic-provider-fixture');
  perform public.approve_investigation_review('88888888-8888-4888-8888-888888888888',v_id,'11111111-1111-4111-8111-111111111111',1,v_content);
  begin
    update public.report_orders set review_content = review_content || '{"bottomLine":"Changed after approval"}', status_enum = 'complete'
      where id = '88888888-8888-4888-8888-888888888888';
    raise exception 'Modified content delivered';
  exception when check_violation then null; end;
  update public.report_orders set status = 'ready', status_enum = 'complete', completed_at = now()
    where id = '88888888-8888-4888-8888-888888888888';
  v_before := public.read_investigation_review('88888888-8888-4888-8888-888888888888',v_id);
  if v_before->>'delivered_at' is null then raise exception 'Reviewed version not frozen for delivery'; end if;
  v_revision := (investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a')->>'revision')::bigint;
  update storage.objects set last_accessed_at=clock_timestamp()
    where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sg.png';
  if v_revision <> (investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a')->>'revision')::bigint then
    raise exception 'Read access timestamp invalidated approved evidence'; end if;
  update public.erf_assets set status='archived' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if public.read_order_investigation_asset('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_id)->>'status' <> 'ready' then
    raise exception 'Delivered version lost its retained original after archival'; end if;
  begin
    delete from storage.objects where name='22222222-2222-4222-8222-222222222222/synthetic:shared-a/sg_diagram/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sg.png';
    raise exception 'Approved file was deleted';
  exception when insufficient_privilege then null; end;
  begin
    update storage.objects set name=name || '.replaced'
      where name='22222222-2222-4222-8222-222222222222/synthetic:shared-a/sg_diagram/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sg.png';
    raise exception 'Approved file was overwritten';
  exception when insufficient_privilege then null; end;
  begin
    perform public.patch_saved_property_user_data('synthetic:shared-a','{"easyErfInvestigation":{"identityStatus":"uncertain"}}');
    raise exception 'Unguarded customer save overwrote shared evidence';
  exception when serialization_failure then null; end;
  begin
    perform public.patch_saved_property_user_data_if_unchanged('synthetic:shared-a',
      '{"easyErfInvestigation":{"identityStatus":"uncertain"}}','{"easyErfInvestigation":{"identityStatus":"none"}}');
    raise exception 'Stale customer baseline overwrote shared evidence';
  exception when serialization_failure then null; end;
  v_snapshot := investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a');
  perform public.patch_saved_property_user_data_if_unchanged('synthetic:shared-a',
    jsonb_build_object('easyErfInvestigation',v_snapshot->'userData'->'easyErfInvestigation'),v_snapshot->'userData');
  if (investigation_private.snapshot('22222222-2222-4222-8222-222222222222','synthetic:shared-a')->>'revision')::bigint
    <> (v_snapshot->>'revision')::bigint then raise exception 'No-op save advanced evidence revision'; end if;
  perform public.patch_saved_property_user_data_if_unchanged('synthetic:shared-a',
    '{"easyErfInvestigation":{"identityStatus":"uncertain"}}',v_snapshot->'userData');
  if (public.read_investigation_review('88888888-8888-4888-8888-888888888888',v_id) - 'currentEvidenceRevision') <> (v_before - 'currentEvidenceRevision') then
    raise exception 'Later customer work rewrote delivered snapshot'; end if;
  if (select user_data->>'customerConcurrentNote' from public.saved_properties where parcel_id='synthetic:shared-a') <> 'kept' then
    raise exception 'Concurrent customer update lost'; end if;
end $$;
select 'Shared investigation generation authority, approval, stale evidence and immutable delivery checks passed' as result;
