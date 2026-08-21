import { useMemo, useRef } from "react";
import { ArrowRight, FileText, Home, Image as ImageIcon, TreePine, Upload } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { useAuth } from "@/lib/auth/useAuth";
import { cn } from "@/lib/utils";
import type { SitePotentialMode } from "@/lib/sitePotential/types";
import { VacantLandBuildEnvelope } from "@/components/property/sitePotential/VacantLandBuildEnvelope";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { readStoredPlanningZone } from "@/lib/planning/storedPlanningZone";
import { deriveAcceptedBuildEnvelope } from "@/lib/sitePotential/acceptedBuildEnvelope";
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
  id: Exclude<SitePotentialMode, "skipped">;
  label: string;
  body: string;
  icon: typeof TreePine;
}> = [
  {
    id: "vacant_land",
    label: "Vacant land",
    body: "Review the parcel, street frontage and approximate building area.",
    icon: TreePine,
  },
  {
    id: "renovation",
    label: "Existing house",
    body: "Keep existing-house evidence together and review the planning envelope around it.",
    icon: Home,
  },
  {
    id: "other_building",
    label: "Other building",
    body: "Keep the site evidence together while you establish what exists and what rules apply.",
    icon: ImageIcon,
  },
  {
    id: "unknown",
    label: "Not sure",
    body: "Record the uncertainty now and return when the site condition is clearer.",
    icon: FileText,
  },
];

const VAULT_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "other",
  "generated_design",
  "zoning_document",
];

function validationMessage(result: Extract<ErfAssetValidation, { ok: false }>) {
  if (result.reason === "too_large") return "File is too large for the Erf File Vault.";
  if (result.reason === "empty_file") return "That file is empty.";
  return "File type is not supported for this upload.";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(category: ErfAssetCategory) {
  switch (category) {
    case "site_photo":
      return "Site photo";
    case "existing_house_photo":
      return "Existing-house photo";
    case "topography":
      return "Topographical survey";
    case "architectural_plan":
      return "Architectural plan";
    case "generated_design":
      return "Previously saved Site Potential image";
    case "zoning_document":
      return "Zoning evidence";
    default:
      return "Supporting document";
  }
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
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const topographyInputRef = useRef<HTMLInputElement | null>(null);
  const planInputRef = useRef<HTMLInputElement | null>(null);
  const supportInputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, VAULT_CATEGORIES);
  const mode = workspaceState.sitePotential.mode ?? "unknown";
  const skipped = workspaceState.sitePotential.skipped || mode === "skipped";

  const planningSignals = useMemo(
    () => derivePlanningEvidenceSignals(vault.assets),
    [vault.assets],
  );
  const manualZoneCode = useMemo(
    () => workspaceState.planning.zoneCode ?? readStoredPlanningZone(parcel.id, userId),
    [parcel.id, userId, workspaceState.planning.zoneCode],
  );
  const documentZone = useMemo(
    () =>
      planningSignals.zoningCertificateUploaded
        ? vault.assets.find((asset) => asset.asset_category === "zoning_document") ?? null
        : null,
    [planningSignals.zoningCertificateUploaded, vault.assets],
  );
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

  const acceptedBuildEnvelope = useMemo(
    () =>
      deriveAcceptedBuildEnvelope({
        parcel,
        parcelRing,
        planning: planningAssessment,
        recordedAreaM2,
        userId,
      }),
    [parcel, parcelRing, planningAssessment, recordedAreaM2, userId],
  );

  const siteFiles = vault.assets.filter(
    (asset) => asset.asset_category !== "zoning_document",
  );
  const historicalImages = siteFiles.filter((asset) => asset.asset_category === "generated_design");
  const guidedComplete = Boolean(acceptedBuildEnvelope) || skipped;

  function selectMode(nextMode: Exclude<SitePotentialMode, "skipped">) {
    onUpdateSite({
      mode: nextMode,
      skipped: false,
      progressState: "inputs_added",
    });
  }

  function skipSitePotential() {
    onUpdateSite({
      mode: "skipped",
      skipped: true,
      progressState: "skipped",
    });
  }

  async function uploadFiles(files: FileList | null, category: ErfAssetCategory) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to save Site Potential evidence to this erf.");
      return;
    }

    let uploaded = 0;
    for (const file of selectedFiles) {
      const result = await vault.upload({
        file,
        fileName: file.name,
        category,
        assetType: category,
        sourceLabel: "User uploaded Site Potential evidence",
        metadata: { source: "site-potential-evidence" },
      });
      if (!result.ok) {
        toast.error(`${file.name}: ${validationMessage(result)}`);
        continue;
      }
      uploaded += 1;
    }

    if (uploaded > 0) {
      onUpdateSite({ progressState: "inputs_added" });
      await vault.refresh();
      toast.success(`${uploaded} Site Potential file${uploaded === 1 ? "" : "s"} saved.`);
    }
  }

  return (
    <div className="space-y-6">
      {guidedReturn ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Guided Investigation / Site Potential
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            Review what could potentially fit on this site
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            Confirm the site state and street-facing boundaries, then review the approximate building
            area. This is due-diligence guidance, not an approval or architectural plan.
          </p>
        </section>
      ) : null}

      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
          Site Potential
        </span>
        <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">
          What could potentially be built on this erf?
        </h2>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">
          Use the real parcel boundary, working zoning, street frontage and supporting evidence to
          understand the approximate building area. Easy Erf separates verified rules, assumptions
          and unknowns rather than generating speculative design concepts.
        </p>
      </header>

      {!vault.signedIn ? (
        <Notice>
          Sign in to save Site Potential evidence permanently to this erf.
        </Notice>
      ) : null}
      {vault.error ? <Notice>{vault.error}</Notice> : null}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
              1. Confirm the site state
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              This keeps the investigation honest about what is actually known on the property.
            </p>
          </div>
          <button
            type="button"
            onClick={skipSitePotential}
            className="inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
          >
            Skip Site Potential for now
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id && !skipped;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectMode(option.id)}
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
                <span className="mt-3 text-sm font-semibold text-[#0D1B2A]">{option.label}</span>
                <span className="mt-1 text-xs leading-5 text-[#64748B]">{option.body}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!skipped ? (
        <VacantLandBuildEnvelope
          parcelId={parcel.id}
          parcelLabel={
            parcel.erfNumber != null
              ? `Erf ${parcel.erfNumber}${parcel.suburbOrArea ? ` - ${parcel.suburbOrArea}` : ""}`
              : "this erf"
          }
          ring={parcelRing}
          recordedAreaM2={recordedAreaM2}
          zoneLabel={planningAssessment.zone?.name ?? null}
          assessment={planningAssessment}
          documentRuleEvidence={Boolean(documentZone && manualZoneCode)}
          lpiCode={parcel.lpi ?? null}
          onOpenTab={onOpenTab}
        />
      ) : (
        <Notice>
          Site Potential is skipped for now. The rest of the Easy Erf investigation can continue.
        </Notice>
      )}

      {!skipped ? (
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            2. Add useful site evidence
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">
            Upload evidence only when it helps the investigation. Files stay attached to this erf so
            the same document does not need to be uploaded again elsewhere.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UploadAction
              label={mode === "renovation" ? "Existing-house photos" : "Site photos"}
              buttonLabel="Upload photos"
              inputRef={photoInputRef}
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              onFiles={(files) =>
                void uploadFiles(
                  files,
                  mode === "renovation" ? "existing_house_photo" : "site_photo",
                )
              }
            />
            <UploadAction
              label="Topographical survey"
              buttonLabel="Upload survey"
              inputRef={topographyInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
              onFiles={(files) => void uploadFiles(files, "topography")}
            />
            <UploadAction
              label="Architectural plans"
              buttonLabel="Upload plans"
              inputRef={planInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
              onFiles={(files) => void uploadFiles(files, "architectural_plan")}
            />
            <UploadAction
              label="Other site evidence"
              buttonLabel="Upload document"
              inputRef={supportInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
              onFiles={(files) => void uploadFiles(files, "other")}
            />
          </div>
        </section>
      ) : null}

      {siteFiles.length ? (
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Saved Site Potential evidence
          </h3>
          {historicalImages.length ? (
            <p className="mt-2 rounded-xl border border-emerald-300/40 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
              Previously generated Site Potential images remain attached to this erf as historical
              illustrative context. New concept generation is not part of the MVP workflow.
            </p>
          ) : null}
          <div className="mt-4 grid gap-2">
            {siteFiles.map((asset) => (
              <FileRow
                key={asset.id}
                asset={asset}
                onOpen={() => void vault.open(asset)}
                onRemove={() => void vault.remove(asset)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {guidedReturn ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Guided completion / Site Potential
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            {guidedComplete ? "Site Potential can continue" : "Review and save the working building area"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            {guidedComplete
              ? skipped
                ? "You skipped this step. You can return later without blocking the report."
                : "A deterministic building-area result is available from the saved parcel and planning inputs."
              : "Confirm enough parcel, frontage and planning inputs for Easy Erf to calculate the working building area, or skip this step for now."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guidedReturn.onBack}
              className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/14 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/35"
            >
              Back to Investigation
            </button>
            <button
              type="button"
              disabled={!guidedComplete}
              onClick={guidedReturn.onContinue}
              className="inline-flex min-h-10 items-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to Easy Erf Report
            </button>
          </div>
        </section>
      ) : null}

      {!guidedReturn && onExploreReport ? (
        <button
          type="button"
          onClick={onExploreReport}
          className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142941]"
        >
          View in Easy Erf Report <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-300/45 bg-amber-50 p-4 text-[12.5px] leading-5 text-amber-950">
      {children}
    </div>
  );
}

function UploadAction({
  label,
  buttonLabel,
  inputRef,
  accept,
  onFiles,
}: {
  label: string;
  buttonLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
      <div className="text-sm font-semibold text-[#0D1B2A]">{label}</div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white"
      >
        <Upload className="h-3.5 w-3.5" />
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
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
    <div className="flex flex-col gap-3 rounded-xl border border-[#0D1B2A]/10 bg-[#F8FAFC] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
          {fileLabel(asset.asset_category)}
        </div>
        <div className="mt-1 break-words text-sm font-semibold text-[#0D1B2A]">
          {asset.original_file_name}
        </div>
        <div className="mt-1 text-xs text-[#64748B]">{formatFileSize(asset.size_bytes)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
        >
          Open file
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-9 items-center rounded-full border border-red-300/50 bg-white px-3 py-1.5 text-xs font-semibold text-red-800"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default SitePotentialTab;
