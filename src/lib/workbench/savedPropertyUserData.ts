import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SavedPropertyUserDataPatch = Record<string, unknown>;

export function isSavedPropertyUserData(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeSavedPropertyUserDataPatch(
  existing: unknown,
  patch: SavedPropertyUserDataPatch,
) {
  return {
    ...(isSavedPropertyUserData(existing) ? existing : {}),
    ...patch,
  };
}

export async function patchSavedPropertyUserData(
  parcelId: string,
  patch: SavedPropertyUserDataPatch,
  client = supabase,
) {
  const { data, error } = await client.rpc("patch_saved_property_user_data", {
    p_parcel_id: parcelId,
    p_user_data_patch: patch as Json,
  });
  if (error) throw error;
  return isSavedPropertyUserData(data) ? data : mergeSavedPropertyUserDataPatch({}, patch);
}
