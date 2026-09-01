import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { buildHumanReviewHref } from "@/lib/humanReview/scope";
import { cn } from "@/lib/utils";

const HUMAN_REVIEW_BENEFITS = [
  "What is known, with the evidence and confidence clearly separated",
  "What appears possible for this property",
  "Risks, conflicts or problems that could matter",
  "What is still unknown or needs verification",
  "Clear next checks, saved in your Human-Reviewed Easy Erf Report",
] as const;

export function HumanReviewTakeoverCard({
  parcelId,
  propertyReference,
  source = "investigation",
  compact = false,
}: {
  parcelId?: string | null;
  propertyReference?: string | null;
  source?: string;
  compact?: boolean;
}) {
  const hasConfirmedParcel = Boolean(parcelId?.trim());
  const href = hasConfirmedParcel
    ? buildHumanReviewHref({ parcelId, propertyReference, source })
    : "/";

  return (
    <aside
      className={cn(
        "report-no-print overflow-hidden rounded-[1.5rem] border border-[#FF6A00]/25 bg-gradient-to-br from-[#fff8ec] via-white to-[#F7FBFF] shadow-[0_18px_45px_-38px_rgba(13,27,42,0.45)]",
        compact ? "p-4" : "p-5",
      )}
      aria-label="Human Review option"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
              <ShieldCheck className="h-3.5 w-3.5" /> Human Review
            </div>
            {hasConfirmedParcel ? (
              <span className="rounded-full border border-[#FF6A00]/20 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#92400E]">
                R999 once-off · no subscription
              </span>
            ) : null}
          </div>

          <h3
            className={cn(
              "font-semibold tracking-tight text-[#0D1B2A]",
              compact ? "mt-2 text-lg" : "mt-2 text-xl",
            )}
          >
            {hasConfirmedParcel
              ? "Want Easy Erf to review this property for you?"
              : "Choose the exact property before Human Review."}
          </h3>

          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#0D1B2A]/68 sm:text-sm sm:leading-6">
            {hasConfirmedParcel
              ? "A human reviewer checks the evidence already gathered for this exact parcel and turns it into a focused property report. You keep the same property file and do not start over."
              : "Search by address or Erf, review the result on the map, and open the correct official parcel before starting Human Review. Erf numbers can repeat in different places."}
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
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 lg:min-w-[15rem] lg:items-end">
          {hasConfirmedParcel ? (
            <div className="text-left text-[11px] leading-5 text-[#64748B] lg:max-w-[15rem] lg:text-right">
              Human-reviewed report saved to your Easy Erf account.
            </div>
          ) : null}
          <a
            href={href}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
          >
            {hasConfirmedParcel ? "Yes — get Human Review · R999" : "Find property on map"}
            <ArrowRight className="h-4 w-4" />
          </a>
          {hasConfirmedParcel ? (
            <div className="text-left text-[10px] leading-4 text-[#64748B] lg:max-w-[15rem] lg:text-right">
              Property research and due-diligence support, not professional advice or municipal approval.
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
