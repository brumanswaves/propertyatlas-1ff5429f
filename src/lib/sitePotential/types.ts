import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export type SitePotentialMode = "vacant_land" | "renovation" | "other_building" | "unknown" | "skipped";

export type SitePotentialGenerationStatus =
  | "not_started"
  | "inputs_added"
  | "ready_to_generate"
  | "generating"
  | "concepts_ready"
  | "design_selected"
  | "skipped"
  | "failed";

export interface SitePotentialProject {
  id: string;
  user_id: string;
  parcel_id: string;
  mode: SitePotentialMode;
  design_brief: string | null;
  selected_style: string | null;
  renovation_level: "cosmetic" | "moderate" | "major" | null;
  requested_rooms: string[];
  requested_features: string[];
  custom_instructions: string | null;
  rights_confirmed_at: string | null;
  generation_status: SitePotentialGenerationStatus;
  selected_design_asset_id: string | null;
  skipped_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SitePotentialProjectPatch {
  mode?: SitePotentialMode;
  design_brief?: string | null;
  selected_style?: string | null;
  renovation_level?: "cosmetic" | "moderate" | "major" | null;
  requested_rooms?: string[];
  requested_features?: string[];
  custom_instructions?: string | null;
  rights_confirmed_at?: string | null;
  generation_status?: SitePotentialGenerationStatus;
  selected_design_asset_id?: string | null;
  skipped_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SitePotentialReportSummary {
  project: SitePotentialProject | null;
  selectedDesign: ErfAsset | null;
  generatedDesigns: ErfAsset[];
  sourcePhotoCount: number;
  supportingFileCount: number;
}

