CREATE OR REPLACE FUNCTION public.patch_saved_property_user_data(
  p_parcel_id text,
  p_user_data_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing jsonb;
  v_patch jsonb := COALESCE(p_user_data_patch, '{}'::jsonb);
  v_current_strategy jsonb;
  v_incoming_strategy jsonb;
  v_current_draft timestamptz;
  v_incoming_draft timestamptz;
  v_current_chosen timestamptz;
  v_incoming_chosen timestamptz;
  v_merged jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_parcel_id IS NULL OR btrim(p_parcel_id) = '' THEN
    RAISE EXCEPTION 'parcel_id is required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'user_data patch must be an object' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.saved_properties (user_id, parcel_id, user_data)
  VALUES (v_user_id, p_parcel_id, '{}'::jsonb)
  ON CONFLICT (user_id, parcel_id) DO NOTHING;

  SELECT COALESCE(user_data, '{}'::jsonb)
    INTO v_existing
    FROM public.saved_properties
   WHERE user_id = v_user_id
     AND parcel_id = p_parcel_id
   FOR UPDATE;

  v_current_strategy := v_existing -> 'strategyWorkspace';
  v_incoming_strategy := v_patch -> 'strategyWorkspace';

  IF jsonb_typeof(v_current_strategy) = 'object'
     AND jsonb_typeof(v_incoming_strategy) = 'object' THEN
    BEGIN
      v_current_draft := NULLIF(v_current_strategy ->> 'draftUpdatedAt', '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_current_draft := NULL;
    END;

    BEGIN
      v_incoming_draft := NULLIF(v_incoming_strategy ->> 'draftUpdatedAt', '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_incoming_draft := NULL;
    END;

    BEGIN
      v_current_chosen := NULLIF(v_current_strategy ->> 'chosenScenarioUpdatedAt', '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_current_chosen := NULL;
    END;

    BEGIN
      v_incoming_chosen := NULLIF(v_incoming_strategy ->> 'chosenScenarioUpdatedAt', '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_incoming_chosen := NULL;
    END;

    IF (v_current_draft IS NOT NULL AND (v_incoming_draft IS NULL OR v_incoming_draft < v_current_draft))
       OR (v_current_chosen IS NOT NULL AND (v_incoming_chosen IS NULL OR v_incoming_chosen < v_current_chosen)) THEN
      v_patch := v_patch - 'strategyWorkspace' - 'strategyWorkspaceUpdatedAt';
    END IF;
  END IF;

  v_merged := v_existing || v_patch;

  UPDATE public.saved_properties
     SET user_data = v_merged
   WHERE user_id = v_user_id
     AND parcel_id = p_parcel_id;

  RETURN v_merged;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_saved_property_user_data(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_saved_property_user_data(text, jsonb) TO authenticated;
