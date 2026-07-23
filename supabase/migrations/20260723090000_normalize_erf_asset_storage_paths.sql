-- Normalize legacy Erf File Vault rows whose parcel path segment encoded CSG/LPI colons.
-- This does not move, copy or delete storage objects. It only updates rows that already
-- have a confirmed matching object at the canonical colon-preserving path.
DO $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      asset.id,
      asset.storage_bucket,
      asset.storage_path,
      string_to_array(asset.storage_path, '/') AS parts
    FROM public.erf_assets AS asset
    WHERE asset.storage_path ~ '^[^/]+/[^/]*%3[Aa][^/]*/'
  ),
  normalized AS (
    SELECT
      candidate.id,
      candidate.storage_bucket,
      candidate.storage_path,
      array_to_string(
        ARRAY[
          candidate.parts[1],
          replace(replace(candidate.parts[2], '%3A', ':'), '%3a', ':')
        ] || candidate.parts[3:array_length(candidate.parts, 1)],
        '/'
      ) AS normalized_path
    FROM candidates AS candidate
    WHERE array_length(candidate.parts, 1) >= 5
  ),
  confirmed AS (
    SELECT normalized.id, normalized.normalized_path
    FROM normalized
    WHERE normalized.normalized_path <> normalized.storage_path
      AND EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = normalized.storage_bucket
          AND object.name = normalized.normalized_path
      )
  ),
  updated AS (
    UPDATE public.erf_assets AS asset
    SET
      storage_path = confirmed.normalized_path,
      updated_at = now()
    FROM confirmed
    WHERE asset.id = confirmed.id
      AND asset.storage_path <> confirmed.normalized_path
    RETURNING asset.id
  )
  SELECT count(*) INTO v_updated FROM updated;

  RAISE NOTICE 'normalize_erf_asset_storage_paths updated % erf_assets rows', v_updated;
END $$;
