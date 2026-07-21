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
  v_next_strategy jsonb;
  v_scenarios_by_id jsonb := '{}'::jsonb;
  v_scenario jsonb;
  v_existing_scenario jsonb;
  v_scenario_id text;
  v_scenario_ts timestamptz;
  v_existing_scenario_ts timestamptz;
  v_scenarios jsonb;
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

    v_next_strategy := v_incoming_strategy;

    IF v_current_draft IS NOT NULL AND (v_incoming_draft IS NULL OR v_incoming_draft < v_current_draft) THEN
      v_next_strategy := jsonb_set(
        v_next_strategy,
        '{activeStrategy}',
        COALESCE(v_current_strategy -> 'activeStrategy', 'null'::jsonb),
        true
      );
      v_next_strategy := jsonb_set(
        v_next_strategy,
        '{draftInputs}',
        COALESCE(v_current_strategy -> 'draftInputs', '{}'::jsonb),
        true
      );
      v_next_strategy := jsonb_set(
        v_next_strategy,
        '{draftUpdatedAt}',
        COALESCE(v_current_strategy -> 'draftUpdatedAt', 'null'::jsonb),
        true
      );
    END IF;

    IF v_current_chosen IS NOT NULL AND (v_incoming_chosen IS NULL OR v_incoming_chosen < v_current_chosen) THEN
      v_next_strategy := jsonb_set(
        v_next_strategy,
        '{chosenScenarioId}',
        COALESCE(v_current_strategy -> 'chosenScenarioId', 'null'::jsonb),
        true
      );
      v_next_strategy := jsonb_set(
        v_next_strategy,
        '{chosenScenarioUpdatedAt}',
        COALESCE(v_current_strategy -> 'chosenScenarioUpdatedAt', 'null'::jsonb),
        true
      );
    END IF;

    IF jsonb_typeof(v_current_strategy -> 'scenarios') = 'array' THEN
      FOR v_scenario IN SELECT value FROM jsonb_array_elements(v_current_strategy -> 'scenarios') LOOP
        v_scenario_id := v_scenario ->> 'id';
        IF v_scenario_id IS NOT NULL AND btrim(v_scenario_id) <> '' THEN
          v_scenarios_by_id := jsonb_set(v_scenarios_by_id, ARRAY[v_scenario_id], v_scenario, true);
        END IF;
      END LOOP;
    END IF;

    IF jsonb_typeof(v_incoming_strategy -> 'scenarios') = 'array' THEN
      FOR v_scenario IN SELECT value FROM jsonb_array_elements(v_incoming_strategy -> 'scenarios') LOOP
        v_scenario_id := v_scenario ->> 'id';
        IF v_scenario_id IS NOT NULL AND btrim(v_scenario_id) <> '' THEN
          v_existing_scenario := v_scenarios_by_id -> v_scenario_id;
          BEGIN
            v_scenario_ts := COALESCE(
              NULLIF(v_scenario ->> 'updatedAt', ''),
              NULLIF(v_scenario ->> 'savedAt', '')
            )::timestamptz;
          EXCEPTION WHEN others THEN
            v_scenario_ts := NULL;
          END;
          BEGIN
            v_existing_scenario_ts := COALESCE(
              NULLIF(v_existing_scenario ->> 'updatedAt', ''),
              NULLIF(v_existing_scenario ->> 'savedAt', '')
            )::timestamptz;
          EXCEPTION WHEN others THEN
            v_existing_scenario_ts := NULL;
          END;

          IF v_existing_scenario IS NULL
             OR v_existing_scenario_ts IS NULL
             OR (v_scenario_ts IS NOT NULL AND v_scenario_ts >= v_existing_scenario_ts) THEN
            v_scenarios_by_id := jsonb_set(v_scenarios_by_id, ARRAY[v_scenario_id], v_scenario, true);
          END IF;
        END IF;
      END LOOP;
    END IF;

    SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
      INTO v_scenarios
      FROM jsonb_each(v_scenarios_by_id);

    v_next_strategy := jsonb_set(v_next_strategy, '{scenarios}', v_scenarios, true);

    IF NOT (v_next_strategy ? 'schemaVersion') AND v_current_strategy ? 'schemaVersion' THEN
      v_next_strategy := jsonb_set(v_next_strategy, '{schemaVersion}', v_current_strategy -> 'schemaVersion', true);
    END IF;

    IF NOT (v_next_strategy ? 'parcelId') AND v_current_strategy ? 'parcelId' THEN
      v_next_strategy := jsonb_set(v_next_strategy, '{parcelId}', v_current_strategy -> 'parcelId', true);
    END IF;

    IF NOT (v_next_strategy ? 'migratedFromLegacy') AND v_current_strategy ? 'migratedFromLegacy' THEN
      v_next_strategy := jsonb_set(v_next_strategy, '{migratedFromLegacy}', v_current_strategy -> 'migratedFromLegacy', true);
    END IF;

    v_patch := jsonb_set(v_patch, '{strategyWorkspace}', v_next_strategy, true);
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