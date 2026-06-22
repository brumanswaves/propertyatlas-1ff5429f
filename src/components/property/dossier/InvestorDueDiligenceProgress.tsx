import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DueDiligenceStage, InvestorWorkflowView } from "./investorWorkflow";

interface Props {
  stages: DueDiligenceStage[];
  onSelectView?: (view: InvestorWorkflowView) => void;
}

const STATUS_TONE: Record<DueDiligenceStage["status"], string> = {
  Available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Professional source required": "bg-[#fff4df] text-[#8a561d] ring-[#edcf9c]",
  "Estimate only": "bg-[#eef8fb] text-[#24606b] ring-[#b9dfe6]",
  Missing: "bg-stone-100 text-stone-700 ring-stone-200",
  Fallback: "bg-stone-100 text-stone-700 ring-stone-200",
  "Login required": "bg-purple-50 text-purple-800 ring-purple-200",
  "Source link available": "bg-[#edf8f3] text-[#2d6652] ring-[#b8ddcd]",
};

export function InvestorDueDiligenceProgress({ stages, onSelectView }: Props) {
  const availableCount = stages.filter((stage) => stage.status === "Available").length;

  return (
    <section className="rounded-[2.25rem] border border-[#eadfd1] bg-[#fffdf9] p-6 shadow-[0_14px_36px_rgba(68,49,25,0.07)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-[#263735]">
            Investor Due Diligence Progress
          </h3>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#6b5b4d]">
            A fast analyst-style read of what is known, what has a source link, and what requires
            professional verification.
          </p>
        </div>
        <div className="rounded-full bg-[#fff3df] px-4 py-2 text-sm font-semibold text-[#7a4a1d] ring-1 ring-[#e9c999]">
          {availableCount}/{stages.length} available
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {stages.map((stage) => {
          const clickable = Boolean(stage.view && onSelectView);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {stage.status === "Available" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-[#9a8772]" />
                  )}
                  <div className="text-[15px] font-semibold text-[#263735]">{stage.label}</div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1",
                    STATUS_TONE[stage.status],
                  )}
                >
                  {stage.status}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-[#6b5b4d]">{stage.detail}</p>
            </>
          );

          return clickable ? (
            <button
              key={stage.id}
              type="button"
              onClick={() => stage.view && onSelectView?.(stage.view)}
              className="rounded-[1.35rem] border border-[#eadfd1] bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d7bd96] hover:bg-[#fff8ed]"
            >
              {content}
            </button>
          ) : (
            <div
              key={stage.id}
              className="rounded-[1.35rem] border border-[#eadfd1] bg-white/75 p-4 shadow-sm"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
