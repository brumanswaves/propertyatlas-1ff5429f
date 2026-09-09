import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toSupabaseJson } from "@/lib/supabase/json";

type GuardedPatchDatabase = Omit<Database, "public"> & { public: Omit<Database["public"], "Functions"> & {
  Functions: Database["public"]["Functions"] & {
    patch_saved_property_user_data_if_unchanged: {
      Args: { p_parcel_id: string; p_user_data_patch: Json; p_expected: Json }; Returns: Json;
    };
  };
}};

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
  expected?: SavedPropertyUserDataPatch,
) {
  const result = expected ? await (client as unknown as SupabaseClient<GuardedPatchDatabase>).rpc("patch_saved_property_user_data_if_unchanged", {
    p_parcel_id: parcelId, p_user_data_patch: toSupabaseJson(patch),
    p_expected: toSupabaseJson(Object.fromEntries(Object.keys(patch).filter((key) => Object.hasOwn(expected, key)).map((key) => [key, expected[key]]))),
  }) : await client.rpc("patch_saved_property_user_data", {
    p_parcel_id: parcelId,
    p_user_data_patch: patch as Json,
  });
  const { data, error } = result;
  if (error?.code === "40001") throw new Error("This investigation changed in another session. Reload before saving; your changes were not applied.");
  if (error) throw error;
  return isSavedPropertyUserData(data) ? data : mergeSavedPropertyUserDataPatch({}, patch);
}
