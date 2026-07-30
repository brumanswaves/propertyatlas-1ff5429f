import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuidedInvestigationStep } from "@/lib/investigation/guidedJourney";

interface InvestigationProgressProps {
  steps: GuidedInvestigationStep[];
}

export function InvestigationProgress({ steps }: InvestigationProgressProps) {
  const completed = steps.filter((step) => step.complete).length;
  const current = steps.find((step) => step.current) ?? steps[0];
  const percent = Math.round((completed / Math.max(1, steps.length)) * 100);

  return (
    <section
      className="rounded-[1.35rem] border border-white/10 bg-[#0D1B2A] p-4 text-white shadow-[0_24px_64px_-42px_rgba(13,27,42,0.9)] md:p-5"
      aria-label="Guided investigation progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            Guided Investigation
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
            Step {current.index} of {steps.length}: {current.label}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/76">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {completed} complete
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Guided investigation completion"
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={cn(
            "h-full rounded-full bg-[linear-gradient(90deg,#FF6A00,#FFB86B)] transition-[width]",
            percent === 0 && "opacity-40",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}

export default InvestigationProgress;
