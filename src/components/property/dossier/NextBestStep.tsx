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
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f3f43] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#1f3f43]/15 transition hover:-translate-y-0.5 hover:bg-[#183438]"
    >
      {step.primaryLabel}
      <ExternalLink className="h-4 w-4" />
    </a>
  ) : (
    <button
      type="button"
      onClick={() => step.primaryView && onSelectView?.(step.primaryView)}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f3f43] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#1f3f43]/15 transition hover:-translate-y-0.5 hover:bg-[#183438]"
    >
      {step.primaryLabel}
      <ArrowRight className="h-4 w-4" />
    </button>
  );

  return (
    <section className="overflow-hidden rounded-[2.25rem] border border-[#ead6ba] bg-[linear-gradient(145deg,#fffaf2_0%,#fff2df_58%,#f7dfbf_100%)] p-6 shadow-[0_18px_45px_rgba(67,45,21,0.10)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.35rem] bg-[#1f3f43] text-white shadow-lg shadow-[#1f3f43]/15">
          <Sparkles className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-[2rem] font-semibold leading-none tracking-tight text-[#1f302f]">
              Next Best Step
            </h3>
            <span className="rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[#7a4a1d] ring-1 ring-[#e5c28f]">
              {step.status}
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-xl font-semibold leading-snug text-[#263735]">
            {step.title}
          </p>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#635244]">{step.explanation}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {primary}
            {step.secondaryView && step.secondaryLabel && (
              <button
                type="button"
                onClick={() => onSelectView?.(step.secondaryView!)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#e2c7a0] bg-white/80 px-5 py-3.5 text-[15px] font-semibold text-[#263735] transition hover:-translate-y-0.5 hover:bg-white"
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
