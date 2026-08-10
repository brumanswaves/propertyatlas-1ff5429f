import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import { CSG_VIEWER_URL } from "@/lib/external-urls";
import { dispatchErfFileVaultUpdated, useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { buildErfAssetExpectedIdentityContext, type ErfAsset } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetExtractedIdentity,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityUserConfirmed,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import { updateErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { cn } from "@/lib/utils";

interface GuidedSgDiagramStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
}

function knownField(parcel: NormalizedOfficialParcel, pattern: RegExp) {
  return parcel.knownFields.find((field) => pattern.test(`${field.label} ${field.source}`))?.value;
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

function isUsableSubjectDiagram(asset: ErfAsset) {
  return erfAssetHasSearchableExtraction(asset) && erfAssetIdentityMatchStatus(asset) === "matched";
}

export function GuidedSgDiagramStep({ parcel, onContinue }: GuidedSgDiagramStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["sg_diagram"]);
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [confirmingAssetId, setConfirmingAssetId] = useState<string | null>(null);

  const sgDocument = useMemo(
    () =>
      buildSgDocumentUrl({
        lpi: parcel.lpi,
        parcelKey: parcel.parcelKey,
        erfNumber: parcel.erfNumber,
        portion: parcel.portion,
        province: parcel.province,
        majorRegion: knownField(parcel, /major region|town/i) ?? parcel.town,
        minorRegion:
          knownField(parcel, /minor region|registration division|township/i) ?? parcel.suburbOrArea,
      }),
    [parcel],
  );

  const usableDiagrams = vault.assets.filter(isUsableSubjectDiagram);
  const canContinue = usableDiagrams.length > 0;

  function syncAttachmentCount(count: number) {
    updateErfWorkspaceState(parcel.id, {
      sgDiagramAttachmentCount: count,
      dirty: true,
    });
  }

  async function readDiagram(asset: ErfAsset, retry = false) {
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
          "This diagram appears to describe a different property. It was not accepted for this erf.",
        );
        return;
      }
      if (result.claimCount === 0) {
        toast.warning(
          "The file was saved, but Easy Erf could not read usable diagram details yet.",
        );
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning(
          "The diagram was read, but its identity still needs confirmation before this step is complete.",
        );
        return;
      }

      toast.success("SG diagram read and matched to this erf. You can continue to Check title.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The SG diagram could not be read.");
    } finally {
      setReadingAssetId(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to upload and securely store SG diagrams in the Erf File Vault.");
      return;
    }

    let uploadedCount = 0;
    const uploadedAssets: ErfAsset[] = [];
    for (const file of selectedFiles) {
      try {
        const result = await vault.upload({
          file,
          fileName: file.name,
          category: "sg_diagram",
          assetType: "sg_diagram",
          sourceLabel: "User uploaded SG diagram",
          metadata: {
            source: "guided-sg-diagram-step",
            expectedIdentityContext: buildErfAssetExpectedIdentityContext(parcel),
          },
        });
        if (!result.ok) {
          if (result.reason === "too_large") {
            toast.error(`${file.name} is larger than the 25 MB diagram limit.`);
          } else if (result.reason === "empty_file") {
            toast.error(`${file.name} is empty.`);
          } else {
            toast.error(`${file.name} is not a supported diagram file.`);
          }
          continue;
        }
        if (result.asset) uploadedAssets.push(result.asset);
        uploadedCount += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `${file.name} could not be uploaded.`);
      }
    }

    if (!uploadedCount) return;
    syncAttachmentCount(vault.assets.length + uploadedCount);
    toast.success(
      uploadedCount === 1
        ? "SG diagram uploaded. Easy Erf is reading it now."
        : `${uploadedCount} SG diagrams uploaded. Easy Erf is reading them now.`,
    );

    for (const asset of uploadedAssets) {
      await readDiagram(asset);
    }
  }

  async function removeDiagram(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      syncAttachmentCount(Math.max(0, vault.assets.length - 1));
      toast.success("SG diagram removed from this erf file.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The SG diagram could not be removed.");
    } finally {
      setRemovingAssetId(null);
    }
  }

  async function confirmDiagramIdentity(asset: ErfAsset) {
    setConfirmingAssetId(asset.id);
    try {
      await vault.confirmIdentity(asset);
      toast.success("Document attached as user-confirmed evidence. This is not official verification.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The document could not be confirmed.");
    } finally {
      setConfirmingAssetId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Official parcel diagram
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Find and attach the official SG / cadastral document
            </h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0D1B2A]/66">
              Easy Erf can prepare the official CSG lookup, but the government document service may
              sometimes be unavailable. If it fails, use the CSG Property Viewer or upload an SG
              diagram / General Plan you already have. Easy Erf only marks this step complete after
              the file is readable and matched to the selected erf.
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
              ? "Matched diagram ready"
              : vault.assets.length
                ? "Diagram needs attention"
                : "No diagram attached"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <ol className="grid gap-3 md:grid-cols-3">
          <li className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
              1. Open
            </div>
            <p className="mt-1 text-sm font-semibold text-[#0D1B2A]">Find the official diagram</p>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Try the prepared official CSG search. If that service is unavailable, use the CSG
              Property Viewer instead.
            </p>
          </li>
          <li className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
              2. Download
            </div>
            <p className="mt-1 text-sm font-semibold text-[#0D1B2A]">Save the diagram file</p>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Download the subject erf diagram as a PDF or image. Do not use a neighbouring erf
              diagram.
            </p>
          </li>
          <li className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
              3. Upload
            </div>
            <p className="mt-1 text-sm font-semibold text-[#0D1B2A]">
              Easy Erf reads and checks it
            </p>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              The file stays in your private Erf File Vault and is checked against this parcel
              identity.
            </p>
          </li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          {sgDocument.shown ? (
            <a
              href={sgDocument.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
            >
              Open official CSG document search
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <a
            href={CSG_VIEWER_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
          >
            Open CSG Property Viewer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            disabled={!vault.signedIn}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload SG diagram / General Plan
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

        {!sgDocument.shown && (
          <p className="mt-3 rounded-xl bg-[#fff8ec] px-3 py-2 text-xs leading-5 text-[#0D1B2A]/66">
            A prepared CSG document search could not be built from this parcel record. Use the CSG
            Property Viewer and search using Erf {parcel.erfNumber ?? "number not available"},
            portion {parcel.portion ?? 0}, and the parcel identifiers shown in Step 1.
          </p>
        )}
        {!vault.signedIn && (
          <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Sign in before uploading. Official links remain available, and you can skip this step
            until you are ready to store the diagram securely.
          </p>
        )}
        {vault.uploadState && (
          <p className="mt-3 rounded-xl border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-xs text-[#0D1B2A]/66">
            Upload progress: {vault.uploadState.progress}% · {vault.uploadState.label}
          </p>
        )}
        {vault.error && (
          <p className="mt-3 rounded-xl border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-900">
            {vault.error}
          </p>
        )}
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Attached SG diagrams</h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              A file can be saved but still fail the identity or readability check.
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
              const usable = isUsableSubjectDiagram(asset);
              const reading = readingAssetId === asset.id;
              const removing = removingAssetId === asset.id;
              const parentLineageContext = identityStatus === "parent_lineage_match";
              const identity = erfAssetExtractedIdentity(asset);
              const userConfirmed = erfAssetIdentityUserConfirmed(asset);
              const retry =
                !parentLineageContext &&
                (extractionStatus === "failed" ||
                  extractionStatus === "partial" ||
                  extractionStatus === "unsupported" ||
                  extractionStatus === "not_started" ||
                  identityStatus === "unverified");

              return (
                <article
                  key={asset.id}
                  className={cn(
                    "rounded-xl border p-4",
                    usable
                      ? "border-emerald-300/50 bg-emerald-50"
                      : identityStatus === "mismatch"
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
                              : identityStatus === "mismatch"
                                ? "bg-red-700 text-white"
                                : "bg-amber-200 text-amber-950",
                          )}
                        >
                          {reading ? "Reading diagram" : erfAssetExtractionLabel(asset, "diagram")}
                        </span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
                          Identity: {identityStatus}
                        </span>
                      </div>
                      {identityStatus === "mismatch" && (
                        <p className="mt-2 text-xs font-medium leading-5 text-red-900">
                          This document appears to describe a different property. Its contents are
                          not used as evidence for this erf.
                        </p>
                      )}
                      {parentLineageContext && (
                        <p className="mt-2 text-xs font-medium leading-5 text-amber-950">
                          This General Plan is useful context for a parent property, but it is not a
                          readable subject SG diagram for this erf.
                        </p>
                      )}
                      {identityStatus === "unverified" && !userConfirmed ? (
                        <div className="mt-3 rounded-lg border border-amber-300/55 bg-white/75 p-3 text-xs leading-5 text-amber-950">
                          <p className="font-semibold">Read successfully - needs your confirmation</p>
                          <p className="mt-1">Detected identity: Erf {identity?.erfNumber ?? "not stated"}, portion {identity?.portionNumber ?? "not stated"}, {identity?.suburbOrTown ?? identity?.municipality ?? "location not stated"}.</p>
                          <button type="button" disabled={confirmingAssetId === asset.id} onClick={() => void confirmDiagramIdentity(asset)} className="mt-2 inline-flex min-h-9 items-center rounded-full bg-[#0D1B2A] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
                            Yes, this document is for or supports Erf {parcel.erfNumber ?? "this erf"}
                          </button>
                          <p className="mt-1 text-[11px]">Your confirmation is recorded as user-confirmed evidence, not official verification.</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isExtractableErfAsset(asset) &&
                      !usable &&
                      identityStatus !== "mismatch" &&
                      !parentLineageContext ? (
                        <button
                          type="button"
                          disabled={reading}
                          onClick={() => void readDiagram(asset, retry)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:opacity-60"
                        >
                          {reading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {reading ? "Reading" : retry ? "Retry reading" : "Read diagram"}
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
                        onClick={() => void removeDiagram(asset)}
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
          <p className="mt-4 text-sm text-[#0D1B2A]/58">No SG diagram has been uploaded yet.</p>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Check title
        </button>
      </div>
    </div>
  );
}

export default GuidedSgDiagramStep;
