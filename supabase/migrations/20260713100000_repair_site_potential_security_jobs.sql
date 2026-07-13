-- Repair Site Potential entitlement writes, generation idempotency and asset ownership checks.

DROP POLICY IF EXISTS "users insert own pending design packs" ON public.erf_design_packs;
DROP POLICY IF EXISTS "users update own design packs" ON public.erf_design_packs;

CREATE TABLE IF NOT EXISTS public.erf_design_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_pack_id uuid NOT NULL REFERENCES public.erf_design_packs(id) ON DELETE CASCADE,
  option_index integer NOT NULL CHECK (option_index BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'generating', 'complete', 'failed', 'cancelled')
  ),
  generated_asset_id uuid REFERENCES public.erf_assets(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_pack_id, option_index)
);

CREATE INDEX IF NOT EXISTS erf_design_pack_items_pack_idx
ON public.erf_design_pack_items (design_pack_id, option_index);

CREATE INDEX IF NOT EXISTS erf_design_pack_items_user_idx
ON public.erf_design_pack_items (user_id, status, updated_at DESC);

ALTER TABLE public.erf_design_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own design pack items" ON public.erf_design_pack_items;
CREATE POLICY "users read own design pack items"
ON public.erf_design_pack_items FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS erf_design_pack_items_set_updated_at ON public.erf_design_pack_items;
CREATE TRIGGER erf_design_pack_items_set_updated_at
BEFORE UPDATE ON public.erf_design_pack_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_site_project_selected_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asset_row record;
BEGIN
  IF NEW.selected_design_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id, parcel_id, asset_category
  INTO asset_row
  FROM public.erf_assets
  WHERE id = NEW.selected_design_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected design asset does not exist';
  END IF;

  IF asset_row.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Selected design asset does not belong to this user';
  END IF;

  IF asset_row.parcel_id <> NEW.parcel_id THEN
    RAISE EXCEPTION 'Selected design asset does not belong to this parcel';
  END IF;

  IF asset_row.asset_category <> 'generated_design' THEN
    RAISE EXCEPTION 'Selected design asset must be a generated design';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erf_site_projects_selected_design_integrity ON public.erf_site_projects;
CREATE TRIGGER erf_site_projects_selected_design_integrity
BEFORE INSERT OR UPDATE OF selected_design_asset_id, user_id, parcel_id
ON public.erf_site_projects
FOR EACH ROW EXECUTE FUNCTION public.ensure_site_project_selected_design();

CREATE OR REPLACE FUNCTION public.ensure_site_project_asset_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_row record;
  asset_row record;
BEGIN
  SELECT user_id, parcel_id
  INTO project_row
  FROM public.erf_site_projects
  WHERE id = NEW.site_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site Potential project does not exist';
  END IF;

  SELECT user_id, parcel_id
  INTO asset_row
  FROM public.erf_assets
  WHERE id = NEW.asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Erf asset does not exist';
  END IF;

  IF NEW.user_id <> project_row.user_id OR NEW.user_id <> asset_row.user_id THEN
    RAISE EXCEPTION 'Project and asset must belong to the same user';
  END IF;

  IF project_row.parcel_id <> asset_row.parcel_id THEN
    RAISE EXCEPTION 'Project and asset must belong to the same parcel';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erf_site_project_assets_integrity ON public.erf_site_project_assets;
CREATE TRIGGER erf_site_project_assets_integrity
BEFORE INSERT OR UPDATE OF user_id, site_project_id, asset_id
ON public.erf_site_project_assets
FOR EACH ROW EXECUTE FUNCTION public.ensure_site_project_asset_integrity();
