import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileText,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { GOVZA_DEEDS_GUIDANCE_URL } from "@/lib/external-urls";
import {
  dispatchErfFileVaultUpdated,
  useErfFileVault,
} from "@/lib/workbench/useErfFileVault";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractedClaims,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import { cn } from "@/lib/utils";

interface GuidedTitleStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
  onOpenPaidReports: () => void;
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

function isUsableSubjectTitle(asset: ErfAsset) {
  return (
    asset.asset_category === "title_deed" &&
    erfAssetHasSearchableExtraction(asset) &&
    erfAssetIdentityMatchStatus(asset) === "matched"
  );
}

export function GuidedTitleStep({
  parcel,
  onContinue,
  onOpenPaidReports,
}: GuidedTitleStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["title_deed"]);
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  const usableTitles = vault.assets.filter(isUsableSubjectTitle);
  const canContinue = usableTitles.length > 0;
  const extractedClaims = useMemo(
    () =>
      usableTitles
        .flatMap((asset) =>
          erfAssetExtractedClaims(asset).map((claim) => ({
            ...claim,
            assetId: asset.id,
            fileName: asset.original_file_name,
          })),
        )
        .filter(
          (claim) =>
            claim.scope === "subject" &&
            (claim.domain === "deeds" || claim.domain === "ownership"),
        )
        .slice(0, 12),
    [usableTitles],
  );

  async function readTitle(asset: ErfAsset, retry = false) {
    if (!isExtractableErfAsset(asset)) {
      toast.error("This file type cannot be read. Upload a PDF, PNG, JPG, JPEG, TIF, or TIFF file.");
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
        toast.error("This title document appears to describe a different property and was rejected.");
        return;
      }
      if (result.claimCount === 0) {
        toast.warning("The file was saved, but Easy Erf could not read usable title details yet.");
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning("The document was read, but its property identity still needs confirmation.");
        return;
      }

      toast.success("Title document read and matched. Review the extracted deed evidence below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The title document could not be read.");
    } finally {
      setReadingAssetId(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to upload and securely store title documents.");
      return;
    }

    const uploadedAssets: ErfAsset[] = [];
    for (const file of selectedFiles) {
      try {
        const result = await vault.upload({
          file,
          fileName: file.name,
          category: "title_deed",
          assetType: "title_deed",
          sourceLabel: "User uploaded title deed or ownership document",
          metadata: { source: "guided-title-step" },
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
        ? "Title document uploaded. Easy Erf is reading it now."
        : `${uploadedAssets.length} title documents uploaded. Easy Erf is reading them now.`,
    );
    for (const asset of uploadedAssets) {
      await readTitle(asset);
    }
  }

  async function removeTitle(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      toast.success("Title document removed from this erf file.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The title document could not be removed.");
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
              Deed and ownership evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Check the title document for restrictions and rights
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Upload the title deed or a title document for this erf. Easy Erf reads document-backed
              ownership and deed claims, including title conditions, servitudes, easements, rights of
              way, endorsements and restrictions when they are stated in the file.
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
              ? "Matched title evidence ready"
              : vault.assets.length
                ? "Document needs attention"
                : "No title document attached"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <FileSearch className="h-4 w-4 text-[#FF6A00]" />
              Get or understand the title record
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Use official deeds guidance to understand the registry process. Easy Erf does not claim
              that free public guidance verifies ownership or replaces a conveyancer.
            </p>
            <a
              href={GOVZA_DEEDS_GUIDANCE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
            >
              Open official deeds guidance
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="rounded-xl border border-[#FF6A00]/18 bg-[#fff8ec] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <ShieldAlert className="h-4 w-4 text-[#FF6A00]" />
              Need a paid property report?
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Lightstone or WinDeed can add ownership, transfer and deeds-level context. A provider
              report is a confidence upgrade, but it does not automatically replace the actual title deed.
            </p>
            <button
              type="button"
              onClick={onOpenPaidReports}
              className="mt-3 inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
            >
              Open paid reports
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!vault.signedIn}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload title document
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

        {!vault.signedIn && (
          <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Sign in before uploading. You can still open the official guidance or skip this step for now.
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
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Attached title documents</h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              Only readable documents matched to this erf can complete the step.
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
              const usable = isUsableSubjectTitle(asset);
              const reading = readingAssetId === asset.id;
              const removing = removingAssetId === asset.id;
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
                          {reading ? "Reading document" : erfAssetExtractionLabel(asset)}
                        </span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
                          Identity: {identityStatus ?? "not checked"}
                        </span>
                      </div>
                      {erfAssetIdentityMatchReason(asset) && (
                        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                          {erfAssetIdentityMatchReason(asset)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isExtractableErfAsset(asset) && !usable && identityStatus !== "mismatch" && (
                        <button
                          type="button"
                          disabled={reading}
                          onClick={() => void readTitle(asset, retry)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:opacity-60"
                        >
                          {reading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {reading ? "Reading" : retry ? "Retry reading" : "Read document"}
                        </button>
                      )}
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
                        onClick={() => void removeTitle(asset)}
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
          <p className="mt-4 text-sm text-[#0D1B2A]/58">No title document has been uploaded yet.</p>
        )}
      </section>

      {canContinue && (
        <section className="rounded-[1.25rem] border border-emerald-300/45 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-950">Extracted title evidence</h4>
              <p className="mt-1 text-xs leading-5 text-emerald-950/70">
                These values were read from the uploaded document. Check the page and original file
                before relying on them. This is research support, not a legal opinion.
              </p>
            </div>
          </div>
          {extractedClaims.length ? (
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              {extractedClaims.map((claim, index) => (
                <div
                  key={`${claim.assetId}-${claim.domain}-${claim.key}-${claim.page ?? "na"}-${index}`}
                  className="rounded-xl border border-emerald-300/35 bg-white p-3"
                >
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                    {claim.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-[#0D1B2A]">{claim.value}</dd>
                  <p className="mt-1 text-[11px] leading-4 text-[#0D1B2A]/58">
                    {claim.fileName}
                    {claim.page ? ` · Page ${claim.page}` : ""} · {claim.confidence} confidence
                  </p>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-emerald-950/70">
              The title document matched this erf, but no ownership or deed-condition claims were extracted.
              Review the original file directly.
            </p>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Confirm zoning
        </button>
      </div>
    </div>
  );
}

export default GuidedTitleStep;
