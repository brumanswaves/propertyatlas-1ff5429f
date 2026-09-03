begin;

create or replace function public.enforce_easy_erf_review_delivery_readiness()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_section text;
  v_item text;
  v_checklist jsonb;
  v_checklist_count integer;
  v_status text;
begin
  if new.provider is distinct from 'stripe'
     or coalesce(new.payload ->> 'orderKind', '') <> 'easy_erf_investigation' then
    return new;
  end if;

  if new.status is distinct from 'ready'
     and coalesce(new.status_enum::text, '') <> 'complete' then
    return new;
  end if;

  if new.review_content is null
     or jsonb_typeof(new.review_content) is distinct from 'object'
     or jsonb_typeof(new.review_content -> 'bottomLine') is distinct from 'string'
     or nullif(btrim(new.review_content ->> 'bottomLine'), '') is null then
    raise exception
      'A complete structured Human Review web report is required before marking ready';
  end if;

  foreach v_section in array array['known', 'potential', 'risks', 'unknowns', 'nextSteps']
  loop
    if jsonb_typeof(new.review_content -> v_section) is distinct from 'array'
       or jsonb_array_length(new.review_content -> v_section) < 1
       or jsonb_array_length(new.review_content -> v_section) > 8 then
      raise exception
        'A complete structured Human Review web report is required before marking ready';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(new.review_content -> v_section) as entry(value)
      where jsonb_typeof(entry.value) <> 'string'
         or nullif(btrim(entry.value #>> '{}'), '') is null
    ) then
      raise exception
        'A complete structured Human Review web report is required before marking ready';
    end if;
  end loop;

  v_checklist := new.review_content -> 'investigationChecklist';
  if jsonb_typeof(v_checklist) is distinct from 'object' then
    raise exception
      'A complete standard investigation checklist is required before marking ready';
  end if;

  select count(*) into v_checklist_count
  from jsonb_object_keys(v_checklist);

  if v_checklist_count <> 9 then
    raise exception
      'A complete standard investigation checklist is required before marking ready';
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
    v_status := v_checklist ->> v_item;
    if v_status is null then
      raise exception
        'A complete standard investigation checklist is required before marking ready';
    end if;
    if v_status not in ('complete', 'not_applicable') then
      raise exception
        'Every standard investigation checklist item must be complete or not applicable before marking ready';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.enforce_easy_erf_review_delivery_readiness()
from public, anon, authenticated;
grant execute on function public.enforce_easy_erf_review_delivery_readiness()
to service_role;

drop trigger if exists enforce_easy_erf_review_delivery_readiness
on public.report_orders;

create trigger enforce_easy_erf_review_delivery_readiness
before update of status, status_enum, review_content
on public.report_orders
for each row
execute function public.enforce_easy_erf_review_delivery_readiness();

comment on function public.enforce_easy_erf_review_delivery_readiness()
is 'Blocks Easy Erf R999 delivery until the structured report is complete and every standard investigation checklist item is complete or not applicable.';

commit;
