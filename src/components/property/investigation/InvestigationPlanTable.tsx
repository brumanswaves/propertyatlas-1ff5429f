import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_IMPORTANCE_GROUPS,
  type InvestigationPlanRow,
  type MasterInvestigationPlan,
  type PlanRowStatus,
} from "@/lib/investigation/masterPlan";

/**
 * The Master Investigation Plan, always fully visible.
 *
 * Nothing here is hidden behind a disclosure: the user must be able to see the
 * whole due-diligence roadmap, what is complete, what is partial and what is
 * missing, with one direct action per row.
 */

export interface InvestigationPlanTableProps {
  plan: MasterInvestigationPlan;
  onRowAction: (row: InvestigationPlanRow) => void;
}

const STATUS_LABEL: Record<PlanRowStatus, string> = {
  complete: "Complete",
  partial: "Partial",
  not_started: "Not started",
  blocked: "Blocked",
  not_applicable: "Not applicable",
};

const STATUS_TONE: Record<PlanRowStatus, string> = {
  complete: "bg-[#DCFCE7] text-[#166534]",
  partial: "bg-[#FFF7ED] text-[#9A3412]",
  not_started: "bg-[#F1F5F9] text-[#334155]",
  blocked: "bg-[#FEE2E2] text-[#991B1B]",
  not_applicable: "bg-[#F1F5F9] text-[#64748B]",
};

function StatusIcon({ status }: { status: PlanRowStatus }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-[#15803D]" />;
  if (status === "blocked") return <AlertTriangle className="h-4 w-4 text-[#B91C1C]" />;
  if (status === "not_applicable") return <MinusCircle className="h-4 w-4 text-[#94A3B8]" />;
  return (
    <CircleDashed
      className={cn("h-4 w-4", status === "partial" ? "text-[#EA580C]" : "text-[#94A3B8]")}
    />
  );
}

function PlanRow({
  row,
  isNext,
  onRowAction,
}: {
  row: InvestigationPlanRow;
  isNext: boolean;
  onRowAction: (row: InvestigationPlanRow) => void;
}) {
  return (
    <li
      data-plan-row={row.id}
      data-plan-status={row.status}
      data-plan-importance={row.importance}
      className={cn(
        "flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4",
        isNext && "-mx-3 rounded-2xl bg-[#FFF7ED] px-3",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 shrink-0">
          <StatusIcon status={row.status} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold leading-6 text-[#0D1B2A]">{row.title}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]",
                STATUS_TONE[row.status],
              )}
            >
              {STATUS_LABEL[row.status]}
            </span>
            {isNext && (
              <span className="rounded-full bg-[#FF6A00] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                Next
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[14px] leading-6 text-[#0D1B2A]/72">{row.summary}</p>
          {row.missingItem && (
            <p className="mt-0.5 text-[14px] leading-6 text-[#9A3412]">
              Missing: {row.missingItem}
            </p>
          )}
          {row.conflicts.map((conflict) => (
            <p
              key={conflict.id}
              data-plan-conflict={conflict.id}
              className="mt-1 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[14px] leading-6 text-[#991B1B]"
            >
              {conflict.title}
              {conflict.values.length > 0 ? `: ${conflict.values.join(" vs ")}` : ""}
            </p>
          ))}
        </div>
      </div>

      {row.status !== "not_applicable" && (
        <button
          type="button"
          onClick={() => onRowAction(row)}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-[14px] font-semibold transition md:self-auto",
            isNext
              ? "border border-[#FF6A00]/45 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/70 hover:bg-[#FFF7ED]"
              : "border border-[#0D1B2A]/12 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/40",
          )}
        >
          {row.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function InvestigationPlanTable({ plan, onRowAction }: InvestigationPlanTableProps) {
  return (
    <section
      data-testid="investigation-plan"
      className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/95 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight text-[#0D1B2A]">
          Your investigation plan
        </h3>
        <p className="text-[14px] text-[#64748B]">
          {plan.readiness.requiredComplete} of {plan.readiness.requiredTotal} required checks
          complete
        </p>
      </div>

      {PLAN_IMPORTANCE_GROUPS.map((group) => {
        const rows = plan.rows.filter((row) => row.importance === group.importance);
        if (!rows.length) return null;
        return (
          <div key={group.importance} className="mt-5 first:mt-4">
            <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#FF6A00]">
              {group.heading}
            </p>
            <p className="mt-0.5 text-[14px] leading-6 text-[#64748B]">{group.description}</p>
            <ul className="mt-1 divide-y divide-[#0D1B2A]/8">
              {rows.map((row) => (
                <PlanRow
                  key={row.id}
                  row={row}
                  isNext={plan.nextActionRowId === row.id}
                  onRowAction={onRowAction}
                />
              ))}
            </ul>
          </div>
        );
      })}

      <p className="mt-5 border-t border-[#0D1B2A]/8 pt-4 text-[14px] leading-6 text-[#64748B]">
        Easy Erf only records what public sources, your documents and your own inputs support. A
        missing item is not proof that nothing exists.
      </p>
    </section>
  );
}

export default InvestigationPlanTable;
