import { ArrowRight, ShieldCheck } from "lucide-react";
import { buildHumanReviewHref } from "@/lib/humanReview/scope";
import { cn } from "@/lib/utils";

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
  const href = buildHumanReviewHref({ parcelId, propertyReference, source });

  return (
    <aside
      className={cn(
        "report-no-print overflow-hidden rounded-[1.5rem] border border-[#FF6A00]/25 bg-gradient-to-br from-[#fff8ec] via-white to-[#F7FBFF] shadow-[0_18px_45px_-38px_rgba(13,27,42,0.45)]",
        compact ? "p-4" : "p-5",
      )}
      aria-label="Human Review option"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            <ShieldCheck className="h-3.5 w-3.5" /> Human Review
          </div>
          <h3 className={cn("font-semibold tracking-tight text-[#0D1B2A]", compact ? "mt-1 text-base" : "mt-2 text-lg")}>
            Want Easy Erf to finish the investigation for you?
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#0D1B2A]/65 sm:text-sm sm:leading-6">
            We use the property work and evidence already gathered, review it against one controlled investigation focus, and return a clearer Human-Reviewed Easy Erf Report. You do not start over.
          </p>
        </div>
        <a
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
        >
          Get Human Review · R999 <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </aside>
  );
}
