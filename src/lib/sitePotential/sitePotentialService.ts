import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth/useAuth";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { toSupabaseJson } from "@/lib/supabase/json";
import type { SitePotentialProject, SitePotentialProjectPatch } from "./types";

export type { SitePotentialProjectPatch } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeProject(row: Record<string, unknown>): SitePotentialProject {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    parcel_id: String(row.parcel_id),
    mode: String(row.mode ?? "unknown") as SitePotentialProject["mode"],
    design_brief: row.design_brief == null ? null : String(row.design_brief),
    selected_style: row.selected_style == null ? null : String(row.selected_style),
    renovation_level:
      row.renovation_level === "cosmetic" ||
      row.renovation_level === "moderate" ||
      row.renovation_level === "major"
        ? row.renovation_level
        : null,
    requested_rooms: Array.isArray(row.requested_rooms) ? row.requested_rooms.map(String) : [],
    requested_features: Array.isArray(row.requested_features)
      ? row.requested_features.map(String)
      : [],
    custom_instructions: row.custom_instructions == null ? null : String(row.custom_instructions),
    rights_confirmed_at: row.rights_confirmed_at == null ? null : String(row.rights_confirmed_at),
    generation_status: String(
      row.generation_status ?? "not_started",
    ) as SitePotentialProject["generation_status"],
    selected_design_asset_id:
      row.selected_design_asset_id == null ? null : String(row.selected_design_asset_id),
    skipped_at: row.skipped_at == null ? null : String(row.skipped_at),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  };
}

export async function readSitePotentialProject(parcelId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const { data, error } = await supabase
    .from("erf_site_projects")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("parcel_id", parcelId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeProject(data) : null;
}

export async function upsertSitePotentialProject(
  parcelId: string,
  patch: SitePotentialProjectPatch,
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to save Site Potential.");
  const payload: TablesInsert<"erf_site_projects"> = {
    user_id: userData.user.id,
    parcel_id: parcelId,
    mode: patch.mode,
    design_brief: patch.design_brief,
    selected_style: patch.selected_style,
    renovation_level: patch.renovation_level,
    requested_rooms: patch.requested_rooms,
    requested_features: patch.requested_features,
    custom_instructions: patch.custom_instructions,
    rights_confirmed_at: patch.rights_confirmed_at,
    generation_status: patch.generation_status,
    selected_design_asset_id: patch.selected_design_asset_id,
    skipped_at: patch.skipped_at,
    metadata: patch.metadata === undefined ? undefined : toSupabaseJson(patch.metadata),
  };
  const { data, error } = await supabase
    .from("erf_site_projects")
    .upsert(payload, { onConflict: "user_id,parcel_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeProject(data);
}

export function resolveSelectedSitePotentialDesign(
  project: SitePotentialProject | null,
  generatedDesigns: ErfAsset[],
) {
  if (!project?.selected_design_asset_id) return null;
  return generatedDesigns.find((asset) => asset.id === project.selected_design_asset_id) ?? null;
}

export function buildSelectedDesignDeletionPatch(
  project: SitePotentialProject | null,
  deletedAsset: ErfAsset,
  generatedDesigns: ErfAsset[],
): SitePotentialProjectPatch | null {
  if (!project?.selected_design_asset_id) return null;
  if (project.selected_design_asset_id !== deletedAsset.id) return null;
  const remainingGeneratedDesigns = generatedDesigns.filter(
    (asset) => asset.id !== deletedAsset.id,
  );
  return {
    selected_design_asset_id: null,
    generation_status: remainingGeneratedDesigns.length ? "concepts_ready" : "not_started",
  };
}

export function useSitePotentialProject(parcelId: string, generatedDesigns: ErfAsset[] = []) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [project, setProject] = useState<SitePotentialProject | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await readSitePotentialProject(parcelId);
      setProject(next);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load project.");
    } finally {
      setLoading(false);
    }
  }, [parcelId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: SitePotentialProjectPatch) => {
      const next = await upsertSitePotentialProject(parcelId, patch);
      setProject(next);
      return next;
    },
    [parcelId],
  );

  const selectedDesign = useMemo(
    () => resolveSelectedSitePotentialDesign(project, generatedDesigns),
    [generatedDesigns, project],
  );

  return {
    project,
    selectedDesign,
    loading,
    error,
    signedIn: Boolean(userId),
    refresh,
    save,
  };
}
