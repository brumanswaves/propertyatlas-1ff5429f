import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type {
  SitePotentialGenerationStatus,
  SitePotentialMode,
  SitePotentialProject,
} from "./runtimeTypes";

export type {
  SitePotentialGenerationStatus,
  SitePotentialMode,
  SitePotentialProject,
} from "./runtimeTypes";

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
