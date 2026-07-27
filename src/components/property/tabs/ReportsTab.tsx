import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  BookmarkPlus,
  Check,
  ExternalLink,
  FileText,
  Lock,
  Loader2,
  ScanText,
  Trash2,
  Upload,
} from "lucide-react";
import { REPORT_CATALOG, formatPrice } from "@/lib/reports/catalog";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl } from "@/lib/external";
import type { SgDocumentResult } from "@/lib/research/sgDocument";
import { CSG_OFFICIAL_URL } from "@/lib/external-urls";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  extractErfAsset,
} from "@/lib/workbench/erfAssetExtraction";
import { toast } from "sonner";

type InterestKind = "notify" | "save";
type PaidReportProvider = "lightstone" | "windeed";

export function ReportsTab({
  parcelId,
  summary,
  sgDoc,
}: {
  parcelId: string;
  summary: string;
  sgDoc?: SgDocumentResult;
}) {
  const { user } = useAuth();
  const reportVault = useErfFileVault(parcelId, ["paid_report"]);
  const [interests, setInterests] = useState<Record<string, InterestKind>>({});
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<PaidReportProvider, string>>>({});
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);
  const reportCatalog = REPORT_CATALOG.filter((report) => report.id !== "sg_diagram");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`pa.reportInterests.${parcelId}`);
      if (raw) setInterests(JSON.parse(raw));
    } catch {
      // Ignore malformed local-only report interest cache.
    }
  }, [parcelId]);

  function persist(next: Record<string, InterestKind>) {
    setInterests(next);
    try {
      window.localStorage.setItem(`pa.reportInterests.${parcelId}`, JSON.stringify(next));
    } catch {
      // Ignore local storage write failures; Supabase persistence still runs for signed-in users.
    }
  }

  async function record(reportId: string, kind: InterestKind) {
    const next = { ...interests, [reportId]: kind };
    persist(next);
    if (user) {
      try {
        await supabase.from("report_orders").insert({
          user_id: user.id,
          parcel_id: parcelId,
          report_type: reportId,
          status: kind === "notify" ? "interest_notify" : "interest_saved",
          price_cents: 0,
          provider: "placeholder",
          payload: { placeholder: true, kind, summary, createdAt: new Date().toISOString() },
        });
      } catch {
        // Keep report interest UX non-blocking while provider/order capture is placeholder-only.
      }
    }
    toast.success(
      kind === "notify" ? "We'll notify you when this is live." : "Saved to your report interests.",
    );
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
  async function readDocument(asset: ErfAsset) {
    setReadingAssetId(asset.id);
    try {
      const outcome = await extractErfAsset(asset.id);
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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/25 px-3 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight">Report document uploads</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add Lightstone and WinDeed PDFs when you have them. SG diagram evidence lives in the
          Sources verification center. No payment is taken here.
        </p>
      </div>

      <div className="grid gap-3">
        {reportCatalog.map((r) => {
          const interest = interests[r.id];
          return (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{r.name}</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {r.providerHint} - {r.estTurnaround}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                    {formatPrice(r.priceCents)}
                  </div>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Lock className="h-2.5 w-2.5" /> Coming Soon
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">
                <button
                  type="button"
                  onClick={() => record(r.id, "notify")}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                >
                  <BellRing className="h-3 w-3" /> Notify me
                </button>
                <button
                  type="button"
                  onClick={() => record(r.id, "save")}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                >
                  <BookmarkPlus className="h-3 w-3" /> Save report interest
                </button>
                {interest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-2.5 w-2.5" />{" "}
                    {interest === "notify" ? "Notify requested" : "Saved"}
                  </span>
                )}
              </div>
              {reportProviderForCatalogId(r.id) && (
                <PaidReportUploadArea
                  provider={reportProviderForCatalogId(r.id)!}
                  attachment={
                    paidReportForProvider(reportVault.assets, reportProviderForCatalogId(r.id)!) ??
                    null
                  }
                  error={
                    uploadErrors[reportProviderForCatalogId(r.id)!] ??
                    (reportVault.signedIn ? undefined : "Sign in to save PDFs to the cloud vault.")
                  }
                  uploading={Boolean(reportVault.uploadState)}
                  onUpload={uploadPaidReport}
                  onRemove={removePaidReport}
                  reading={
                    readingAssetId ===
                    (paidReportForProvider(reportVault.assets, reportProviderForCatalogId(r.id)!)?.id ??
                      null)
                  }
                  onRead={(asset) => void readDocument(asset)}

                />
              )}
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
        Placeholder only. No payment will be processed. Lightstone and WinDeed integrations will
        activate once their commercial connections are live.
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
}: {
  provider: PaidReportProvider;
  attachment: ErfAsset | null;
  error?: string;
  uploading?: boolean;
  onUpload: (provider: PaidReportProvider, file: File | null | undefined) => void;
  onRemove: (provider: PaidReportProvider) => void;
  reading?: boolean;
  onRead: (asset: ErfAsset) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = providerLabel(provider);
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[#FF6A00]/25 bg-[#fff8ec] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            {label} report upload
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#0D1B2A]/70">
            Buy or download the {label} report, then upload the PDF here. Easy Erf stores it in this
            erf file for reference. In a later Easy Erf AI step, uploaded reports can help produce a
            more complete final report.
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
              {reading ? "Reading document…" : erfAssetExtractionLabel(attachment)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={reading}
            onClick={() => onRead(attachment)}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-emerald-700/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-60"
          >
            {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
            {reading
              ? "Reading"
              : erfAssetExtractionStatus(attachment) === "ready"
                ? "Read again"
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
