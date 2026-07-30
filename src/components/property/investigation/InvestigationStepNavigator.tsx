import { CheckCircle2, CircleDashed, LockKeyhole, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GuidedInvestigationStep,
  GuidedInvestigationStepId,
} from "@/lib/investigation/guidedJourney";

interface InvestigationStepNavigatorProps {
  steps: GuidedInvestigationStep[];
  onSelectStep: (stepId: GuidedInvestigationStepId) => void;
}

const STATUS_ICON = {
  complete: CheckCircle2,
  current: CircleDashed,
  available: CircleDashed,
  blocked: LockKeyhole,
  skipped: SkipForward,
} as const;

export function InvestigationStepNavigator({
  steps,
  onSelectStep,
}: InvestigationStepNavigatorProps) {
  return (
    <section
      className="rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white/92 p-3 shadow-[0_18px_46px_-38px_rgba(13,27,42,0.45)]"
      aria-label="Guided investigation steps"
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-semibold tracking-tight text-[#0D1B2A]">View all steps</h3>
        <span className="text-[11px] font-semibold text-[#64748B]">8-step path</span>
      </div>
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:grid md:grid-cols-4 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {steps.map((step) => {
          const Icon = STATUS_ICON[step.status];
          const disabled = step.status === "blocked";
          return (
            <li key={step.id} className="min-w-[10.5rem] md:min-w-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectStep(step.id)}
                aria-current={step.current ? "step" : undefined}
                className={cn(
                  "flex min-h-[4.25rem] w-full items-start gap-2 rounded-[1rem] border p-3 text-left transition",
                  step.current
                    ? "border-[#FF6A00]/45 bg-[#fff8ec] shadow-[0_16px_32px_-28px_rgba(255,106,0,0.55)]"
                    : step.complete
                      ? "border-emerald-200 bg-emerald-50"
                      : step.skipped
                        ? "border-slate-200 bg-slate-50"
                        : "border-[#0D1B2A]/10 bg-white hover:border-[#FF6A00]/30 hover:bg-[#fffaf4]",
                  disabled && "cursor-not-allowed opacity-55 hover:border-[#0D1B2A]/10 hover:bg-white",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    step.current
                      ? "bg-[#FF6A00] text-white"
                      : step.complete
                        ? "bg-emerald-600 text-white"
                        : step.skipped
                          ? "bg-slate-300 text-slate-800"
                          : "bg-[#0D1B2A]/8 text-[#0D1B2A]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                    Step {step.index}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-[#0D1B2A]">
                    {step.shortLabel}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default InvestigationStepNavigator;
