import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import type { NextBestStepModel, InvestorWorkflowView } from "./investorWorkflow";

interface Props {
  step: NextBestStepModel;
  onSelectView?: (view: InvestorWorkflowView) => void;
}

export function NextBestStep({ step, onSelectView }: Props) {
  const primary = step.primaryUrl ? (
    <a
      href={step.primaryUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
    >
      {step.primaryLabel}
      <ExternalLink className="h-4 w-4" />
    </a>
  ) : (
    <button
      type="button"
      onClick={() => step.primaryView && onSelectView?.(step.primaryView)}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
    >
      {step.primaryLabel}
      <ArrowRight className="h-4 w-4" />
    </button>
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[#fff8ed] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2f5d62] text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Next Best Step
            </h3>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#7a4a1d] ring-1 ring-amber-200">
              {step.status}
            </span>
          </div>
          <p className="mt-3 text-base font-semibold leading-snug text-foreground">{step.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.explanation}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {primary}
            {step.secondaryView && step.secondaryLabel && (
              <button
                type="button"
                onClick={() => onSelectView?.(step.secondaryView!)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                {step.secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
