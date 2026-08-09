import { useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  ScanText,
  Trash2,
  Upload,
} from "lucide-react";
import { REPORT_CATALOG } from "@/lib/reports/catalog";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl } from "@/lib/external";
import type { SgDocumentResult } from "@/lib/research/sgDocument";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { CSG_OFFICIAL_URL } from "@/lib/external-urls";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { buildErfAssetExpectedIdentityContext, type ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  extractErfAsset,
} from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractedIdentity,
  erfAssetIdentityUserConfirmed,
} from "@/lib/evidence/extractionMetadata";
import { toast } from "sonner";

type PaidReportProvider = "lightstone" | "windeed";

const PAID_REPORT_PURCHASE_URLS: Record<PaidReportProvider, string> = {
  lightstone: "https://www.lightstoneproperty.co.za/",
  windeed: "https://www.windeed.co.za/wpr/",
};

export function ReportsTab({
  parcelId,
  summary,
  sgDoc,
  parcel,
}: {
  parcelId: string;
  summary: string;
  sgDoc?: SgDocumentResult;
  parcel?: NormalizedOfficialParcel;
}) {
  const { user } = useAuth();
  const reportVault = useErfFileVault(parcelId, ["paid_report"]);
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<PaidReportProvider, string>>>({});
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const [confirmingAssetId, setConfirmingAssetId] = useState<string | null>(null);
  const reportCatalog = REPORT_CATALOG.filter((report) => report.id !== "sg_diagram");

  async function recordOutboundPurchase(provider: PaidReportProvider, reportId: string) {
    if (user) {
      try {
        await supabase.from("report_orders").insert({
          user_id: user.id,
          parcel_id: parcelId,
          report_type: reportId,
          status: "outbound_purchase_click",
          status_enum: "pending",
          price_cents: 0,
          provider,
          provider_id: provider,
          payload: {
            outboundPurchaseUrl: PAID_REPORT_PURCHASE_URLS[provider],
            summary,
            createdAt: new Date().toISOString(),
          },
        });
      } catch {
        // Outbound measurement must never block access to the independent provider.
      }
    }
  }

  async function uploadPaidReport(provider: PaidReportProvider, file: File | null | undefined) {
    if (!file) return;
    if (!isPdfFile(file)) {
      const message = "Upload a PDF report file.";
      setUploadErrors((current) => ({ ...current, [provider]: message }));
      toast.error(message);
      return;
    }
    const existing = paidReportForProvider(reportVault.assets, provider);
    if (existing) await reportVault.remove(existing);
    const result = await reportVault.upload({
      file,
      fileName: file.name,
      category: "paid_report",
      assetType: `${provider}_report`,
      sourceLabel:
        provider === "lightstone"
          ? "User uploaded Lightstone report"
          : "User uploaded WinDeed report",
      status: "uploaded_reference_only",
      metadata: {
        provider,
        reportType: provider,
        uploadedFor: "paid_reports_tab",
        ...(parcel
          ? { expectedIdentityContext: buildErfAssetExpectedIdentityContext(parcel) }
          : {}),
      },
    }).catch((error: Error) => {
      setUploadErrors((current) => ({ ...current, [provider]: error.message }));
      return null;
    });
    if (!result) return;
    if (!result.ok) {
      const message =
        result.reason === "too_large"
          ? "PDF is too large for the Erf File Vault."
          : result.reason === "empty_file"
            ? "That PDF is empty."
          : "Upload a PDF report file.";
      setUploadErrors((current) => ({ ...current, [provider]: message }));
      toast.error(message);
      return;
    }
    setUploadErrors((current) => ({ ...current, [provider]: undefined }));
    toast.success(`${providerLabel(provider)} PDF uploaded. Reading it now.`);
    await readDocument(result.asset);
  }

  /**
   * Sends one uploaded report to the server-side reader so its contents become
   * quotable, searchable evidence instead of an opaque stored file.
   */
  async function readDocument(asset: ErfAsset, retry = false) {
    setReadingAssetId(asset.id);
    try {
      const outcome = await extractErfAsset(asset.id, { expectedParcelId: parcelId, retry });
      if (outcome.success) {
        if (outcome.claimCount > 0) {
          toast.success(`Read ${outcome.claimCount} values from ${asset.original_file_name}.`);
        } else {
          toast.warning(`No structured values were found in ${asset.original_file_name}.`);
        }
      } else {
        toast.error(outcome.error);
      }
    } finally {
      setReadingAssetId(null);
      await reportVault.refresh();
    }
  }

  async function removePaidReport(provider: PaidReportProvider) {
    const current = paidReportForProvider(reportVault.assets, provider);
    if (!current) return;
    await reportVault.remove(current);
    toast.success(`${providerLabel(provider)} PDF removed.`);
  }

  async function confirmPaidReportIdentity(asset: ErfAsset) {
    setConfirmingAssetId(asset.id);
    try {
      await reportVault.confirmIdentity(asset);
      toast.success("Report attached as user-confirmed evidence. This is not official verification.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be confirmed.");
    } finally {
      setConfirmingAssetId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">High-value evidence upgrade</div>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[#0D1B2A]">One of the most important upgrades to your Easy Erf investigation</h3>
        <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/68">Free public data helps Easy Erf identify the land. A paid property report adds deeds, transaction and market context that can materially change a buying or development decision, including registered extent, title deed information, transfer history, municipal valuation, ownership context and comparable sales.</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[#0D1B2A]">For a serious property decision, Easy Erf strongly recommends adding one before relying on your final report or strategy.</p>
      </div>

      <div className="grid gap-3">
        {reportCatalog.map((r) => {
          const provider = reportProviderForCatalogId(r.id);
          if (!provider) return null;
          return (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{r.name}</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {paidReportPurchaseDescription(provider)}
                    </p>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {r.providerHint} - purchase and download on the provider website
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-800">Buy from provider</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">
                <a href={PAID_REPORT_PURCHASE_URLS[provider]} target="_blank" rel="noopener noreferrer" onClick={() => void recordOutboundPurchase(provider, r.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white">
                  Buy a Property Report <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="inline-flex items-center text-xs text-muted-foreground">Payment happens on the provider's website. Easy Erf does not process it.</span>
              </div>
              {provider && (
                <PaidReportUploadArea
                  provider={provider}
                  attachment={
                    paidReportForProvider(reportVault.assets, provider) ??
                    null
                  }
                  error={
                    uploadErrors[provider] ??
                    (reportVault.signedIn ? undefined : "Sign in to save PDFs to the cloud vault.")
                  }
                  uploading={Boolean(reportVault.uploadState)}
                  onUpload={uploadPaidReport}
                  onRemove={removePaidReport}
                  reading={
                    readingAssetId ===
                    (paidReportForProvider(reportVault.assets, provider)?.id ??
                      null)
                  }
                  onRead={(asset, retry) => void readDocument(asset, retry)}
                  confirming={
                    confirmingAssetId ===
                    (paidReportForProvider(reportVault.assets, provider)?.id ?? null)
                  }
                  onConfirmIdentity={(asset) => void confirmPaidReportIdentity(asset)}

                />
              )}
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
        Easy Erf reads an uploaded report, cross-checks it against the official erf and brings usable evidence into the investigation. A property report strengthens due diligence but does not replace a certified title deed, municipal zoning confirmation or professional advice.
        {!sgDoc?.shown && (
          <button
            type="button"
            onClick={(e) => openExternalUrl(CSG_OFFICIAL_URL, e)}
            className="ml-2 inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
          >
            Open CSG official fallback <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      <ComplianceNotice />
      <SourceBadge source="lightstone" />
    </div>
  );
}

function reportProviderForCatalogId(reportId: string): PaidReportProvider | null {
  if (reportId === "lightstone_property") return "lightstone";
  if (reportId === "windeed_property") return "windeed";
  return null;
}

function providerLabel(provider: PaidReportProvider) {
  return provider === "lightstone" ? "Lightstone" : "WinDeed";
}

function paidReportPurchaseDescription(provider: PaidReportProvider) {
  return provider === "lightstone"
    ? "Purchase a once-off property report for valuation, comparable-sales and property context."
    : "Purchase a property report for deeds-office, ownership, bond and transfer context.";
}

function paidReportForProvider(assets: ErfAsset[], provider: PaidReportProvider) {
  return assets.find(
    (asset) =>
      asset.asset_category === "paid_report" &&
      (asset.metadata?.provider === provider || asset.asset_type === `${provider}_report`),
  );
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function PaidReportUploadArea({
  provider,
  attachment,
  error,
  uploading,
  onUpload,
  onRemove,
  reading,
  onRead,
  confirming,
  onConfirmIdentity,
}: {
  provider: PaidReportProvider;
  attachment: ErfAsset | null;
  error?: string;
  uploading?: boolean;
  onUpload: (provider: PaidReportProvider, file: File | null | undefined) => void;
  onRemove: (provider: PaidReportProvider) => void;
  reading?: boolean;
  onRead: (asset: ErfAsset, retry?: boolean) => void;
  confirming?: boolean;
  onConfirmIdentity: (asset: ErfAsset) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = providerLabel(provider);
  const extractedIdentity = attachment ? erfAssetExtractedIdentity(attachment) : null;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[#FF6A00]/25 bg-[#fff8ec] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            {label} report upload
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#0D1B2A]/70">
            Buy or download the {label} report, then upload the PDF here. Easy Erf stores it in this
            erf file, reads supported evidence, checks the detected identity and keeps the original
            available for review. You remain responsible for confirming the provider report is for
            this property.
          </p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading" : attachment ? "Replace PDF" : "Upload PDF"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          void onUpload(provider, event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {attachment ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">{attachment.original_file_name}</div>
            <div className="mt-0.5 text-emerald-900/70">
              {formatFileSize(attachment.size_bytes)} - uploaded{" "}
              {formatUploadedAt(attachment.created_at)}
            </div>
            <div className="mt-0.5 text-emerald-900/70">
              {reading ? "Extracting report..." : erfAssetExtractionLabel(attachment)}
            </div>
            {!reading && erfAssetIdentityMatchStatus(attachment) === "mismatch" && (
              <div className="mt-0.5 font-medium text-[#9A3A1A]">
                {erfAssetIdentityMatchReason(attachment) ??
                  "Document identity does not match the selected parcel."}{" "}
                Replace it with the correct report for this erf.
              </div>
            )}
            {!reading && erfAssetIdentityMatchStatus(attachment) === "unverified" && !erfAssetIdentityUserConfirmed(attachment) && (
              <div className="mt-2 rounded-lg border border-amber-300/55 bg-white/80 p-2 text-amber-950">
                <div className="font-semibold">Read successfully - needs your confirmation</div>
                <div className="mt-1">Detected: Erf {extractedIdentity?.erfNumber ?? "not stated"}, portion {extractedIdentity?.portionNumber ?? "not stated"}, {extractedIdentity?.streetAddress ?? extractedIdentity?.suburbOrTown ?? extractedIdentity?.municipality ?? "location not stated"}.</div>
                <button type="button" disabled={confirming} onClick={() => onConfirmIdentity(attachment)} className="mt-2 inline-flex min-h-8 items-center rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-semibold text-white disabled:opacity-60">Yes, this report is for this erf</button>
                <div className="mt-1 text-[10px]">This records user confirmation, not official verification.</div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={reading}
            onClick={() =>
              onRead(
                attachment,
                erfAssetExtractionStatus(attachment) === "failed" ||
                  erfAssetExtractionStatus(attachment) === "partial" ||
                  erfAssetIdentityMatchStatus(attachment) === "unverified",
              )
            }
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-emerald-700/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-60"
          >
            {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
            {reading
              ? "Extracting"
              : erfAssetIdentityMatchStatus(attachment) === "mismatch"
                ? "Wrong property report"
                : erfAssetExtractionStatus(attachment) === "failed"
                  ? "Retry extraction"
                  : erfAssetExtractionStatus(attachment) === "ready"
                    ? "Report searchable"
                    : "Read document"}
          </button>
          <button
            type="button"
            onClick={() => void onRemove(provider)}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-emerald-700/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-[#0D1B2A]/58">
          No {label} PDF uploaded yet. Uploads are stored in the cloud Erf File Vault for this erf.
        </p>
      )}
      {error && <p className="mt-2 text-[11px] font-medium text-[#9A3A1A]">{error}</p>}
    </div>
  );
}
