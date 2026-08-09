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
import { dispatchErfFileVaultUpdated, useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { buildErfAssetExpectedIdentityContext, type ErfAsset, type ErfAssetCategory } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractedClaims,
  erfAssetExtractedIdentity,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  erfAssetIdentityUserConfirmed,
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

function evidenceLabel(asset: ErfAsset) {
  return asset.asset_category === "paid_report" ? "Paid property report" : "Actual title deed";
}

function isUsableTitleEvidence(asset: ErfAsset) {
  return (
    (asset.asset_category === "title_deed" || asset.asset_category === "paid_report") &&
    erfAssetHasSearchableExtraction(asset) &&
    erfAssetIdentityMatchStatus(asset) === "matched"
  );
}

export function GuidedTitleStep({ parcel, onContinue, onOpenPaidReports }: GuidedTitleStepProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const reportInputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcel.id, ["title_deed", "paid_report"]);
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [confirmingAssetId, setConfirmingAssetId] = useState<string | null>(null);

  const usableEvidence = vault.assets.filter(isUsableTitleEvidence);
  const usableTitleDeeds = usableEvidence.filter((asset) => asset.asset_category === "title_deed");
  const usablePaidReports = usableEvidence.filter((asset) => asset.asset_category === "paid_report");
  const hasTitleDeed = usableTitleDeeds.length > 0;
  const hasPaidReport = usablePaidReports.length > 0;
  const canContinue = hasTitleDeed || hasPaidReport;

  const extractedClaims = useMemo(
    () =>
      usableEvidence
        .flatMap((asset) =>
          erfAssetExtractedClaims(asset).map((claim) => ({
            ...claim,
            assetId: asset.id,
            fileName: asset.original_file_name,
            evidenceType: evidenceLabel(asset),
          })),
        )
        .filter(
          (claim) =>
            claim.scope === "subject" &&
            (claim.domain === "deeds" ||
              claim.domain === "ownership" ||
              claim.domain === "transfers"),
        )
        .slice(0, 16),
    [usableEvidence],
  );

  async function readEvidence(asset: ErfAsset, retry = false) {
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
        toast.error("This document describes a different property and was rejected.");
        return;
      }
      if (result.claimCount === 0) {
        toast.warning("The file was saved, but Easy Erf could not read usable deeds evidence yet.");
        return;
      }
      if (result.identityMatchStatus !== "matched") {
        toast.warning("The document was read, but its property identity still needs confirmation.");
        return;
      }

      toast.success(`${evidenceLabel(asset)} read and matched to this erf.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The document could not be read.");
    } finally {
      setReadingAssetId(null);
    }
  }

  async function uploadFiles(files: FileList | null, category: ErfAssetCategory) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to upload and securely store property documents.");
      return;
    }

    const uploadedAssets: ErfAsset[] = [];
    for (const file of selectedFiles) {
      if (category === "paid_report" && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
        toast.error(`${file.name} must be a PDF paid report.`);
        continue;
      }
      try {
        const result = await vault.upload({
          file,
          fileName: file.name,
          category,
          assetType: category === "paid_report" ? "paid_property_report" : "title_deed",
          sourceLabel:
            category === "paid_report"
              ? "User uploaded Lightstone or WinDeed property report"
              : "User uploaded actual title deed or deeds-office document",
          metadata: {
            source: "guided-title-step",
            evidenceType: category,
            expectedIdentityContext: buildErfAssetExpectedIdentityContext(parcel),
          },
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
        ? `${evidenceLabel(uploadedAssets[0])} uploaded. Easy Erf is reading it now.`
        : `${uploadedAssets.length} documents uploaded. Easy Erf is reading them now.`,
    );
    for (const asset of uploadedAssets) await readEvidence(asset);
  }

  async function removeEvidence(asset: ErfAsset) {
    setRemovingAssetId(asset.id);
    try {
      await vault.remove(asset);
      toast.success(`${evidenceLabel(asset)} removed from this erf file.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The document could not be removed.");
    } finally {
      setRemovingAssetId(null);
    }
  }

  async function confirmEvidenceIdentity(asset: ErfAsset) {
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

  const statusText = hasTitleDeed
    ? "Matched title deed ready"
    : hasPaidReport
      ? "Matched paid report ready"
      : vault.assets.length
        ? "Document needs attention"
        : "No title evidence attached";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Ownership and deeds evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Buy the property report, then upload the PDF here
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              The fastest practical route is usually a Lightstone or WinDeed report. Easy Erf can
              use a matched report to continue, while an actual title deed remains the stronger
              source for deed conditions, servitudes and restrictions.
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
            {statusText}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-4">
        <h4 className="text-base font-semibold text-[#0D1B2A]">One of the most important upgrades to your Easy Erf investigation</h4>
        <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/68">Free public data helps Easy Erf identify the land. A paid property report adds deeds, transaction and market context that can materially change a buying or development decision.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="https://www.lightstoneproperty.co.za/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white">Buy from Lightstone <ExternalLink className="h-3.5 w-3.5" /></a>
          <a href="https://www.windeed.co.za/wpr/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]">Buy from WinDeed <ExternalLink className="h-3.5 w-3.5" /></a>
          <button type="button" onClick={onOpenPaidReports} className="inline-flex min-h-10 items-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white">Already have one? Upload your PDF</button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">Payment happens on the provider's website. Easy Erf does not process it or claim a referral relationship.</p>
        <h5 className="mt-4 text-sm font-semibold text-[#0D1B2A]">How to get the information</h5>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            {
              title: "Open Paid Reports",
              body: "Go directly to the Reports workspace for this selected erf.",
            },
            {
              title: "Buy the correct report",
              body: "Choose Lightstone or WinDeed and verify the erf, portion and location before paying.",
            },
            {
              title: "Download and upload",
              body: "Download the provider PDF, return to this page and upload it below.",
            },
          ].map((step, index) => (
            <li key={step.title} className="rounded-xl border border-[#0D1B2A]/8 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]/12 text-[11px] font-bold text-[#FF6A00]">
                  {index + 1}
                </span>
                {step.title}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{step.body}</p>
              {index === 0 ? (
                <button
                  type="button"
                  onClick={onOpenPaidReports}
                  className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
                >
                  Open Paid Reports
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/68">
          A paid property report can provide ownership, transfer and deeds-level context, but it may
          not be the certified title deed. A conveyancer or the Deeds Office may still be needed for
          the actual deed and legal interpretation.
        </p>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <ShieldAlert className="h-4 w-4 text-[#FF6A00]" />
              Upload the paid report PDF
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              A report uploaded in the Paid Reports workspace will appear here automatically because
              both screens use the same private Erf File Vault.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenPaidReports}
                className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
              >
                Open Paid Reports
              </button>
              <button
                type="button"
                disabled={!vault.signedIn}
                onClick={() => reportInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:opacity-55"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload paid report PDF
              </button>
            </div>
            <input
              ref={reportInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => {
                void uploadFiles(event.currentTarget.files, "paid_report");
                event.currentTarget.value = "";
              }}
            />
          </div>

          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <FileSearch className="h-4 w-4 text-[#FF6A00]" />
              Add the actual title deed
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Upload the certified deed or deeds-office document when available. This is the
              recommended confidence upgrade when you currently have only a provider report.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!vault.signedIn}
                onClick={() => titleInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-55"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload actual title deed
              </button>
              <a
                href={GOVZA_DEEDS_GUIDANCE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
              >
                Official deeds guidance
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <input
              ref={titleInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff"
              className="hidden"
              onChange={(event) => {
                void uploadFiles(event.currentTarget.files, "title_deed");
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        {!vault.signedIn ? (
          <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Sign in before uploading. You can still open Paid Reports or official deeds guidance.
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

      {hasPaidReport && !hasTitleDeed ? (
        <section className="rounded-[1.25rem] border border-amber-300/45 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
            <div>
              <h4 className="text-sm font-semibold text-amber-950">Paid report accepted</h4>
              <p className="mt-1 text-xs leading-5 text-amber-950/75">
                You can continue. Upload the actual title deed later to strengthen restrictions,
                servitudes and deed-condition evidence.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0D1B2A]">
              Attached title and report evidence
            </h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              Only readable files matched to this erf can complete the step.
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
              const usable = isUsableTitleEvidence(asset);
              const reading = readingAssetId === asset.id;
              const removing = removingAssetId === asset.id;
              const extractedIdentity = erfAssetExtractedIdentity(asset);
              const userConfirmed = erfAssetIdentityUserConfirmed(asset);
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
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                        {evidenceLabel(asset)}
                      </div>
                      <div className="mt-1 break-words text-sm font-semibold text-[#0D1B2A]">
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
                          {reading ? "Reading document" : usable ? "Matched and readable" : erfAssetExtractionLabel(asset)}
                        </span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
                          Identity: {identityStatus ?? "not checked"}
                        </span>
                      </div>
                      {erfAssetIdentityMatchReason(asset) ? (
                        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                          {erfAssetIdentityMatchReason(asset)}
                        </p>
                      ) : null}
                      {identityStatus === "unverified" && !userConfirmed ? (
                        <div className="mt-3 rounded-lg border border-amber-300/55 bg-white/75 p-3 text-xs leading-5 text-amber-950">
                          <p className="font-semibold">Read successfully - needs your confirmation</p>
                          <p className="mt-1">Detected identity: Erf {extractedIdentity?.erfNumber ?? "not stated"}, portion {extractedIdentity?.portionNumber ?? "not stated"}, {extractedIdentity?.streetAddress ?? extractedIdentity?.suburbOrTown ?? extractedIdentity?.municipality ?? "location not stated"}.</p>
                          <button type="button" disabled={confirmingAssetId === asset.id} onClick={() => void confirmEvidenceIdentity(asset)} className="mt-2 inline-flex min-h-9 items-center rounded-full bg-[#0D1B2A] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
                            Yes, this document is for or supports Erf {parcel.erfNumber ?? "this erf"}
                          </button>
                          <p className="mt-1 text-[11px]">Recorded as user-confirmed evidence, not official verification.</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isExtractableErfAsset(asset) && !usable && identityStatus !== "mismatch" ? (
                        <button
                          type="button"
                          disabled={reading}
                          onClick={() => void readEvidence(asset, retry)}
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
                        onClick={() => void removeEvidence(asset)}
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
          <p className="mt-4 text-sm text-[#0D1B2A]/58">No title or paid-report PDF is attached yet.</p>
        )}
      </section>

      {canContinue ? (
        <section className="rounded-[1.25rem] border border-emerald-300/45 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-950">Extracted deeds evidence</h4>
              <p className="mt-1 text-xs leading-5 text-emerald-950/70">
                Review each value against the original PDF. This is research support, not a legal opinion.
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
                    {claim.evidenceType} · {claim.fileName}
                    {claim.page ? ` · Page ${claim.page}` : ""} · {claim.confidence} confidence
                  </p>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Confirm zoning
        </button>
      </div>
    </div>
  );
}

export default GuidedTitleStep;
