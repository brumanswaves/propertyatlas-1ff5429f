import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DueDiligenceStage, InvestorWorkflowView } from "./investorWorkflow";

interface Props {
  stages: DueDiligenceStage[];
  onSelectView?: (view: InvestorWorkflowView) => void;
}

const STATUS_TONE: Record<DueDiligenceStage["status"], string> = {
  Available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Professional source required": "bg-amber-50 text-amber-800 ring-amber-200",
  "Estimate only": "bg-sky-50 text-sky-800 ring-sky-200",
  Missing: "bg-stone-100 text-stone-700 ring-stone-200",
  Fallback: "bg-stone-100 text-stone-700 ring-stone-200",
  "Login required": "bg-purple-50 text-purple-800 ring-purple-200",
  "Source link available": "bg-teal-50 text-teal-800 ring-teal-200",
};

export function InvestorDueDiligenceProgress({ stages, onSelectView }: Props) {
  const availableCount = stages.filter((stage) => stage.status === "Available").length;

  return (
    <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Investor Due Diligence Progress</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            A fast analyst-style read of what is known, what has a source link, and what requires
            professional verification.
          </p>
        </div>
        <div className="rounded-full bg-[#fff8ed] px-3 py-1.5 text-xs font-semibold text-[#7a4a1d] ring-1 ring-amber-200">
          {availableCount}/{stages.length} available
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {stages.map((stage) => {
          const clickable = Boolean(stage.view && onSelectView);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {stage.status === "Available" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="text-sm font-semibold text-foreground">{stage.label}</div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    STATUS_TONE[stage.status],
                  )}
                >
                  {stage.status}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {stage.detail}
              </p>
            </>
          );

          return clickable ? (
            <button
              key={stage.id}
              type="button"
              onClick={() => stage.view && onSelectView?.(stage.view)}
              className="rounded-2xl border border-border bg-background/70 p-4 text-left transition hover:border-foreground/20 hover:bg-[#fff8ed]"
            >
              {content}
            </button>
          ) : (
            <div key={stage.id} className="rounded-2xl border border-border bg-background/70 p-4">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
