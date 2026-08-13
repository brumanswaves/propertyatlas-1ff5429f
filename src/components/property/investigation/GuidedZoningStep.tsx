import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  confirmStoredPlanningZone,
  readStoredPlanningZoneState,
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
import { useAuth } from "@/lib/auth/useAuth";

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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["zoning_document"]);
  const [selectedZoneCode, setSelectedZoneCode] = useState<string | null>(null);
  const [userConfirmedZoneCode, setUserConfirmedZoneCode] = useState<string | null>(null);
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

  useLayoutEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string; userId?: string | null }> | undefined)
        ?.detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      if ((detail?.userId ?? null) !== userId) return;
      const planningState = readStoredPlanningZoneState(parcel.id, userId);
      setSelectedZoneCode(planningState.zoneCode);
      setUserConfirmedZoneCode(planningState.userConfirmedZoneCode);
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcel.id, userId]);

  const usableDocuments = useMemo(
    () =>
      selectedZone
        ? vault.assets.filter((asset) => isUsableSubjectZoningDocument(asset, selectedZone))
        : [],
    [selectedZone, vault.assets],
  );
  const documentBacked = usableDocuments.length > 0;
  const userConfirmedWorkingZone =
    Boolean(selectedZoneCode) && userConfirmedZoneCode === selectedZoneCode;
  const canContinue = documentBacked || userConfirmedWorkingZone;
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
    setSelectedZoneCode(writeStoredPlanningZone(parcel.id, code, userId));
    setUserConfirmedZoneCode(null);
  }

  function confirmWorkingZone() {
    const next = confirmStoredPlanningZone(parcel.id, userId);
    setSelectedZoneCode(next.zoneCode);
    setUserConfirmedZoneCode(next.userConfirmedZoneCode);
  }

  async function readZoningDocument(asset: ErfAsset, retry = false) {
    if (!isExtractableErfAsset(asset)) {
      toast.error("This file type cannot be read automatically.");
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
        toast.error("This zoning document describes a different property and was rejected.");
        return;
      }
      if (result.claimCount === 0) {
        toast.warning("The file was saved, but Easy Erf could not read a zoning statement from it.");
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning("The document was read, but its property identity still needs confirmation.");
        return;
      }

      toast.success("Zoning document read and matched. Check that it agrees with your selection.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The zoning document could not be read.");
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
    for (const asset of uploadedAssets) await readZoningDocument(asset);
  }

  async function removeDocument(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      toast.success("Zoning document removed. Your working zoning remains saved but unverified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The zoning document could not be removed.");
    } finally {
      setRemovingAssetId(null);
    }
  }

  const statusText = documentBacked
    ? "Document-backed zoning confirmed"
    : userConfirmedWorkingZone
      ? "Working zoning confirmed by you"
    : selectedZone
      ? "Working zoning selected, unverified"
      : vault.assets.length
        ? "Select the zoning shown by the record"
        : "No working zoning selected";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Working zoning and supporting evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Select the zoning, then strengthen it with the municipal record
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Select the zoning shown by your source, then confirm it as your working conclusion
              before continuing. A readable, property-specific record is still stronger evidence;
              Easy Erf keeps user-confirmed zoning clearly distinct from municipal proof.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              documentBacked
                ? "bg-emerald-100 text-emerald-800"
                : userConfirmedWorkingZone
                  ? "bg-sky-100 text-sky-900"
                  : selectedZone || vault.assets.length
                  ? "bg-amber-100 text-amber-900"
                  : "bg-slate-100 text-slate-700",
            )}
          >
            {documentBacked ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : userConfirmedWorkingZone ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : selectedZone || vault.assets.length ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {statusText}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-4">
        <h4 className="text-sm font-semibold text-[#0D1B2A]">How to use this page</h4>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            "Open a municipal source or property report and identify the zoning stated for this erf.",
            "Choose that zoning below, then confirm it as your working conclusion before continuing.",
            "Upload the erf-specific municipal record when available to upgrade the zoning to document-backed.",
          ].map((line, index) => (
            <li key={line} className="flex gap-3 rounded-xl border border-[#0D1B2A]/8 bg-white p-3">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]/12 text-[11px] font-bold text-[#FF6A00]">
                {index + 1}
              </span>
              <span className="text-xs leading-5 text-[#0D1B2A]/68">{line}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <label className="block text-xs font-semibold text-[#0D1B2A]" htmlFor="guided-zone-code">
              Working zoning for this erf
            </label>
            <select
              id="guided-zone-code"
              value={selectedZoneCode ?? ""}
              onChange={(event) => selectZone(event.target.value || null)}
              disabled={!zoneOptions.length}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Select the zoning shown by your source</option>
              {zoneOptions.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} · {zone.name}
                </option>
              ))}
            </select>
            {!registry ? (
              <p className="mt-2 text-xs leading-5 text-amber-800">
                Easy Erf does not yet have a reviewed zoning list for {parcel.municipality ?? "this municipality"}.
                Keep the official record attached and skip this step for now.
              </p>
            ) : null}
            {selectedZone ? (
              <div
                className={cn(
                  "mt-3 rounded-xl border p-3",
                  documentBacked
                    ? "border-emerald-300/45 bg-emerald-50"
                    : "border-amber-300/45 bg-amber-50",
                )}
              >
                <div className="text-xs font-semibold text-[#0D1B2A]">
                  {selectedZone.code} · {selectedZone.name}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  {documentBacked
                    ? "A readable matched document supports this selection."
                    : userConfirmedWorkingZone
                      ? "You confirmed this as the working zoning for this erf. It is not municipal proof yet."
                      : "Saved as an unverified working zoning. It is not municipal proof yet."}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/64">
                  Zoning alone does not confirm height, coverage, building lines, consent uses,
                  departures, title restrictions or approval to build.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <ShieldCheck className="h-4 w-4 text-[#FF6A00]" />
              Official planning sources
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Look for an erf-specific zoning certificate, zoning extract, municipal property record
              or a paid report that states the zoning. A general scheme explains rules but does not
              prove this erf's zoning.
            </p>
            {sources.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A]"
                  >
                    {source.title}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#0D1B2A]/58">No reviewed municipal source links are registered yet.</p>
            )}
          </div>
        </div>

        {selectedZone && !documentBacked ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#0D1B2A]/8 pt-4">
            <button
              type="button"
              disabled={userConfirmedWorkingZone}
              onClick={confirmWorkingZone}
              className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/12 bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white disabled:cursor-default disabled:opacity-55"
            >
              {userConfirmedWorkingZone ? "Working zoning confirmed" : "Confirm working zoning"}
            </button>
            <p className="max-w-xl text-xs leading-5 text-[#0D1B2A]/62">
              This records your working conclusion for this erf. Published rules and municipal proof
              remain separate.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#0D1B2A]/8 pt-4">
          <button
            type="button"
            disabled={!vault.signedIn}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:opacity-55"
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
            Sign in before uploading. You can still open the sources, save a working zoning or skip.
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
              A record upgrades the working selection only when identity, readability and zoning all agree.
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
                      <div className="break-words text-sm font-semibold text-[#0D1B2A]">
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
                          This document describes a different property and cannot support this erf.
                        </p>
                      ) : null}
                      {conflict ? (
                        <p className="mt-2 text-xs font-medium leading-5 text-red-900">
                          The extracted zoning conflicts with {selectedZone?.code} · {selectedZone?.name}.
                          The working selection remains unverified. Correct it or obtain the right record.
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
                              <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">{claim.value}</div>
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
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] disabled:opacity-60"
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
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A]"
                      >
                        Open file
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => void removeDocument(asset)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-300/50 bg-white px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-60"
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
          <p className="mt-4 text-sm text-[#0D1B2A]/58">No zoning document has been uploaded yet.</p>
        )}
      </section>

      {extractedPlanningClaims.length ? (
        <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <FileCheck2 className="h-4 w-4 text-[#FF6A00]" />
            Document-backed planning details
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
            These values came from an uploaded record. They are not a legal opinion or approval to build.
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
                <p className="mt-1 break-words text-xs text-[#0D1B2A]/55">Source: {claim.fileName}</p>
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
          title={
            selectedZone && !canContinue
              ? "Confirm this working zoning or attach a matching municipal record before continuing."
              : undefined
          }
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {documentBacked || userConfirmedWorkingZone
            ? "Continue to Property checks"
            : "Confirm working zoning to continue"}
        </button>
      </div>
    </div>
  );
}

export default GuidedZoningStep;
