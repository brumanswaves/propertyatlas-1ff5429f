import { ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterInvestigationPlan } from "@/lib/investigation/masterPlan";
import type { ReportViewModel } from "@/lib/reports/buildReportViewModel";

/**
 * Report readiness plus a live preview of the report as it stands right now.
 *
 * The user must always be able to see what the report would say today, so the
 * investigation never feels like work with a hidden payoff.
 */
export interface ReportReadinessPanelProps {
  plan: MasterInvestigationPlan;
  report: ReportViewModel;
  onOpenReport: () => void;
}

export function ReportReadinessPanel({ plan, report, onOpenReport }: ReportReadinessPanelProps) {
  const positives = report.brief.positives.slice(0, 3);
  const attention = report.brief.attention.slice(0, 3);

  return (
    <section
      data-testid="report-readiness"
      className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/95 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0D1B2A]">
            <FileText className="h-4 w-4 text-[#FF6A00]" />
            Your report, as it stands
          </h3>
          <p className="mt-1 max-w-xl text-[14px] leading-6 text-[#0D1B2A]/72">
            {plan.readiness.conclusion}
          </p>
        </div>
        <div className="text-right">
          <p
            data-testid="report-readiness-percent"
            className="text-3xl font-semibold tracking-tight text-[#0D1B2A]"
          >
            {plan.readiness.percent}%
          </p>
          <p className="text-[13px] font-semibold text-[#64748B]">ready</p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={plan.readiness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Report readiness"
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#0D1B2A]/8"
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FF6A00,#FFB86B)]"
          style={{ width: `${plan.readiness.percent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[#F2F4F7] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#166534]">
            Already supported
          </p>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-6 text-[#0D1B2A]/80">
            {positives.length > 0 ? (
              positives.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Nothing is supported by evidence yet.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl bg-[#FFF7ED] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9A3412]">
            Material gaps ({plan.readiness.materialOutstanding})
          </p>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-6 text-[#0D1B2A]/80">
            {attention.length > 0 ? (
              attention.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>No material gaps recorded.</li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenReport}
        className={cn(
          "mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
          "bg-[#0D1B2A] text-white hover:brightness-110",
        )}
      >
        Preview current report <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

export default ReportReadinessPanel;
