import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  DONE_FOR_YOU_INVESTIGATION_NAME,
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
  buildHumanReviewHref,
} from "@/lib/humanReview/scope";
import { useState } from "react";

const HUMAN_REVIEW_BENEFITS = [
  "Easy Erf completes or reviews the standard property investigation for you",
  "Parcel, address, SG/cadastral, ownership/title indicators and planning evidence are worked through",
  "Property checks, useful market evidence and relevant deterministic calculations are reviewed",
  "One third-party property data report is reviewed during Early Access where available",
  "You receive a Human-Reviewed Easy Erf Report with facts, risks, unknowns and next checks",
] as const;

interface TakeoverCardContentProps {
  hasConfirmedParcel: boolean;
  href: string;
  onPrepare?: () => Promise<void>;
}

function TakeoverCardContent({ hasConfirmedParcel, href, onPrepare }: TakeoverCardContentProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            <ShieldCheck className="h-3.5 w-3.5" /> {DONE_FOR_YOU_INVESTIGATION_NAME}
          </div>
          {hasConfirmedParcel ? (
            <span className="rounded-full border border-[#FF6A00]/20 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#92400E]">
              R999 once-off · no subscription
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0D1B2A] sm:text-2xl">
          {hasConfirmedParcel
            ? "Want Easy Erf to investigate this property for you?"
            : "Choose the exact property before we investigate it for you."}
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
          {hasConfirmedParcel
            ? "You keep this exact property file. Easy Erf and a human reviewer work through the standard investigation on your behalf, reuse anything already completed, fill the evidence gaps we can, and deliver the final reviewed report."
            : "Search by address or Erf, review the result on the map, and open the correct official parcel first. Erf numbers can repeat in different places."}
        </p>

        {hasConfirmedParcel ? (
          <div className="mt-4 rounded-[1.1rem] border border-[#0D1B2A]/8 bg-white/75 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              What you get
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {HUMAN_REVIEW_BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-2 text-xs leading-5 text-[#0D1B2A]/75"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B24A00]" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[#64748B]">
              {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-stretch gap-2 lg:min-w-[17rem] lg:items-end">
        {hasConfirmedParcel ? (
          <div className="text-left text-[11px] leading-5 text-[#64748B] lg:max-w-[17rem] lg:text-right">
            You choose the property. We do the investigation.
          </div>
        ) : null}
        <a
          href={href}
          aria-disabled={saving}
          onClick={onPrepare ? (event) => {
            event.preventDefault();
            if (saving) return;
            setSaving(true); setError(null);
            void onPrepare().then(() => window.location.assign(href)).catch((failure: unknown) => {
              setError(failure instanceof Error ? failure.message : "Your investigation was not saved. Please reload before continuing.");
              setSaving(false);
            });
          } : undefined}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#ff7d1f]"
        >
          {saving ? "Saving your investigation..." : hasConfirmedParcel ? "Investigate it for me · R999" : "Find property on map"}
          <ArrowRight className="h-4 w-4" />
        </a>
        {error && <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p>}
        {hasConfirmedParcel ? (
          <div className="text-left text-[10px] leading-4 text-[#64748B] lg:max-w-[17rem] lg:text-right">
            Property research and due-diligence support, not professional advice or municipal approval.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HumanReviewTakeoverCard({
  parcelId,
  propertyReference,
  source = "investigation",
  compact = false,
  onPrepare,
}: {
  parcelId?: string | null;
  propertyReference?: string | null;
  source?: string;
  compact?: boolean;
  onPrepare?: () => Promise<void>;
}) {
  const hasConfirmedParcel = Boolean(parcelId?.trim());
  const href = hasConfirmedParcel
    ? buildHumanReviewHref({ parcelId, propertyReference, source })
    : "/";
  const shellClass =
    "report-no-print overflow-hidden rounded-[1.5rem] border-2 border-[#FF6A00]/35 bg-gradient-to-br from-[#fff4e6] via-white to-[#F7FBFF] shadow-[0_22px_50px_-34px_rgba(255,106,0,0.45)]";

  return (
    <aside
      className={shellClass}
      aria-label="Done-for-You Property Investigation option"
      data-done-for-you-prominent
      data-compact-requested={compact ? "true" : undefined}
    >
      <TakeoverCardContent hasConfirmedParcel={hasConfirmedParcel} href={href} onPrepare={onPrepare} />
    </aside>
  );
}
