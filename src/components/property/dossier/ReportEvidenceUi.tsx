/**
 * Shared, presentation-only report primitives.
 *
 * These live outside the very large dossier component so their rendered output
 * can be asserted directly in behavioural tests. They contain no evidence
 * logic: every value is decided upstream in the evidence/report layer.
 */
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import type {
  EvidenceBadge,
  OwnershipDetail,
  OwnershipView,
} from "@/lib/reports/buildReportViewModel";

export function EvidenceBadgeChip({ badge, label }: { badge: EvidenceBadge; label?: string }) {
  const tone: Record<EvidenceBadge, string> = {
    official: "bg-[#0D1B2A] text-white",
    uploaded_report: "bg-[#0F766E] text-white",
    user_confirmed: "bg-[#2563EB] text-white",
    listing: "bg-[#FF6A00] text-white",
    ai_interpretation: "bg-[#7C3AED] text-white",
    assumption: "bg-[#F59E0B] text-[#0D1B2A]",
    missing: "bg-[#E2E8F0] text-[#0D1B2A]/70",
  };
  const defaultLabel: Record<EvidenceBadge, string> = {
    official: "Official source",
    uploaded_report: "Uploaded report",
    user_confirmed: "User-confirmed",
    listing: "Listing source",
    ai_interpretation: "AI interpretation",
    assumption: "Assumption",
    missing: "Missing evidence",
  };
  return (
    <span
      className={cn(
        "mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
        tone[badge],
      )}
    >
      {label ?? defaultLabel[badge]}
    </span>
  );
}

export function IdRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | null;
  badge: EvidenceBadge;
}) {
  return (
    <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">
        {value ?? <span className="text-[#0D1B2A]/50 font-normal">Not yet verified</span>}
      </div>
      <EvidenceBadgeChip badge={value ? badge : "missing"} label={value ? undefined : "Missing"} />
    </div>
  );
}

/**
 * Per-file honesty chip: says whether Easy Erf read the document and whether
 * it matched this erf. Non-extractable files are labelled reference-only
 * rather than silently implying they were analysed.
 */
export function AssetExtractionStatusChip({
  asset,
}: {
  asset: { asset_category: string; mime_type: string; metadata?: Record<string, unknown> | null };
}) {
  if (!isExtractableErfAsset(asset)) {
    return (
      <p className="mt-1 text-[11px] font-medium text-[#64748B]">
        Stored for reference — not read by Easy Erf
      </p>
    );
  }
  const identity = erfAssetIdentityMatchStatus(asset);
  const status = erfAssetExtractionStatus(asset);
  const tone =
    identity === "mismatch"
      ? "bg-[#FEE2E2] text-[#991B1B]"
      : identity === "parent_lineage_match"
        ? "bg-[#DBEAFE] text-[#1E40AF]"
        : status === "ready" && identity === "matched"
          ? "bg-[#DCFCE7] text-[#166534]"
          : status === "failed" || identity === "unverified"
            ? "bg-[#FEF3C7] text-[#92400E]"
            : "bg-[#E2E8F0] text-[#334155]";
  return (
    <span
      className={cn(
        "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em]",
        tone,
      )}
    >
      {erfAssetExtractionLabel(asset, asset.asset_category === "sg_diagram" ? "diagram" : "report")}
    </span>
  );
}

/**
 * One supported ownership/deed value. Every rendered value keeps the source
 * ids and page locators it was read from, so nothing appears unattributed.
 */
export function OwnershipDetailRow({ detail }: { detail: OwnershipDetail }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        {detail.label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[#0D1B2A]">{detail.value}</dd>
      <p className="mt-1 text-[10px] leading-4 text-[#94A3B8]">
        Source: {detail.sourceIds.length ? detail.sourceIds.join(", ") : "unattributed"}
        {detail.pageNumbers.length
          ? ` · page ${detail.pageNumbers.join(", ")}`
          : " · page not recorded"}
      </p>
    </div>
  );
}

export function ReportSectionTitleBlock({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
    </div>
  );
}

/**
 * Ownership & Deeds report section. Renders only what the view model marked as
 * supported, always with source and page attribution, and never claims that
 * Easy Erf verified ownership.
 */
export function ReportOwnershipSection({
  ownership,
  onOpenReports,
}: {
  ownership: OwnershipView;
  onOpenReports?: () => void;
}) {
  const hasOwners = ownership.owners.length > 0;
  const hasDeed = ownership.titleDeed.length > 0;
  return (
    <section
      id="report-ownership"
      className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
    >
      <ReportSectionTitleBlock
        eyebrow="Ownership & Deeds"
        title={
          hasOwners || hasDeed
            ? "Read from a matched document — not certified by Easy Erf"
            : "Not verified by Easy Erf"
        }
      />
      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">{ownership.message}</p>
      {ownership.hasUploadedReport && (
        <ul className="mt-3 space-y-1 text-xs text-[#0D1B2A]/70">
          {ownership.uploadedReportNames.map((name) => (
            <li key={name}>· {name} (uploaded)</li>
          ))}
        </ul>
      )}

      {(hasOwners || hasDeed) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {hasOwners && (
            <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                Registered ownership
              </div>
              <dl className="mt-3 space-y-3">
                {ownership.owners.map((detail) => (
                  <OwnershipDetailRow key={`owner-${detail.label}`} detail={detail} />
                ))}
              </dl>
            </div>
          )}
          {hasDeed && (
            <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                Title deed
              </div>
              <dl className="mt-3 space-y-3">
                {ownership.titleDeed.map((detail) => (
                  <OwnershipDetailRow key={`deed-${detail.label}`} detail={detail} />
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-[#64748B]">
        Easy Erf does not certify ownership. Owner identity numbers, registration numbers, phone
        numbers and email addresses are not displayed in the Easy Erf Report.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!hasOwners && <EvidenceBadgeChip badge="missing" label="Owner name" />}
        {!hasDeed && <EvidenceBadgeChip badge="missing" label="Deed number" />}
        <EvidenceBadgeChip badge="missing" label="Bond info" />
        <EvidenceBadgeChip badge="missing" label="Transfer history" />
      </div>
      {onOpenReports && (
        <button
          type="button"
          onClick={onOpenReports}
          className="report-no-print mt-4 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
        >
          Open Reports tab <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}
