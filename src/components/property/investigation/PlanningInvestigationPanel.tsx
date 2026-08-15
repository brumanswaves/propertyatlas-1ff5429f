import { AlertTriangle, CheckCircle2, FileSearch2, ShieldCheck } from "lucide-react";
import type { PlanningInvestigationJobV1 } from "@/lib/investigation/planningInvestigationJob";

interface PlanningInvestigationPanelProps {
  job: PlanningInvestigationJobV1;
}

function statusLabel(job: PlanningInvestigationJobV1) {
  if (job.status === "blocked") return "Investigation blocked by missing evidence";
  if (job.status === "needs_review") return "Investigation complete, review still needed";
  return "Planning investigation complete";
}

function confidenceLabel(job: PlanningInvestigationJobV1) {
  return job.confidence === "unverified"
    ? "Unverified"
    : `${job.confidence.charAt(0).toUpperCase()}${job.confidence.slice(1)}`;
}

export function PlanningInvestigationPanel({ job }: PlanningInvestigationPanelProps) {
  const attention = job.status !== "completed";
  const keyFindings = job.output.findings.slice(0, 5);
  const unresolved = job.output.unresolvedEvidence.slice(0, 4);

  return (
    <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            <FileSearch2 className="h-3.5 w-3.5" />
            Easy Erf planning investigation
          </div>
          <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
            Easy Erf investigated the planning position
          </h4>
          <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/68">{job.output.summary}</p>
        </div>
        <span
          className={
            attention
              ? "inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
              : "inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
          }
        >
          {attention ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {statusLabel(job)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Sources checked</div>
          <div className="mt-1 text-xl font-semibold text-[#0D1B2A]">{job.output.sourceSummary.checked}</div>
        </div>
        <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Findings</div>
          <div className="mt-1 text-xl font-semibold text-[#0D1B2A]">{job.output.findings.length}</div>
        </div>
        <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Confidence</div>
          <div className="mt-1 text-xl font-semibold text-[#0D1B2A]">{confidenceLabel(job)}</div>
        </div>
      </div>

      {keyFindings.length ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0D1B2A]">
            <ShieldCheck className="h-4 w-4 text-[#FF6A00]" />
            What Easy Erf found
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {keyFindings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-[#0D1B2A]/8 bg-white p-3">
                <div className="text-xs font-semibold text-[#0D1B2A]">{finding.label}</div>
                <div className="mt-1 text-sm text-[#0D1B2A]/76">{finding.value}</div>
                <div className="mt-2 text-[11px] text-[#64748B]">
                  {finding.status.replaceAll("_", " ")} · {finding.confidence} confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {job.output.contradictions.length ? (
        <div className="mt-4 rounded-xl border border-rose-300/50 bg-rose-50 p-3">
          <div className="text-xs font-semibold text-rose-900">Contradictions found</div>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-rose-900/80">
            {job.output.contradictions.slice(0, 3).map((item) => (
              <li key={item.id}>• {item.title}: {item.detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {unresolved.length ? (
        <div className="mt-4 rounded-xl border border-amber-300/45 bg-amber-50 p-3">
          <div className="text-xs font-semibold text-amber-950">Still unresolved</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900/80">
            {unresolved.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.nextJob ? (
        <div className="mt-4 rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Next investigation</div>
          <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">{job.nextJob.title}</div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">{job.nextJob.reason}</p>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-5 text-[#64748B]">
        Easy Erf keeps published scheme rules, working conclusions and property-specific proof separate. Assumptions are never promoted to municipal confirmation automatically.
      </p>
    </section>
  );
}

export default PlanningInvestigationPanel;
