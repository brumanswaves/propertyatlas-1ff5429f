import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GuidedInvestigationStep,
  GuidedInvestigationStepId,
} from "@/lib/investigation/guidedJourney";
import { ExpertWorkspaceLauncher } from "./ExpertWorkspaceLauncher";
import type { DossierView } from "@/components/property/dossier/reportViews";

interface InvestigationStepShellProps {
  step: GuidedInvestigationStep;
  steps: GuidedInvestigationStep[];
  children?: ReactNode;
  onSelectStep: (stepId: GuidedInvestigationStepId) => void;
  onSkipStep?: (stepId: GuidedInvestigationStepId) => void;
  onOpenExpertWorkspace: (view?: DossierView) => void;
}

export function InvestigationStepShell({
  step,
  steps,
  children,
  onSelectStep,
  onSkipStep,
  onOpenExpertWorkspace,
}: InvestigationStepShellProps) {
  const previous = steps[step.index - 2] ?? null;
  const next = steps[step.index] ?? null;
  const isPreview = step.id !== "confirm-property";

  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_22px_56px_-42px_rgba(13,27,42,0.5)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            Step {step.index}
          </div>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
            {step.label}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0D1B2A]/66">
            {step.description}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
            step.status === "complete"
              ? "bg-emerald-100 text-emerald-800"
              : step.status === "skipped"
                ? "bg-slate-100 text-slate-700"
                : step.status === "blocked"
                  ? "bg-red-100 text-red-800"
                  : "bg-[#fff0df] text-[#B45309]",
          )}
        >
          {step.status}
        </span>
      </div>

      <div className="mt-5">{children}</div>

      {isPreview && (
        <div className="rounded-[1.25rem] border border-dashed border-[#0D1B2A]/14 bg-[#F8FAFC] p-4">
          <p className="text-sm font-semibold text-[#0D1B2A]">
            This guided action is coming in a later build phase.
          </p>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
            For now this step is shown so the journey stays honest and predictable. No upload,
            importer, calculator or report action has been moved here yet.
          </p>
          <div className="mt-3">
            <ExpertWorkspaceLauncher onOpenExpertWorkspace={onOpenExpertWorkspace} compact />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#0D1B2A]/8 pt-4">
        <div className="flex flex-wrap gap-2">
          {previous && (
            <button
              type="button"
              onClick={() => onSelectStep(previous.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {step.definition.canSkip && onSkipStep && !step.complete && (
            <button
              type="button"
              onClick={() => onSkipStep(step.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]/70 transition hover:border-[#FF6A00]/35"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip for now
            </button>
          )}
        </div>
        {next && (
          <button
            type="button"
            onClick={() => onSelectStep(next.id)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
          >
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}

export default InvestigationStepShell;
