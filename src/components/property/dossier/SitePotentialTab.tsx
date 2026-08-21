import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Download, FileText, Home, Image as ImageIcon, Trash2, TreePine, Upload } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import { VacantLandBuildEnvelope } from "@/components/property/sitePotential/VacantLandBuildEnvelope";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { readStoredPlanningZone } from "@/lib/planning/storedPlanningZone";
import { useAuth } from "@/lib/auth/useAuth";
import { useSitePotentialProject, type SitePotentialProjectPatch } from "@/lib/sitePotential/sitePotentialService";
import type { SitePotentialMode } from "@/lib/sitePotential/types";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfAsset, ErfAssetCategory, ErfAssetValidation } from "@/lib/workbench/erfFileVault";
import type { ErfWorkspaceState, SitePotentialSnapshot } from "@/lib/workbench/erfWorkspaceState";
import { toast } from "sonner";

export interface SitePotentialTabProps {
  parcel: NormalizedOfficialParcel;
  parcelRing?: Array<[number, number]> | null;
  recordedAreaM2?: number | null;
  workspaceState: ErfWorkspaceState;
  onUpdateSite: (patch: Partial<SitePotentialSnapshot>) => void;
  onExploreReport?: () => void;
  onOpenTab?: (tab: string) => void;
  guidedReturn?: {
    onBack: () => void;
    onContinue: () => void;
  };
}

const MODE_OPTIONS: Array<{
  id: SitePotentialMode;
  label: string;
  body: string;
  icon: typeof TreePine;
}> = [
  {
    id: "vacant_land",
    label: "Vacant land",
    body: "Review the parcel boundary, street frontage and approximate building area.",
    icon: TreePine,
  },
  {
    id: "renovation",
    label: "Existing house",
    body: "Store existing-house photos, plans and site documents for the investigation.",
    icon: Home,
  },
  {
    id: "other_building",
    label: "Other building",
    body: "Store the relevant property files without forcing a residential concept workflow.",
    icon: ImageIcon,
  },
  {
    id: "unknown",
    label: "Not sure",
    body: "Keep the site state open while you gather better evidence.",
    icon: FileText,
  },
];

const VAULT_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "other",
  "zoning_document",
];

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

function validationMessage(result: Extract<ErfAssetValidation, { ok: false }>) {
  if (result.reason === "too_large") return "File is too large for the Erf File Vault.";
  if (result.reason === "empty_file") return "That file is empty.";
  return "File type is not supported for this upload.";
}

export function SitePotentialTab({
  parcel,
  parcelRing = null,
  recordedAreaM2 = null,
  workspaceState,
  onUpdateSite,
  onExploreReport,
  onOpenTab,
  guidedReturn,
}: SitePotentialTabProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const site = workspaceState.sitePotential;
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const topographyInputRef = useRef<HTMLInputElement | null>(null);
  const planInputRef = useRef<HTMLInputElement | null>(null);
  const supportInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [migrationAttempted, setMigrationAttempted] = useState(false);

  const vault = useErfFileVault(parcel.id, VAULT_CATEGORIES);
  const projectState = useSitePotentialProject(parcel.id);
  const project = projectState.project;
  const mode = project?.mode ?? site.mode ?? "unknown";
  const skipped = mode === "skipped" || site.skipped;

  const sitePhotos = vault.assets.filter(
    (asset) => asset.asset_category === "site_photo" || asset.asset_category === "existing_house_photo",
  );
  const supportingFiles = vault.assets.filter(
    (asset) =>
      asset.asset_category === "topography" ||
      asset.asset_category === "architectural_plan" ||
      asset.asset_category === "other",
  );

  const planningSignals = useMemo(() => derivePlanningEvidenceSignals(vault.assets), [vault.assets]);
  const manualZoneCode = useMemo(
    () => workspaceState.planning.zoneCode ?? readStoredPlanningZone(parcel.id, userId),
    [parcel.id, userId, workspaceState.planning.zoneCode],
  );
  const documentZone = useMemo(() => {
    if (!planningSignals.zoningCertificateUploaded) return null;
    return vault.assets.find((asset) => asset.asset_category === "zoning_document") ?? null;
  }, [planningSignals.zoningCertificateUploaded, vault.assets]);
  const planningAssessment = useMemo(
    () =>
      buildParcelPlanningAssessment({
        parcelId: parcel.id,
        municipality: parcel.municipality ?? null,
        locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
        erfAreaM2: canonicalAreaM2(parcel.rawProperties),
        manualZoneCode,
        userConfirmedZoneCode: workspaceState.planning.userConfirmedZoneCode,
        documentZoneCode: documentZone && manualZoneCode ? manualZoneCode : null,
        documentZoneAssetId: documentZone?.id ?? null,
        observedZoneLabel:
          typeof parcel.rawProperties?.ZONING_DES === "string"
            ? parcel.rawProperties.ZONING_DES
            : typeof parcel.rawProperties?.ZONING === "string"
              ? parcel.rawProperties.ZONING
              : null,
        hasParcelPolygon: Boolean(parcel.rawProperties),
        hasStreetEdgeReference: false,
        evidence: planningSignals,
      }),
    [documentZone, manualZoneCode, parcel, planningSignals, workspaceState.planning.userConfirmedZoneCode],
  );

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
    if (projectState.loading) return;
    onUpdateSite({
      mode: project?.mode ?? site.mode,
      skipped,
      photoCount: sitePhotos.length,
      planCount: supportingFiles.length,
      projectId: project?.id ?? site.projectId,
      progressState: skipped ? "skipped" : mode === "unknown" ? "not_started" : "inputs_added",
    });
  }, [mode, onUpdateSite, project?.id, project?.mode, projectState.loading, site.mode, site.projectId, sitePhotos.length, skipped, supportingFiles.length]);

  async function saveProject(patch: SitePotentialProjectPatch) {
    setSaving(true);
    try {
      const next = await projectState.save(patch);
      onUpdateSite({
        mode: patch.mode ?? next.mode,
        skipped: next.mode === "skipped",
        projectId: next.id,
        progressState: next.mode === "skipped" ? "skipped" : "inputs_added",
      });
      return next;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Site Potential.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function selectMode(nextMode: SitePotentialMode) {
    await saveProject({
      mode: nextMode,
      generation_status: nextMode === "skipped" ? "skipped" : "inputs_added",
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
        ? "User uploaded property photograph"
        : category === "site_photo"
          ? "User uploaded site photograph"
          : category === "topography"
            ? "User uploaded topographical survey"
            : category === "architectural_plan"
              ? "User uploaded architectural plan"
              : "User uploaded Site Potential supporting document";

    for (const file of list) {
      const result = await vault.upload({
        file,
        fileName: file.name,
        category,
        assetType: category,
        sourceLabel,
        metadata: { siteProjectId: project?.id ?? null, mode },
      });
      if (!result.ok) toast.error(`${file.name}: ${validationMessage(result)}`);
    }

    if (mode === "unknown") {
      await saveProject({
        mode: category === "existing_house_photo" ? "renovation" : "vacant_land",
        generation_status: "inputs_added",
      });
    }
  }

  const identityLine = useMemo(() => {
    const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
    const area = parcel.suburbOrArea ?? parcel.town ?? parcel.municipality ?? null;
    return area ? `${erf} - ${area}` : erf;
  }, [parcel]);

  const guidedComplete = skipped || mode === "vacant_land" || mode === "renovation" || mode === "other_building";

  return (
    <div className="space-y-6">
      {guidedReturn ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">Guided Investigation / Site Potential</div>
          <h3 className="mt-2 text-lg font-semibold text-[#0D1B2A]">Review the site and approximate building area</h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">Use the parcel boundary, street frontage, planning evidence and uploaded site files to understand what may fit. This is investigation evidence, not an approval.</p>
        </section>
      ) : null}

      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">Site Potential</span>
        <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">What can this site realistically support?</h2>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">{identityLine}. Focus on the parcel, approximate buildable area and the evidence that matters to the investigation. Easy Erf no longer asks you to generate multiple AI house concepts as part of this step.</p>
      </header>

      {!vault.signedIn && <Notice>Sign in to save Site Potential files permanently to this erf.</Notice>}
      {projectState.error && <Notice>{projectState.error}</Notice>}
      {vault.error && <Notice>{vault.error}</Notice>}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">1. What is currently on the erf?</h3>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">Choose the closest current site state. This keeps the investigation relevant without forcing a design exercise.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={saving}
                onClick={() => void selectMode(option.id)}
                className={cn(
                  "flex min-h-[116px] flex-col items-start rounded-2xl border p-4 text-left transition",
                  active ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]" : "border-[#0D1B2A]/10 bg-white hover:border-[#0D1B2A]/25",
                )}
              >
                <span className={cn("grid h-8 w-8 place-items-center rounded-full", active ? "bg-[#FF6A00] text-white" : "bg-[#0D1B2A]/5 text-[#0D1B2A]")}><Icon className="h-4 w-4" /></span>
                <span className="mt-3 text-[14px] font-semibold text-[#0D1B2A]">{option.label}</span>
                <span className="mt-1 text-[12px] text-[#64748B]">{option.body}</span>
              </button>
            );
          })}
        </div>
        <button type="button" disabled={saving} onClick={() => void selectMode("skipped")} className="mt-4 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5">Skip Site Potential for this investigation</button>
      </section>

      {(mode === "vacant_land" || mode === "unknown") && (
        <section>
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">2. Building area</div>
            <h3 className="mt-1 text-lg font-semibold text-[#0D1B2A]">Review the approximate buildable area</h3>
            <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">Confirm the street-facing boundary and inspect the setbacks/rules used. Verified rules, public records and user assumptions must remain visibly different.</p>
          </div>
          <VacantLandBuildEnvelope
            parcelId={parcel.id}
            parcelLabel={parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "this erf"}
            ring={parcelRing}
            recordedAreaM2={recordedAreaM2}
            zoneLabel={planningAssessment.zone?.name ?? null}
            assessment={planningAssessment}
            documentRuleEvidence={Boolean(documentZone && manualZoneCode)}
            lpiCode={parcel.lpi ?? null}
            onOpenTab={onOpenTab}
            onResultChange={() => onUpdateSite({ progressState: "inputs_added" })}
          />
        </section>
      )}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">3. Supporting evidence</div>
        <h3 className="mt-1 text-lg font-semibold text-[#0D1B2A]">Add only files that help answer the property question</h3>
        <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">Photos, topography and plans stay in the private Erf File Vault and can be reused in the human-reviewed investigation report.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <UploadPanel title={mode === "renovation" ? "Existing-house photographs" : "Site photographs"} body="Use real photographs of the property when they help explain access, slope, existing structures or site context." count={sitePhotos.length} inputRef={photoInputRef} accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" buttonLabel="Upload photos" onClick={() => photoInputRef.current?.click()} onFiles={(files) => void uploadFiles(files, mode === "renovation" ? "existing_house_photo" : "site_photo")} />
          <UploadPanel title="Topographical survey" body="Upload a survey or contour/site-level document when available." count={vault.assets.filter((asset) => asset.asset_category === "topography").length} inputRef={topographyInputRef} accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp" buttonLabel="Upload topography" onClick={() => topographyInputRef.current?.click()} onFiles={(files) => void uploadFiles(files, "topography")} />
          <UploadPanel title="Architectural or existing plans" body="Keep plans separate from surveys so they can be interpreted correctly in the investigation." count={vault.assets.filter((asset) => asset.asset_category === "architectural_plan").length} inputRef={planInputRef} accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp" buttonLabel="Upload plans" onClick={() => planInputRef.current?.click()} onFiles={(files) => void uploadFiles(files, "architectural_plan")} />
          <UploadPanel title="Other site evidence" body="Use this for a relevant supporting file that is not a survey or plan." count={vault.assets.filter((asset) => asset.asset_category === "other").length} inputRef={supportInputRef} accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp" buttonLabel="Upload document" onClick={() => supportInputRef.current?.click()} onFiles={(files) => void uploadFiles(files, "other")} />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">Site Potential files for this erf</h3>
        <div className="mt-4 grid gap-3">
          {[...sitePhotos, ...supportingFiles].map((asset) => <FileRow key={asset.id} asset={asset} onOpen={() => void vault.open(asset)} onRemove={() => void vault.remove(asset)} />)}
          {!sitePhotos.length && !supportingFiles.length && <p className="rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm text-[#0D1B2A]/60">No Site Potential support files uploaded yet.</p>}
        </div>
      </section>

      {guidedReturn ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="flex items-start gap-2">
            {guidedComplete && <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">Guided completion - Site Potential</div>
              <h3 className="mt-2 text-lg font-semibold text-[#0D1B2A]">{guidedComplete ? "Site Potential reviewed" : "Choose the site state or skip this step"}</h3>
              <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">{guidedComplete ? "The site state and any build-area/evidence work remain attached to this erf for the report." : "This step no longer requires AI concept generation. Review the site, choose the current site state, then continue."}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={guidedReturn.onBack} className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/14 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]">Back to Investigation</button>
            <button type="button" disabled={!guidedComplete} onClick={guidedReturn.onContinue} className="inline-flex min-h-10 items-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Continue to Easy Erf Report</button>
          </div>
        </section>
      ) : null}

      {!guidedReturn && onExploreReport && (
        <button type="button" onClick={onExploreReport} className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142941]">View in Easy Erf Report <ArrowRight className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[12.5px] text-amber-900">{children}</div>;
}

function UploadPanel({ title, body, count, inputRef, accept, buttonLabel, onClick, onFiles }: { title: string; body: string; count: number; inputRef: React.RefObject<HTMLInputElement | null>; accept: string; buttonLabel: string; onClick: () => void; onFiles: (files: FileList | null) => void }) {
  return (
    <article className="rounded-[1.35rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-5">
      <h4 className="text-[14px] font-semibold text-[#0D1B2A]">{title}</h4>
      <p className="mt-1 text-[12px] leading-5 text-[#64748B]">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#0D1B2A]/70">{count} file{count === 1 ? "" : "s"}</span>
        <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white"><Upload className="h-3.5 w-3.5" /> {buttonLabel}</button>
      </div>
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
    </article>
  );
}

function FileRow({ asset, onOpen, onRemove }: { asset: ErfAsset; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="break-words text-sm font-semibold text-[#0D1B2A]">{asset.original_file_name}</div>
        <div className="mt-1 text-xs text-[#64748B]">{asset.asset_category} - {formatFileSize(asset.size_bytes)} - uploaded {formatDate(asset.created_at)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"><Download className="h-3.5 w-3.5" /> Open</button>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-full border border-[#C75A31]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#7A2D12]"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
      </div>
    </div>
  );
}
