import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  MapPinned,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  findMunicipalityPlanningRegistry,
  planningSourcesFor,
} from "@/lib/planning/municipalityPlanningRegistry";
import { dispatchErfFileVaultUpdated, useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfAsset, ErfAssetCategory } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import { cn } from "@/lib/utils";

interface GuidedPropertyChecksStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
}

type EvidenceKind = "approved_plans" | "existing_house_photo" | "site_photo" | "topography";

interface EvidenceOption {
  id: EvidenceKind;
  label: string;
  helper: string;
  category: ErfAssetCategory;
  assetType: string;
  sourceLabel: string;
  accept: string;
}

const EVIDENCE_OPTIONS: EvidenceOption[] = [
  {
    id: "approved_plans",
    label: "Approved municipal plans",
    helper:
      "Upload the approved plan set, not a sales plan, concept drawing, or unapproved architect sketch.",
    category: "architectural_plan",
    assetType: "approved_building_plan",
    sourceLabel: "User identified as approved municipal building plans",
    accept: ".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff",
  },
  {
    id: "existing_house_photo",
    label: "Photos of existing buildings",
    helper:
      "Photograph every structure, addition, garage, flatlet, deck, pool enclosure, and outbuilding.",
    category: "existing_house_photo",
    assetType: "existing_building_photo",
    sourceLabel: "User uploaded photo of an existing building or improvement",
    accept: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
  },
  {
    id: "site_photo",
    label: "Site and boundary photos",
    helper:
      "Show access, slope, retaining walls, visible services, boundaries, vegetation, and neighbouring levels.",
    category: "site_photo",
    assetType: "site_condition_photo",
    sourceLabel: "User uploaded site or boundary photo",
    accept: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
  },
  {
    id: "topography",
    label: "Topographic or land survey",
    helper:
      "Upload a survey tied to this erf. Easy Erf will read it and check the property identity.",
    category: "topography",
    assetType: "topographical_survey",
    sourceLabel: "User uploaded topographic or land survey",
    accept: ".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff",
  },
];

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isApprovedPlan(asset: ErfAsset) {
  if (asset.asset_category !== "architectural_plan") return false;
  const text = [asset.asset_type, asset.source_label ?? "", asset.original_file_name]
    .join(" ")
    .toLowerCase();
  return text.includes("approved") || text.includes("municipal plan");
}

function isUsableTopography(asset: ErfAsset) {
  return (
    asset.asset_category === "topography" &&
    erfAssetHasSearchableExtraction(asset) &&
    erfAssetIdentityMatchStatus(asset) === "matched"
  );
}

function categoryLabel(asset: ErfAsset) {
  if (isApprovedPlan(asset)) return "Approved plans supplied";
  if (asset.asset_category === "existing_house_photo") return "Existing building photo";
  if (asset.asset_category === "site_photo") return "Site photo";
  if (asset.asset_category === "topography") return "Topographic survey";
  return "Property evidence";
}

export function GuidedPropertyChecksStep({ parcel, onContinue }: GuidedPropertyChecksStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, [
    "architectural_plan",
    "topography",
    "site_photo",
    "existing_house_photo",
  ]);
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("approved_plans");
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  const selectedOption =
    EVIDENCE_OPTIONS.find((option) => option.id === evidenceKind) ?? EVIDENCE_OPTIONS[0];
  const approvedPlans = vault.assets.filter(isApprovedPlan);
  const existingBuildingPhotos = vault.assets.filter(
    (asset) => asset.asset_category === "existing_house_photo",
  );
  const sitePhotos = vault.assets.filter((asset) => asset.asset_category === "site_photo");
  const usableTopography = vault.assets.filter(isUsableTopography);
  const canContinue =
    approvedPlans.length > 0 ||
    existingBuildingPhotos.length > 0 ||
    sitePhotos.length > 0 ||
    usableTopography.length > 0;
  const irregularBuildingRisk = existingBuildingPhotos.length > 0 && approvedPlans.length === 0;

  const registry = useMemo(
    () => findMunicipalityPlanningRegistry(parcel.municipality ?? null),
    [parcel.municipality],
  );
  const requestSources = useMemo(
    () =>
      registry
        ? planningSourcesFor(registry, parcel.suburbOrArea ?? parcel.town ?? null)
            .filter(
              (source) =>
                source.status === "active" &&
                (source.sourceType === "planning_register" ||
                  source.sourceType === "land_use_scheme"),
            )
            .slice(0, 3)
        : [],
    [parcel.suburbOrArea, parcel.town, registry],
  );

  async function readTopography(asset: ErfAsset, retry = false) {
    if (!isExtractableErfAsset(asset)) {
      toast.error(
        "This survey file cannot be read automatically. Upload a PDF, PNG, JPG, JPEG, TIF, or TIFF file.",
      );
      return;
    }
    setReadingAssetId(asset.id);
    try {
      const result = await extractErfAsset(asset.id, {
        expectedParcelId: parcel.id,
        retry,
      });
      await vault.refresh();
      dispatchErfFileVaultUpdated(parcel.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.identityMatchStatus === "mismatch") {
        toast.error("This survey appears to describe a different property and was rejected.");
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning("The survey was read, but its property identity still needs confirmation.");
        return;
      }
      toast.success("Survey read and matched to this erf.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The survey could not be read.");
    } finally {
      setReadingAssetId(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to upload and securely store property evidence.");
      return;
    }

    const uploadedAssets: ErfAsset[] = [];
    for (const file of selectedFiles) {
      try {
        const result = await vault.upload({
          file,
          fileName: file.name,
          category: selectedOption.category,
          assetType: selectedOption.assetType,
          sourceLabel: selectedOption.sourceLabel,
          metadata: {
            source: "guided-property-checks-step",
            evidenceKind: selectedOption.id,
            userClassification: true,
          },
        });
        if (!result.ok) {
          if (result.reason === "too_large") toast.error(`${file.name} is too large.`);
          else if (result.reason === "empty_file") toast.error(`${file.name} is empty.`);
          else
            toast.error(`${file.name} is not a supported file type for ${selectedOption.label}.`);
          continue;
        }
        uploadedAssets.push(result.asset);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `${file.name} could not be uploaded.`);
      }
    }

    if (!uploadedAssets.length) return;
    toast.success(
      uploadedAssets.length === 1
        ? `${selectedOption.label} uploaded.`
        : `${uploadedAssets.length} files added as ${selectedOption.label.toLowerCase()}.`,
    );
    if (selectedOption.id === "topography") {
      for (const asset of uploadedAssets) await readTopography(asset);
    }
  }

  async function removeAsset(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      toast.success("Property evidence removed from this erf file.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The file could not be removed.");
    } finally {
      setRemovingAssetId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Buildings and site evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Check for unapproved or irregular improvements
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Add approved municipal plans, photos of every existing structure, site photos, or a
              matched survey. Easy Erf can organize the evidence, but an architect, surveyor, or
              municipality must compare what exists with what was approved.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              canContinue
                ? irregularBuildingRisk
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700",
            )}
          >
            {canContinue ? (
              irregularBuildingRisk ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {canContinue
              ? irregularBuildingRisk
                ? "Evidence added · plans still missing"
                : "Property evidence added"
              : "No property evidence added"}
          </span>
        </div>
      </section>

      {irregularBuildingRisk ? (
        <section className="rounded-[1.25rem] border border-amber-300/50 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
            <div>
              <h4 className="text-sm font-semibold text-amber-950">
                Potential irregular-building risk is unresolved
              </h4>
              <p className="mt-1 text-sm leading-6 text-amber-950/78">
                Photos show existing improvements, but no file has been identified as approved
                municipal plans. This does not prove the buildings are illegal. It means Easy Erf
                cannot yet compare the visible structures with an approved plan set.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {EVIDENCE_OPTIONS.map((option) => {
            const selected = option.id === evidenceKind;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setEvidenceKind(option.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  selected
                    ? "border-[#FF6A00]/55 bg-[#fff8ec] ring-2 ring-[#FF6A00]/10"
                    : "border-[#0D1B2A]/10 bg-[#F8FAFC] hover:border-[#FF6A00]/30",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
                  {option.id.includes("photo") ? (
                    <FileImage className="h-4 w-4 text-[#FF6A00]" />
                  ) : option.id === "topography" ? (
                    <MapPinned className="h-4 w-4 text-[#FF6A00]" />
                  ) : (
                    <FileText className="h-4 w-4 text-[#FF6A00]" />
                  )}
                  {option.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{option.helper}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!vault.signedIn}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload {selectedOption.label.toLowerCase()}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={selectedOption.accept}
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          {requestSources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
            >
              Request plans via {source.title}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
        {!vault.signedIn ? (
          <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Sign in before uploading. You can skip this step until the plans, photos, or survey are
            available.
          </p>
        ) : null}
        {vault.uploadState ? (
          <p className="mt-3 rounded-xl border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-xs text-[#0D1B2A]/66">
            Upload progress: {vault.uploadState.progress}% · {vault.uploadState.label}
          </p>
        ) : null}
        {vault.error ? (
          <p className="mt-3 rounded-xl border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-900">
            {vault.error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Approved plans", approvedPlans.length],
          ["Building photos", existingBuildingPhotos.length],
          ["Site photos", sitePhotos.length],
          ["Matched surveys", usableTopography.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[#0D1B2A]/10 bg-white p-3">
            <div className="text-2xl font-semibold tracking-tight text-[#0D1B2A]">{value}</div>
            <div className="mt-1 text-xs font-medium text-[#64748B]">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Property-check evidence</h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              Plans are user-classified until confirmed by the municipality. Surveys must be
              readable and matched.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#64748B]">
            {vault.assets.length} file{vault.assets.length === 1 ? "" : "s"}
          </span>
        </div>

        {vault.loading ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-[#0D1B2A]/58">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking the Erf File Vault...
          </div>
        ) : vault.assets.length ? (
          <div className="mt-4 grid gap-3">
            {vault.assets.map((asset) => {
              const extractionStatus = erfAssetExtractionStatus(asset);
              const identityStatus = erfAssetIdentityMatchStatus(asset);
              const reading = readingAssetId === asset.id;
              const removing = removingAssetId === asset.id;
              const usableSurvey = isUsableTopography(asset);
              const wrongSurvey =
                asset.asset_category === "topography" && identityStatus === "mismatch";
              const retry =
                extractionStatus === "failed" ||
                extractionStatus === "partial" ||
                extractionStatus === "unsupported" ||
                extractionStatus === "not_started" ||
                identityStatus === "unverified";

              return (
                <article
                  key={asset.id}
                  className={cn(
                    "rounded-xl border p-4",
                    wrongSurvey
                      ? "border-red-300/50 bg-red-50"
                      : usableSurvey || isApprovedPlan(asset)
                        ? "border-emerald-300/50 bg-emerald-50"
                        : "border-[#0D1B2A]/10 bg-[#F8FAFC]",
                  )}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0D1B2A]">
                        {asset.original_file_name}
                      </div>
                      <p className="mt-1 text-xs text-[#0D1B2A]/60">
                        {formatFileSize(asset.size_bytes)} · Uploaded {formatDate(asset.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/72">
                          {categoryLabel(asset)}
                        </span>
                        {asset.asset_category === "topography" ? (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                              usableSurvey
                                ? "bg-emerald-600 text-white"
                                : wrongSurvey
                                  ? "bg-red-700 text-white"
                                  : "bg-amber-200 text-amber-950",
                            )}
                          >
                            {reading ? "Reading survey" : erfAssetExtractionLabel(asset)}
                          </span>
                        ) : null}
                      </div>
                      {wrongSurvey ? (
                        <p className="mt-2 text-xs font-medium leading-5 text-red-900">
                          This survey appears to describe a different property and is not used for
                          this erf.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.asset_category === "topography" &&
                      isExtractableErfAsset(asset) &&
                      !usableSurvey &&
                      !wrongSurvey ? (
                        <button
                          type="button"
                          disabled={reading}
                          onClick={() => void readTopography(asset, retry)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:opacity-60"
                        >
                          {reading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {reading ? "Reading" : retry ? "Retry reading" : "Read survey"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void vault.open(asset)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
                      >
                        Open file
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => void removeAsset(asset)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-300/50 bg-white px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {removing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#0D1B2A]/58">
            No property-check evidence has been added yet.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Market evidence
        </button>
      </div>
    </div>
  );
}

export default GuidedPropertyChecksStep;
