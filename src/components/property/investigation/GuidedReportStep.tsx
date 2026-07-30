import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import type { MasterInvestigationPlan } from "@/lib/investigation/masterPlan";
import type { ReportViewModel } from "@/lib/reports/buildReportViewModel";
import { ReportReadinessPanel } from "./ReportReadinessPanel";

interface GuidedReportStepProps {
  plan: MasterInvestigationPlan;
  report: ReportViewModel;
  onOpenReport: () => void;
}

export function GuidedReportStep({ plan, report, onOpenReport }: GuidedReportStepProps) {
  const supportedCount = report.brief.positives.length;
  const attentionCount = report.brief.attention.length;
  const hasMaterialGaps = plan.readiness.materialOutstanding > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Evidence-backed report
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Review what Easy Erf can support today
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              The report is available even when evidence is missing. Supported findings, assumptions,
              contradictions, and unresolved gaps remain labelled so the report does not invent ownership,
              zoning, value, compliance, or development rights.
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              hasMaterialGaps
                ? "bg-amber-100 text-amber-900"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {hasMaterialGaps ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {hasMaterialGaps
              ? `${plan.readiness.materialOutstanding} material gap${
                  plan.readiness.materialOutstanding === 1 ? "" : "s"
                } remain`
              : "No material gaps recorded"}
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#0D1B2A]/10 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#166534]">
            <ShieldCheck className="h-4 w-4" />
            Supported
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#0D1B2A]">
            {supportedCount}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
            Positive findings currently supported by saved evidence.
          </p>
        </div>
        <div className="rounded-xl border border-[#0D1B2A]/10 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#9A3412]">
            <AlertTriangle className="h-4 w-4" />
            Attention
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#0D1B2A]">
            {attentionCount}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
            Risks, caveats, contradictions, or missing evidence called out in the brief.
          </p>
        </div>
        <div className="rounded-xl border border-[#0D1B2A]/10 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0D1B2A]/65">
            <FileText className="h-4 w-4" />
            Readiness
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#0D1B2A]">
            {plan.readiness.percent}%
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
            Readiness measures evidence coverage, not whether the property is a good investment.
          </p>
        </div>
      </section>

      <ReportReadinessPanel plan={plan} report={report} onOpenReport={onOpenReport} />

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#0D1B2A] p-4 text-white">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#FFB86B]" />
          <div>
            <h4 className="text-sm font-semibold">Opening the report completes the guided journey</h4>
            <p className="mt-1 text-sm leading-6 text-white/70">
              You can return to any earlier step, add stronger evidence, and reopen the report. The report
              will update from the same saved erf file without deleting later work.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default GuidedReportStep;
