begin;

-- Read-only projection. Private report/payload values are inspected only inside
-- PostgreSQL; the queue receives flags, never the underlying documents or notes.
create or replace function public.list_easy_erf_founder_queue(p_limit integer default 100)
returns table (
  id uuid,
  parcel_id text,
  report_type text,
  status text,
  status_enum text,
  provider text,
  price_cents integer,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  payment_mode text,
  has_property_reference boolean,
  has_review_focus boolean,
  has_report_content boolean
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or public.has_role(auth.uid(), 'admin'::public.app_role) is not true then
    raise exception 'Founder admin access is required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Queue limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  select
    r.id,
    r.parcel_id::text,
    r.report_type::text,
    r.status::text,
    r.status_enum::text,
    r.provider::text,
    r.price_cents::integer,
    r.created_at,
    r.updated_at,
    r.completed_at,
    case r.payload ->> 'livemode'
      when 'true' then 'LIVE'
      when 'false' then 'TEST'
      else 'UNKNOWN'
    end,
    coalesce(
      jsonb_typeof(r.payload -> 'propertyReference') = 'string'
      and (r.payload ->> 'propertyReference') ~ '[a-zA-Z]',
      false
    ),
    coalesce(r.review_focus ~ '[^[:space:]]', false),
    coalesce(
      jsonb_typeof(r.review_content) = 'object'
      and (
        (
          jsonb_typeof(r.review_content -> 'bottomLine') = 'string'
          and (r.review_content ->> 'bottomLine') ~ '[^[:space:]]'
        )
        or exists (
          select 1
          from unnest(array['known', 'potential', 'risks', 'unknowns', 'nextSteps']) as section(key)
          cross join lateral jsonb_array_elements(
            case when jsonb_typeof(r.review_content -> section.key) = 'array'
              then r.review_content -> section.key else '[]'::jsonb end
          ) as item(value)
          where jsonb_typeof(item.value) = 'string'
            and (item.value #>> '{}') ~ '[^[:space:]]'
        )
      ),
      false
    )
  from public.report_orders r
  where r.provider = 'stripe'
  order by r.created_at desc, r.id
  limit p_limit;
end;
$$;

-- The existing caller's table RLS still applies. This function does not grant
-- access to report_orders, change a policy, bypass RLS, or accept an actor ID.
revoke all on function public.list_easy_erf_founder_queue(integer) from public, anon;
grant execute on function public.list_easy_erf_founder_queue(integer) to authenticated;
comment on function public.list_easy_erf_founder_queue(integer)
is 'Admin-only, security-invoker, read-only queue metadata. Private report details require a separate exact-order read.';

commit;
