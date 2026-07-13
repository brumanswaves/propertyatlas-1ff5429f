import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  TreePine,
  Upload,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  SITE_POTENTIAL_CURRENCY,
  SITE_POTENTIAL_DISCLAIMER,
  SITE_POTENTIAL_PACK_SIZE,
  SITE_POTENTIAL_PRICE_CENTS,
} from "@/lib/sitePotential/config";
import {
  useSitePotentialProject,
  type SitePotentialProjectPatch,
} from "@/lib/sitePotential/sitePotentialService";
import type { SitePotentialMode } from "@/lib/sitePotential/types";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type {
  ErfAsset,
  ErfAssetCategory,
  ErfAssetValidation,
} from "@/lib/workbench/erfFileVault";
import type { ErfWorkspaceState, SitePotentialSnapshot } from "@/lib/workbench/erfWorkspaceState";
import { toast } from "sonner";

export interface SitePotentialTabProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  onUpdateSite: (patch: Partial<SitePotentialSnapshot>) => void;
  onExploreReport?: () => void;
  onOpenStrategy?: () => void;
}

const STYLES = [
  "Coastal contemporary",
  "Modern",
  "Mediterranean",
  "Traditional",
  "Farmhouse",
  "Minimal",
  "Custom",
];

const ROOM_OPTIONS = ["2 bedrooms", "3 bedrooms", "4 bedrooms", "Study", "Guest suite"];
const FEATURE_OPTIONS = ["Pool", "Deck", "Garage", "Sea-facing patio", "Garden", "Flatlet"];

const MODE_OPTIONS: Array<{
  id: SitePotentialMode;
  label: string;
  body: string;
  icon: typeof TreePine;
}> = [
  {
    id: "vacant_land",
    label: "Vacant land",
    body: "Explore new-build concept directions from your brief and support files.",
    icon: TreePine,
  },
  {
    id: "renovation",
    label: "Existing house",
    body: "Upload permitted photos and explore renovation concepts.",
    icon: Home,
  },
  {
    id: "other_building",
    label: "Other building",
    body: "Store files and notes for a non-standard property state.",
    icon: ImageIcon,
  },
  {
    id: "unknown",
    label: "Not sure",
    body: "Keep this section open until the site condition is clearer.",
    icon: FileText,
  },
];

const VAULT_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "inspiration_image",
  "other",
  "generated_design",
];

const GENERATION_UI_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_SITE_POTENTIAL_GENERATION_UI === "true";

function formatPrice() {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: SITE_POTENTIAL_CURRENCY,
    maximumFractionDigits: 0,
  }).format(SITE_POTENTIAL_PRICE_CENTS / 100);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function assetTitle(asset: ErfAsset) {
  const title = asset.metadata?.title;
  return typeof title === "string" && title.trim() ? title : asset.original_file_name;
}

function validationMessage(result: Extract<ErfAssetValidation, { ok: false }>) {
  if (result.reason === "too_large") return "File is too large for the Erf File Vault.";
  if (result.reason === "empty_file") return "That file is empty.";
  return "File type is not supported for this upload.";
}

function projectPatchToSnapshot(patch: SitePotentialProjectPatch): Partial<SitePotentialSnapshot> {
  const selectedDesignAssetId =
    typeof patch.selected_design_asset_id === "string" ? patch.selected_design_asset_id : null;
  return {
    mode: patch.mode ?? undefined,
    skipped: patch.mode === "skipped" || patch.generation_status === "skipped",
    selectedDesignAssetId,
    preferredConceptId: selectedDesignAssetId,
    imageRightsConfirmed: Boolean(patch.rights_confirmed_at),
    rightsConfirmedAt: patch.rights_confirmed_at ?? undefined,
    progressState: patch.generation_status ?? undefined,
  };
}

export function SitePotentialTab({
  parcel,
  workspaceState,
  onUpdateSite,
  onExploreReport,
  onOpenStrategy,
}: SitePotentialTabProps) {
  const site = workspaceState.sitePotential;
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const topographyInputRef = useRef<HTMLInputElement | null>(null);
  const planInputRef = useRef<HTMLInputElement | null>(null);
  const inspirationInputRef = useRef<HTMLInputElement | null>(null);
  const supportDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [migrationAttempted, setMigrationAttempted] = useState(false);
  const [strategyDraftReady, setStrategyDraftReady] = useState(false);

  const vault = useErfFileVault(parcel.id, VAULT_CATEGORIES);
  const generatedDesigns = vault.assets.filter((asset) => asset.asset_category === "generated_design");
  const projectState = useSitePotentialProject(parcel.id, generatedDesigns);
  const project = projectState.project;

  const sitePhotos = vault.assets.filter(
    (asset) =>
      asset.asset_category === "site_photo" || asset.asset_category === "existing_house_photo",
  );
  const supportingFiles = vault.assets.filter(
    (asset) =>
      asset.asset_category === "topography" ||
      asset.asset_category === "architectural_plan" ||
      asset.asset_category === "inspiration_image" ||
      asset.asset_category === "other",
  );
  const selectedDesign = projectState.selectedDesign;
  const mode = project?.mode ?? site.mode ?? "unknown";
  const rightsConfirmed = Boolean(project?.rights_confirmed_at ?? site.rightsConfirmedAt);
  const needsRenovationPhoto = mode === "renovation" && sitePhotos.length === 0;
  const needsRights = mode === "renovation" && sitePhotos.length > 0 && !rightsConfirmed;
  const readyToGenerate =
    Boolean(project?.id) &&
    (mode === "vacant_land" || mode === "renovation") &&
    !needsRenovationPhoto &&
    !needsRights;

  const identityLine = useMemo(() => {
    const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
    const area = parcel.suburbOrArea ?? parcel.town ?? parcel.municipality ?? null;
    return area ? `${erf} - ${area}` : erf;
  }, [parcel]);

  useEffect(() => {
    if (!vault.signedIn || migrationAttempted) return;
    setMigrationAttempted(true);
    void vault.migrateLocalAttachments().then((result) => {
      if (!result) return;
      if (result.uploaded > 0) toast.success(`${result.uploaded} local file(s) moved to the Erf File Vault.`);
      if (result.failed > 0) toast.error("Some local files could not be moved to the vault.");
    });
  }, [migrationAttempted, vault]);

  useEffect(() => {
    onUpdateSite({
      projectId: project?.id ?? null,
      photoCount: sitePhotos.length,
      planCount: supportingFiles.length,
      conceptCount: generatedDesigns.length,
      selectedDesignAssetId: project?.selected_design_asset_id ?? null,
      preferredConceptId: project?.selected_design_asset_id ?? null,
      mode: project?.mode ?? site.mode,
      skipped: project?.generation_status === "skipped" || project?.mode === "skipped",
      imageRightsConfirmed: rightsConfirmed,
      rightsConfirmedAt: project?.rights_confirmed_at ?? null,
      progressState:
        project?.generation_status ??
        (generatedDesigns.length ? "concepts_ready" : site.progressState),
    });
  }, [
    generatedDesigns.length,
    onUpdateSite,
    project,
    rightsConfirmed,
    site.mode,
    site.progressState,
    sitePhotos.length,
    supportingFiles.length,
  ]);

  async function saveProject(patch: SitePotentialProjectPatch) {
    setSaving(true);
    try {
      const next = await projectState.save(patch);
      onUpdateSite(projectPatchToSnapshot(patch));
      return next;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Site Potential.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function selectMode(nextMode: SitePotentialMode) {
    const generation_status = nextMode === "skipped" ? "skipped" : "inputs_added";
    await saveProject({
      mode: nextMode,
      generation_status,
      skipped_at: nextMode === "skipped" ? new Date().toISOString() : null,
    });
  }

  async function uploadFiles(files: FileList | null | undefined, category: ErfAssetCategory) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to save files permanently to this erf.");
      return;
    }
    const sourceLabel =
      category === "existing_house_photo"
        ? "User uploaded permitted property photograph"
        : category === "site_photo"
          ? "User uploaded site photograph"
          : category === "topography"
            ? "User uploaded topographical survey"
            : category === "architectural_plan"
              ? "User uploaded plan"
              : category === "inspiration_image"
                ? "User uploaded inspiration image"
                : "User uploaded supporting document";
    for (const file of list) {
      const result = await vault.upload({
        file,
        fileName: file.name,
        category,
        assetType: category,
        sourceLabel,
        metadata: {
          siteProjectId: project?.id ?? null,
          mode,
          rightsConfirmedAt: rightsConfirmed ? project?.rights_confirmed_at : null,
        },
      });
      if (!result.ok) toast.error(`${file.name}: ${validationMessage(result)}`);
    }
    await saveProject({
      generation_status: "inputs_added",
      mode: mode === "unknown" ? (category === "existing_house_photo" ? "renovation" : "vacant_land") : mode,
    });
  }

  async function grantDevEntitlement() {
    const current = project ?? (await saveProject({ mode, generation_status: "ready_to_generate" }));
    if (!current) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sign in to create a test entitlement.");
      return null;
    }
    const response = await fetch("/api/site-potential/dev-entitlement", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ parcelId: parcel.id, siteProjectId: current.id }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      toast.error(payload?.error || "Development entitlement is not available.");
      return null;
    }
    toast.success("Development entitlement ready for this concept pack.");
    return payload.designPack as { id: string };
  }

  async function generateConcepts() {
    setGenerationError(null);
    if (!GENERATION_UI_ENABLED) {
      toast.error("AI concept generation is not available until secure entitlement is configured.");
      return;
    }
    if (!readyToGenerate) {
      toast.error("Complete the required Site Potential inputs first.");
      return;
    }
    const currentPack = await grantDevEntitlement();
    if (!currentPack?.id || !project?.id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setGenerating(true);
    await saveProject({ generation_status: "generating" });
    try {
      const response = await fetch("/api/site-potential/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parcelId: parcel.id,
          siteProjectId: project.id,
          designPackId: currentPack.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Generation failed.");
      }
      toast.success(`${payload.assets?.length ?? SITE_POTENTIAL_PACK_SIZE} concepts saved to the Erf File Vault.`);
      await vault.refresh();
      await projectState.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setGenerationError(message);
      await saveProject({ generation_status: "failed" });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function selectDesign(asset: ErfAsset | null) {
    await saveProject({
      selected_design_asset_id: asset?.id ?? null,
      generation_status: asset ? "design_selected" : generatedDesigns.length ? "concepts_ready" : "not_started",
    });
  }

  function useInStrategy() {
    const floorArea = String(project?.metadata?.approxFloorArea ?? "");
    const draft = {
      source: "site-potential",
      projectId: project?.id,
      selectedDesignAssetId: project?.selected_design_asset_id,
      conceptTitle: selectedDesign ? assetTitle(selectedDesign) : null,
      buildableSqm: floorArea,
      notes: [
        project?.design_brief ? `Brief: ${project.design_brief}` : null,
        project?.requested_rooms?.length ? `Rooms: ${project.requested_rooms.join(", ")}` : null,
        project?.requested_features?.length
          ? `Features: ${project.requested_features.join(", ")}`
          : null,
      ].filter(Boolean),
    };
    window.localStorage.setItem(`easyErf.sitePotential.strategyDraft.${parcel.id}`, JSON.stringify(draft));
    setStrategyDraftReady(true);
    toast.success("Site Potential assumptions prepared. Review before applying in Strategy.");
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
              Site Potential
            </span>
            <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">
              What is currently on this erf, and what could it become?
            </h2>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">
              {identityLine}. Upload permitted photos, plans, topography and inspiration into the
              permanent Erf File Vault. Concepts are visual starting points, not architectural plans
              or municipal approvals.
            </p>
          </div>
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-[12px] text-[#0D1B2A]/72">
            <div className="font-semibold text-[#0D1B2A]">Six AI Property Concepts</div>
            <div>
              {formatPrice()} / {SITE_POTENTIAL_PACK_SIZE} concepts
            </div>
            <div className="mt-1 text-[11px]">
              Payment provider is not connected; use development entitlement only in enabled
              environments.
            </div>
          </div>
        </div>
      </header>

      {!vault.signedIn && (
        <Notice tone="amber">
          Sign in to save Site Potential files permanently to the cloud Erf File Vault.
        </Notice>
      )}
      {vault.migration && (vault.migration.uploaded > 0 || vault.migration.failed > 0) && (
        <Notice tone={vault.migration.failed ? "amber" : "green"}>
          Local file migration: {vault.migration.uploaded} uploaded, {vault.migration.skipped} already
          in cloud, {vault.migration.failed} failed.
        </Notice>
      )}
      {projectState.error && <Notice tone="amber">{projectState.error}</Notice>}
      {vault.error && <Notice tone="amber">{vault.error}</Notice>}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Step 1 - Choose the site state
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void selectMode(option.id)}
                className={cn(
                  "flex min-h-[116px] flex-col items-start rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]"
                    : "border-[#0D1B2A]/10 bg-white hover:border-[#0D1B2A]/25",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full",
                    active ? "bg-[#FF6A00] text-white" : "bg-[#0D1B2A]/5 text-[#0D1B2A]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 text-[14px] font-semibold text-[#0D1B2A]">
                  {option.label}
                </span>
                <span className="mt-1 text-[12px] text-[#64748B]">{option.body}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void selectMode("skipped")}
          className="mt-4 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
        >
          Skip Site Potential for this erf
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <UploadPanel
          title={mode === "renovation" ? "Permitted property photographs" : "Site photographs"}
          body={
            mode === "renovation"
              ? "Renovation concepts require at least one user-uploaded photo that you own or have permission to use."
              : "Vacant-land concepts can use site photos for context. They are not treated as verified parcel positioning."
          }
          count={sitePhotos.length}
          inputRef={photoInputRef}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          buttonLabel="Upload photos"
          onClick={() => photoInputRef.current?.click()}
          onFiles={(files) =>
            void uploadFiles(files, mode === "renovation" ? "existing_house_photo" : "site_photo")
          }
        />
        <UploadPanel
          title="Topographical survey"
          body="Upload a topographical survey only when the file is actually a survey or contour/site-level document."
          count={vault.assets.filter((asset) => asset.asset_category === "topography").length}
          inputRef={topographyInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload topography"
          onClick={() => topographyInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "topography")}
        />
        <UploadPanel
          title="Architectural plans"
          body="Upload architectural plans separately so Easy Erf does not mistake them for topographical surveys."
          count={vault.assets.filter((asset) => asset.asset_category === "architectural_plan").length}
          inputRef={planInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload plans"
          onClick={() => planInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "architectural_plan")}
        />
        <UploadPanel
          title="Inspiration images"
          body="Upload visual references as inspiration only. They are not treated as official site evidence."
          count={vault.assets.filter((asset) => asset.asset_category === "inspiration_image").length}
          inputRef={inspirationInputRef}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          buttonLabel="Upload inspiration"
          onClick={() => inspirationInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "inspiration_image")}
        />
        <UploadPanel
          title="Supporting documents"
          body="Upload other supporting files without classifying them as topography, plans, or design inspiration."
          count={vault.assets.filter((asset) => asset.asset_category === "other").length}
          inputRef={supportDocumentInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload document"
          onClick={() => supportDocumentInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "other")}
        />
      </section>

      {mode === "renovation" && (
        <label className="flex items-start gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 text-[13px] text-[#0D1B2A]">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(event) =>
              void saveProject({
                rights_confirmed_at: event.target.checked ? new Date().toISOString() : null,
                generation_status: event.target.checked ? "ready_to_generate" : "inputs_added",
              })
            }
            className="mt-0.5 h-4 w-4 accent-[#FF6A00]"
          />
          <span>
            I own these images or have permission to use them for AI concept visualisation.
            {needsRights && <strong className="ml-2 text-[#B24A00]">Required</strong>}
          </span>
        </label>
      )}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Step 2 - Brief and assumptions
        </h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextField
            label="Design brief"
            value={project?.design_brief ?? ""}
            onChange={(value) => void saveProject({ design_brief: value, generation_status: "inputs_added" })}
            placeholder="Example: compact coastal family home with wind-protected courtyard"
          />
          <SelectField
            label="Style"
            value={project?.selected_style ?? ""}
            options={STYLES}
            onChange={(value) => void saveProject({ selected_style: value })}
          />
          <SelectField
            label="Renovation level"
            value={project?.renovation_level ?? ""}
            options={["cosmetic", "moderate", "major"]}
            onChange={(value) =>
              void saveProject({
                renovation_level: value as "cosmetic" | "moderate" | "major",
              })
            }
          />
          <TextField
            label="Custom instructions"
            value={project?.custom_instructions ?? ""}
            onChange={(value) => void saveProject({ custom_instructions: value })}
            placeholder="Materials, colours, rooms, landscaping, parking, views..."
          />
        </div>
        <ChipEditor
          title="Requested rooms"
          values={project?.requested_rooms ?? []}
          options={ROOM_OPTIONS}
          onChange={(values) => void saveProject({ requested_rooms: values })}
        />
        <ChipEditor
          title="Requested features"
          values={project?.requested_features ?? []}
          options={FEATURE_OPTIONS}
          onChange={(values) => void saveProject({ requested_features: values })}
        />
      </section>

      <section className="rounded-[1.75rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF6A00]" />
              <h3 className="text-[16px] font-semibold tracking-tight text-[#0D1B2A]">
                Generate {SITE_POTENTIAL_PACK_SIZE} AI Property Concepts
              </h3>
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#4A5A6A]">
              Concept generation is server-gated. When enabled, the server verifies entitlement,
              uses permitted uploaded reference photos where required, saves each successful concept
              to the Erf File Vault, and lets you choose exactly one concept for the Easy Erf Report.
            </p>
            <p className="mt-2 text-[11.5px] text-[#64748B]">{SITE_POTENTIAL_DISCLAIMER}</p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="text-[26px] font-bold text-[#0D1B2A]">{formatPrice()}</div>
            <button
              type="button"
              disabled={!GENERATION_UI_ENABLED || !readyToGenerate || generating || saving}
              onClick={() => void generateConcepts()}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold",
                !GENERATION_UI_ENABLED || !readyToGenerate || generating
                  ? "cursor-not-allowed bg-[#0D1B2A]/10 text-[#0D1B2A]/40"
                  : "bg-[#FF6A00] text-white hover:bg-[#ff7a1a]",
              )}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate concepts
            </button>
            <span className="text-[11px] text-[#64748B]">
              {needsRenovationPhoto
                ? "Needs a permitted property photo"
                : needsRights
                  ? "Needs image-rights confirmation"
                  : !GENERATION_UI_ENABLED
                    ? "Concept generation is unavailable until secure entitlement is configured"
                    : !project?.id
                      ? "Choose a site state first"
                      : "Ready when entitlement and OpenAI server key are configured"}
            </span>
          </div>
        </div>
        {generationError && <Notice tone="amber">{generationError}</Notice>}
      </section>

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Generated concepts
          </h3>
          <span className="text-xs text-[#64748B]">
            {generatedDesigns.length} of {SITE_POTENTIAL_PACK_SIZE}
          </span>
        </div>
        {generatedDesigns.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {generatedDesigns.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={asset.id === project?.selected_design_asset_id}
                onOpen={() => void vault.open(asset)}
                onRemove={() => void vault.remove(asset)}
                onSelect={() => void selectDesign(asset)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm text-[#0D1B2A]/60">
            No generated concepts saved yet. Generated images will appear here only after the
            server stores them in the Erf File Vault.
          </p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Use selected concept in Strategy
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-[#64748B]">
          Easy Erf will not overwrite calculator assumptions automatically. Use this action to
          prepare a draft with the selected concept title, brief, rooms and features, then review it
          in Strategy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedDesign}
            onClick={useInStrategy}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold",
              selectedDesign
                ? "bg-[#0D1B2A] text-white hover:bg-[#142941]"
                : "cursor-not-allowed bg-[#0D1B2A]/8 text-[#0D1B2A]/40",
            )}
          >
            Use in Strategy
          </button>
          {strategyDraftReady && onOpenStrategy && (
            <button
              type="button"
              onClick={onOpenStrategy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
            >
              Open Strategy <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Erf File Vault files for Site Potential
        </h3>
        <div className="mt-4 grid gap-3">
          {[...sitePhotos, ...supportingFiles].map((asset) => (
            <FileRow
              key={asset.id}
              asset={asset}
              onOpen={() => void vault.open(asset)}
              onRemove={() => void vault.remove(asset)}
            />
          ))}
          {!sitePhotos.length && !supportingFiles.length && (
            <p className="rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm text-[#0D1B2A]/60">
              No Site Potential files uploaded yet.
            </p>
          )}
        </div>
      </section>

      {onExploreReport && (
        <button
          type="button"
          onClick={onExploreReport}
          className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142941]"
        >
          View in Easy Erf Report <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3 rounded-2xl border p-4 text-[12.5px]",
        tone === "green"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      {tone === "green" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}

function UploadPanel({
  title,
  body,
  count,
  inputRef,
  accept,
  buttonLabel,
  onClick,
  onFiles,
}: {
  title: string;
  body: string;
  count: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  buttonLabel: string;
  onClick: () => void;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-[#64748B]">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#0D1B2A]/70">
          {count} file{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff7a1a]"
        >
          <Upload className="h-3.5 w-3.5" /> {buttonLabel}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </article>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="block text-[12px] text-[#64748B]">
      <span className="mb-1 block font-semibold text-[#0D1B2A]">{label}</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(draft.trim())}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[12px] text-[#64748B]">
      <span className="mb-1 block font-semibold text-[#0D1B2A]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
      >
        <option value="">Not selected</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipEditor({
  title,
  values,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(active ? values.filter((item) => item !== option) : [...values, option])
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                active
                  ? "border-[#FF6A00] bg-[#FF6A00] text-white"
                  : "border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:border-[#0D1B2A]/30",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FileRow({
  asset,
  onOpen,
  onRemove,
}: {
  asset: ErfAsset;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="break-words text-sm font-semibold text-[#0D1B2A]">
          {asset.original_file_name}
        </div>
        <div className="mt-1 text-xs text-[#64748B]">
          {asset.asset_category} - {formatFileSize(asset.size_bytes)} - uploaded{" "}
          {formatDate(asset.created_at)}
        </div>
        <div className="mt-1 text-xs text-[#64748B]">Status: {asset.status}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fffaf2]"
        >
          <Download className="h-3.5 w-3.5" /> Open
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#C75A31]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#7A2D12] hover:bg-[#fff1e9]"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onOpen,
  onRemove,
  onSelect,
}: {
  asset: ErfAsset;
  selected: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-[#FBF6EC]",
        selected ? "border-[#FF6A00]" : "border-[#EADFC9]",
      )}
    >
      <div className="grid aspect-[4/3] place-items-center bg-[#0D1B2A]/5 p-4 text-center text-xs font-semibold text-[#0D1B2A]/60">
        Open concept to preview signed cloud file
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-[#0D1B2A]">{assetTitle(asset)}</div>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">{SITE_POTENTIAL_DISCLAIMER}</p>
        {selected && (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#FF6A00] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
            <CheckCircle2 className="h-3 w-3" /> Selected for report
          </span>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fffaf2]"
          >
            Open
          </button>
          <button
            type="button"
            disabled={selected}
            onClick={onSelect}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              selected
                ? "cursor-not-allowed bg-[#0D1B2A]/8 text-[#0D1B2A]/40"
                : "bg-[#0D1B2A] text-white hover:bg-[#142941]",
            )}
          >
            Select for report
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-[#C75A31]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#7A2D12] hover:bg-[#fff1e9]"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
