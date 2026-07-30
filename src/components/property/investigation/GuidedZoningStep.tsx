import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  findMunicipalityPlanningRegistry,
  findZone,
  listZones,
  planningSourcesFor,
} from "@/lib/planning/municipalityPlanningRegistry";
import {
  PLANNING_ZONE_UPDATED_EVENT,
  readStoredPlanningZone,
  writeStoredPlanningZone,
} from "@/lib/planning/storedPlanningZone";
import {
  findSupportingZoningClaim,
  isReadableMatchedZoningDocument,
  isUsableSubjectZoningDocument,
} from "@/lib/planning/zoningEvidence";
import { dispatchErfFileVaultUpdated, useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractedClaims,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import { cn } from "@/lib/utils";

interface GuidedZoningStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function zoningClaims(asset: ErfAsset) {
  return erfAssetExtractedClaims(asset).filter(
    (claim) =>
      claim.scope === "subject" &&
      claim.domain === "planning" &&
      [
        "zoning",
        "landUse",
        "coverage",
        "far",
        "heightRestriction",
        "buildingLines",
        "densityUnits",
      ].includes(claim.key),
  );
}

export function GuidedZoningStep({ parcel, onContinue }: GuidedZoningStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["zoning_document"]);
  const [selectedZoneCode, setSelectedZoneCode] = useState<string | null>(null);
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  const registry = useMemo(
    () => findMunicipalityPlanningRegistry(parcel.municipality ?? null),
    [parcel.municipality],
  );
  const zoneOptions = useMemo(() => (registry ? listZones(registry) : []), [registry]);
  const selectedZone = useMemo(
    () => (registry ? findZone(registry, selectedZoneCode) : null),
    [registry, selectedZoneCode],
  );
  const sources = useMemo(
    () =>
      registry
        ? planningSourcesFor(registry, parcel.suburbOrArea ?? parcel.town ?? null)
            .filter((source) => source.status === "active")
            .slice(0, 4)
        : [],
    [parcel.suburbOrArea, parcel.town, registry],
  );

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string }> | undefined)?.detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      setSelectedZoneCode(readStoredPlanningZone(parcel.id));
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcel.id]);

  const usableDocuments = useMemo(
    () =>
      selectedZone
        ? vault.assets.filter((asset) => isUsableSubjectZoningDocument(asset, selectedZone))
        : [],
    [selectedZone, vault.assets],
  );
  const canContinue = usableDocuments.length > 0;
  const extractedPlanningClaims = useMemo(
    () =>
      vault.assets
        .filter(isReadableMatchedZoningDocument)
        .flatMap((asset) =>
          zoningClaims(asset).map((claim) => ({
            ...claim,
            assetId: asset.id,
            fileName: asset.original_file_name,
          })),
        )
        .slice(0, 12),
    [vault.assets],
  );

  function selectZone(code: string | null) {
    setSelectedZoneCode(writeStoredPlanningZone(parcel.id, code));
  }

  async function readZoningDocument(asset: ErfAsset, retry = false) {
    if (!isExtractableErfAsset(asset)) {
      toast.error(
        "This file type cannot be read. Upload a PDF, PNG, JPG, JPEG, TIF, or TIFF file.",
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
        toast.error(
          "This zoning document appears to describe a different property and was rejected.",
        );
        return;
      }
      if (result.claimCount === 0) {
        toast.warning(
          "The document was saved, but Easy Erf could not read a zoning statement from it.",
        );
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning("The document was read, but its property identity still needs confirmation.");
        return;
      }

      toast.success(
        "Zoning document read and matched. Confirm the selected zone agrees with the extracted statement.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The zoning document could not be read.",
      );
    } finally {
      setReadingAssetId(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to upload and securely store zoning documents.");
      return;
    }

    const uploadedAssets: ErfAsset[] = [];
    for (const file of selectedFiles) {
      try {
        const result = await vault.upload({
          file,
          fileName: file.name,
          category: "zoning_document",
          assetType: "zoning_certificate",
          sourceLabel: "User uploaded zoning certificate or municipal zoning record",
          metadata: { source: "guided-zoning-step" },
        });
        if (!result.ok) {
          if (result.reason === "too_large") {
            toast.error(`${file.name} is larger than the 25 MB document limit.`);
          } else if (result.reason === "empty_file") {
            toast.error(`${file.name} is empty.`);
          } else {
            toast.error(`${file.name} is not a supported document file.`);
          }
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
        ? "Zoning document uploaded. Easy Erf is reading it now."
        : `${uploadedAssets.length} zoning documents uploaded. Easy Erf is reading them now.`,
    );
    for (const asset of uploadedAssets) {
      await readZoningDocument(asset);
    }
  }

  async function removeDocument(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      toast.success("Zoning document removed from this erf file.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The zoning document could not be removed.",
      );
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
              Property-specific planning evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Confirm the zoning stated for this erf
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Choose the zoning stated by the municipal record, then attach that record. Easy Erf
              only completes this step when the document is readable, matches the selected erf, and
              states a zoning that agrees with your selection.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              canContinue
                ? "bg-emerald-100 text-emerald-800"
                : vault.assets.length
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700",
            )}
          >
            {canContinue ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : vault.assets.length ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {canContinue
              ? "Document-backed zoning ready"
              : vault.assets.length
                ? "Zoning needs attention"
                : "Zoning not confirmed"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <label
              className="block text-xs font-semibold text-[#0D1B2A]"
              htmlFor="guided-zone-code"
            >
              Zoning stated by the document
            </label>
            <select
              id="guided-zone-code"
              value={selectedZoneCode ?? ""}
              onChange={(event) => selectZone(event.target.value || null)}
              disabled={!zoneOptions.length}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Select the zoning shown on the record</option>
              {zoneOptions.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} · {zone.name}
                </option>
              ))}
            </select>
            {!registry ? (
              <p className="mt-2 text-xs leading-5 text-amber-800">
                Easy Erf does not yet have a reviewed zoning registry for{" "}
                {parcel.municipality ?? "this municipality"}. Keep the official record attached and
                skip this step until its zoning list is supported.
              </p>
            ) : null}
            {selectedZone ? (
              <div className="mt-3 rounded-xl border border-[#FF6A00]/18 bg-[#fff8ec] p-3">
                <div className="text-xs font-semibold text-[#0D1B2A]">
                  Working selection: {selectedZone.code} · {selectedZone.name}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  This selection is not proof by itself. The attached property-specific record must
                  state the same zoning before the step completes.
                </p>
                {selectedZone.status !== "active" ? (
                  <p className="mt-2 text-xs font-medium leading-5 text-amber-900">
                    Easy Erf’s numeric controls for this zone remain review-required general-rule
                    candidates. A confirmed zone does not automatically confirm height, coverage,
                    building lines, consent uses, departures, title restrictions, or approved
                    development rights.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <ShieldCheck className="h-4 w-4 text-[#FF6A00]" />
              Official planning sources
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Use the municipal planning page or document library to obtain a zoning certificate,
              zoning extract, or other erf-specific record. General scheme documents explain rules
              but do not prove the zoning of this erf.
            </p>
            {sources.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
                  >
                    {source.title}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#0D1B2A]/58">
                No reviewed municipal source links are registered yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#0D1B2A]/8 pt-4">
          <button
            type="button"
            disabled={!vault.signedIn}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload zoning document
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff"
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
        {!vault.signedIn ? (
          <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Sign in before uploading. You can still open the official sources and skip this step for
            now.
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

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Attached zoning records</h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              Uploading is not enough. Identity, readability, and the zoning statement must all
              agree.
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
              const supportingClaim = selectedZone
                ? findSupportingZoningClaim(asset, selectedZone)
                : null;
              const usable = Boolean(
                selectedZone && isUsableSubjectZoningDocument(asset, selectedZone),
              );
              const readableMatched = isReadableMatchedZoningDocument(asset);
              const claims = zoningClaims(asset);
              const reading = readingAssetId === asset.id;
              const removing = removingAssetId === asset.id;
              const retry =
                extractionStatus === "failed" ||
                extractionStatus === "partial" ||
                extractionStatus === "unsupported" ||
                extractionStatus === "not_started" ||
                identityStatus === "unverified";
              const conflict =
                readableMatched && Boolean(selectedZone) && claims.length > 0 && !supportingClaim;

              return (
                <article
                  key={asset.id}
                  className={cn(
                    "rounded-xl border p-4",
                    usable
                      ? "border-emerald-300/50 bg-emerald-50"
                      : identityStatus === "mismatch" || conflict
                        ? "border-red-300/50 bg-red-50"
                        : "border-amber-300/45 bg-amber-50",
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
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                            usable
                              ? "bg-emerald-600 text-white"
                              : identityStatus === "mismatch" || conflict
                                ? "bg-red-700 text-white"
                                : "bg-amber-200 text-amber-950",
                          )}
                        >
                          {reading
                            ? "Reading document"
                            : usable
                              ? "Selected zoning supported"
                              : erfAssetExtractionLabel(asset)}
                        </span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
                          Identity: {identityStatus ?? "not checked"}
                        </span>
                      </div>
                      {identityStatus === "mismatch" ? (
                        <p className="mt-2 text-xs font-medium leading-5 text-red-900">
                          This document appears to describe a different property. It cannot support
                          zoning for this erf.
                        </p>
                      ) : null}
                      {conflict ? (
                        <p className="mt-2 text-xs font-medium leading-5 text-red-900">
                          The extracted zoning does not agree with {selectedZone?.code} ·{" "}
                          {selectedZone?.name}. Correct the selection or obtain the correct property
                          record before continuing.
                        </p>
                      ) : null}
                      {erfAssetIdentityMatchReason(asset) ? (
                        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                          {erfAssetIdentityMatchReason(asset)}
                        </p>
                      ) : null}
                      {claims.length ? (
                        <div className="mt-3 grid gap-2">
                          {claims.slice(0, 5).map((claim, index) => (
                            <div
                              key={`${claim.key}-${claim.page ?? "page"}-${index}`}
                              className="rounded-lg bg-white/78 p-2.5"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B]">
                                {claim.label} · {claim.confidence}
                                {claim.page ? ` · Page ${claim.page}` : ""}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">
                                {claim.value}
                              </div>
                              {claim.quote ? (
                                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
                                  “{claim.quote}”
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isExtractableErfAsset(asset) && !usable && identityStatus !== "mismatch" ? (
                        <button
                          type="button"
                          disabled={reading}
                          onClick={() => void readZoningDocument(asset, retry)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:opacity-60"
                        >
                          {reading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {reading ? "Reading" : retry ? "Retry reading" : "Read document"}
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
                        onClick={() => void removeDocument(asset)}
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
            No zoning document has been uploaded yet.
          </p>
        )}
      </section>

      {extractedPlanningClaims.length ? (
        <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <FileCheck2 className="h-4 w-4 text-[#FF6A00]" />
            Document-backed planning details
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
            These values were read from the attached record. They remain document-derived evidence,
            not a legal opinion or approval to build.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {extractedPlanningClaims.map((claim, index) => (
              <div
                key={`${claim.assetId}-${claim.key}-${index}`}
                className="rounded-xl border border-[#0D1B2A]/8 bg-white p-3"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B]">
                  {claim.label} · {claim.confidence}
                  {claim.page ? ` · Page ${claim.page}` : ""}
                </div>
                <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">{claim.value}</div>
                <p className="mt-1 truncate text-xs text-[#0D1B2A]/55">Source: {claim.fileName}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Property checks
        </button>
      </div>
    </div>
  );
}

export default GuidedZoningStep;
