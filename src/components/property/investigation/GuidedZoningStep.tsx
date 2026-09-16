import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileCheck2,
  Loader2,
  RotateCcw,
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
  readStoredPlanningZoneState,
  writeStoredPlanningZone,
  selectPlanningZone,
  confirmPlanningZone,
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
import { useSharedInvestigationScope } from "@/lib/investigation/sharedInvestigationContext";
import { buildSavedInvestigationUserDataPatch, flushSavedInvestigation, workspaceFromSavedInvestigation } from "@/lib/workbench/savedInvestigationProjection";
import { readErfWorkspaceState, updateErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { toSupabaseJson } from "@/lib/supabase/json";

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
  const shared = useSharedInvestigationScope(parcel.id);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["zoning_document"]);
  const [selectedZoneCode, setSelectedZoneCode] = useState<string | null>(null);
  const [userConfirmedZoneCode, setUserConfirmedZoneCode] = useState<string | null>(null);
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const operationScope = useMemo(() => ({ active: true, pending: false, parcelId: parcel.id, userId,
    orderId: shared?.snapshot.orderId }), [parcel.id, userId, shared?.snapshot.orderId]);
  useLayoutEffect(() => {
    operationScope.active = true;
    setChoosing(false); setContinuing(false); setContinueError(null);
    return () => { operationScope.active = false; };
  }, [operationScope]);

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
    if (shared) {
      const planning = workspaceFromSavedInvestigation(parcel.id, shared.snapshot.userData).planning;
      setSelectedZoneCode(planning.zoneCode); setUserConfirmedZoneCode(planning.userConfirmedZoneCode);
      return;
    }
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string; userId?: string | null }> | undefined)
        ?.detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      if (event && (detail?.userId ?? null) !== userId) return;
      const planningState = readStoredPlanningZoneState(parcel.id, userId);
      setSelectedZoneCode(planningState.zoneCode);
      setUserConfirmedZoneCode(planningState.userConfirmedZoneCode);
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcel.id, userId, shared]);

  const userConfirmedWorkingZone =
    Boolean(selectedZoneCode) && userConfirmedZoneCode === selectedZoneCode;
  const supportedZones = zoneOptions.filter((zone) => vault.assets.some((asset) =>
    asset.parcel_id === parcel.id && isUsableSubjectZoningDocument(asset, zone)));
  const suggestedZone = supportedZones.length === 1 ? supportedZones[0] : null;
  const workingZone = selectedZone ?? suggestedZone;
  const supportingDocument = workingZone && vault.assets.find((asset) =>
    asset.parcel_id === parcel.id && isUsableSubjectZoningDocument(asset, workingZone));
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

  async function selectZone(code: string | null) {
    if (shared) {
      const workspace = workspaceFromSavedInvestigation(parcel.id, shared.snapshot.userData);
      try { await shared.save(toSupabaseJson({ easyErfInvestigation: { ...workspace, planning: selectPlanningZone(workspace.planning, code) } })); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Zoning could not be saved."); }
      return;
    }
    const next = writeStoredPlanningZone(parcel.id, code, userId);
    setSelectedZoneCode(next.zoneCode);
    setUserConfirmedZoneCode(next.userConfirmedZoneCode);
  }

  async function confirmAndContinue(notSure = false) {
    if (operationScope.pending || shared?.busy || (!notSure && !workingZone)) return;
    operationScope.pending = true;
    setContinuing(true); setContinueError(null);
    try {
      const workspace = shared
        ? workspaceFromSavedInvestigation(parcel.id, shared.snapshot.userData)
        : readErfWorkspaceState(parcel.id, undefined, userId);
      const planning = notSure ? { ...workspace.planning, userConfirmedZoneCode: null, userConfirmedAt: null }
        : confirmPlanningZone(selectPlanningZone(workspace.planning, workingZone!.code));
      const investigation = { ...workspace.investigation, skippedStepIds: notSure
        ? Array.from(new Set([...workspace.investigation.skippedStepIds, "zoning"]))
        : workspace.investigation.skippedStepIds.filter((id) => id !== "zoning") };
      if (shared) {
        await shared.save(toSupabaseJson(buildSavedInvestigationUserDataPatch(parcel.id, { ...workspace, planning, investigation })));
      } else {
        updateErfWorkspaceState(parcel.id, { planning, investigation, dirty: true }, undefined, userId);
        window.dispatchEvent(new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, { detail: { parcelId: parcel.id, userId, zoneCode: planning.zoneCode } }));
        if (userId) await flushSavedInvestigation(parcel.id, userId);
      }
      if (operationScope.active) onContinue();
    } catch (error) {
      if (operationScope.active) setContinueError(error instanceof Error ? error.message : "Zoning could not be saved. Your selection is retained; retry to continue.");
    } finally {
      operationScope.pending = false;
      if (operationScope.active) setContinuing(false);
    }
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
        ...(vault.investigationOrderId ? { investigationOrderId: vault.investigationOrderId } : {}),
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

  return (
    <div className="space-y-4">
      <section aria-label="Zoning decision" className="border-b border-[#0D1B2A]/10 pb-5">
        <h4 className="text-lg font-semibold text-[#0D1B2A]">
          {workingZone ? (supportingDocument ? "Suggested zoning for this erf" : "Your working zoning") : "Choose a working zoning"}
        </h4>
        {workingZone ? <>
          <p className="mt-2 text-base font-semibold">{workingZone.code} · {workingZone.name}</p>
          <p className="mt-1 text-sm text-[#0D1B2A]/70">
            {supportingDocument
              ? `Document supported · Extraction confidence: ${findSupportingZoningClaim(supportingDocument, workingZone)?.confidence ?? "unverified"} · ${supportingDocument.source_label || supportingDocument.original_file_name}`
              : userConfirmedWorkingZone ? "Working zoning confirmed by you · Not municipal proof" : "User selection · Working assumption, not municipal proof"}
          </p>
          <p className="mt-2 text-sm text-[#0D1B2A]/70">Confirming this choice does not establish development rights or municipal approval.</p>
        </> : <p className="mt-2 text-sm text-[#0D1B2A]/70">
          {supportedZones.length > 1 ? "Attached records disagree on zoning. Check the sources before choosing." : "No supported zoning match for this erf is recorded."}
          {" "}The municipal list supplies working options, not property-specific confirmation.
        </p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {workingZone && <button type="button" disabled={continuing || shared?.busy || vault.loading}
            onClick={() => void confirmAndContinue()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {continuing && <Loader2 className="h-4 w-4 animate-spin" />}
            {continuing ? "Saving zoning..." : "Use this zoning and continue"}
          </button>}
          <button type="button" disabled={continuing || shared?.busy} aria-expanded={choosing}
            onClick={() => setChoosing(!choosing)}
            className="min-h-11 rounded-lg border border-[#0D1B2A]/20 px-4 py-2 text-sm font-semibold">
            {workingZone ? "Change zoning" : "Choose zoning"}
          </button>
          <button type="button" disabled={continuing || shared?.busy}
            onClick={() => void confirmAndContinue(true)}
            className="min-h-11 rounded-lg border border-[#0D1B2A]/20 px-4 py-2 text-sm">
            Not sure - continue without confirming
          </button>
        </div>
        {!userId && !shared && <p className="mt-2 text-xs text-[#0D1B2A]/65">Saved in this browser only. Sign in to save to your account.</p>}
        {continueError && <p role="alert" className="mt-3 text-sm text-red-800">{continueError} Your selection is retained. Retry to continue.</p>}
        {choosing && <div className="mt-4">
          {zoneOptions.length ? <div role="radiogroup" aria-label="Working zoning for this erf" className="grid gap-2 sm:grid-cols-2">
            {zoneOptions.map((zone) => <button key={zone.code} type="button" role="radio"
              aria-checked={selectedZoneCode === zone.code} disabled={continuing || shared?.busy}
              onClick={() => void selectZone(zone.code)}
              className={cn("min-h-[5.25rem] rounded-lg border p-3 text-left text-sm disabled:opacity-50",
                selectedZoneCode === zone.code ? "border-[#FF6A00] bg-[#FFF7ED]" : "border-[#0D1B2A]/15 bg-white")}>
              <span className="block font-semibold">{zone.code} · {zone.name}</span>
              <span className="mt-1 block text-xs">{selectedZoneCode === zone.code ? "Selected working option" : "Working option"}</span>
            </button>)}
          </div> : <p className="text-sm">No reviewed zoning options are available for this municipality yet. You can continue without confirming.</p>}
        </div>}
      </section>

      <details className="rounded-lg border border-[#0D1B2A]/10 p-4">
        <summary className="min-h-10 cursor-pointer text-sm font-semibold">Optional zoning documents and official sources</summary>
        <p className="mt-2 text-sm text-[#0D1B2A]/70">A readable property-specific record can strengthen a working choice. No document is required to continue with an assumption or leave zoning unconfirmed.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 text-sm underline">{source.title}<ExternalLink className="h-3.5 w-3.5" /></a>)}
        </div>
        <button type="button" disabled={!vault.signedIn} onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
          <Upload className="h-4 w-4" />Upload zoning document
        </button>
        <input ref={inputRef} type="file" multiple
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff"
          className="hidden" onChange={(event) => { void uploadFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
        {!vault.signedIn && <p className="mt-2 text-xs">Sign in to upload zoning documents.</p>}
        {vault.uploadState && <p className="mt-2 text-xs">Upload progress: {vault.uploadState.progress}% · {vault.uploadState.label}</p>}
        {vault.error && <p role="alert" className="mt-2 text-sm text-red-800">{vault.error}</p>}
      </details>

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

    </div>
  );
}

export default GuidedZoningStep;
