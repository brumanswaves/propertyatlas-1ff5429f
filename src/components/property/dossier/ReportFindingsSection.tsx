/**
 * Findings-driven report primitives.
 *
 * Presentation only: every status, sentence and action already exists in the
 * findings/actions layer (`reportFindings.ts`). Nothing here invents evidence,
 * upgrades a status, or hides a missing state.
 */
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportSectionTitleBlock } from "./ReportEvidenceUi";
import type {
  ReportAction,
  ReportFinding,
  ReportFindingStatus,
} from "@/lib/reports/reportFindings";
import type { PropertyIdentityDisplay } from "@/lib/reports/buildReportViewModel";

const STATUS_LABEL: Record<ReportFindingStatus, string> = {
  verified: "Verified",
  supported: "Supported by evidence",
  no_issue_visible: "No issue visible",
  not_checked: "Not checked",
  missing: "Missing evidence",
  possible_issue: "Possible issue",
  confirmed_issue: "Confirmed issue",
  conflicting: "Conflicting evidence",
};

const STATUS_TONE: Record<ReportFindingStatus, string> = {
  verified: "bg-[#DCFCE7] text-[#166534]",
  supported: "bg-[#DCFCE7] text-[#166534]",
  no_issue_visible: "bg-[#E0F2FE] text-[#075985]",
  not_checked: "bg-[#E2E8F0] text-[#334155]",
  missing: "bg-[#FEF3C7] text-[#92400E]",
  possible_issue: "bg-[#FEF3C7] text-[#92400E]",
  confirmed_issue: "bg-[#FEE2E2] text-[#991B1B]",
  conflicting: "bg-[#FEE2E2] text-[#991B1B]",
};

export function FindingStatusChip({ status }: { status: ReportFindingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FindingCard({
  finding,
  actions,
  onOpenTab,
}: {
  finding: ReportFinding;
  actions?: ReportAction[];
  onOpenTab?: (tab: string) => void;
}) {
  const linked = (actions ?? []).filter((action) => finding.actionIds.includes(action.id));
  return (
    <article
      data-finding-id={finding.id}
      className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FindingStatusChip status={finding.status} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
          Confidence: {finding.confidence}
        </span>
      </div>
      <h4 className="mt-2 text-base font-semibold tracking-tight text-[#0D1B2A]">
        {finding.headline}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/75">{finding.whatWeFound}</p>
      <p className="mt-2 text-xs leading-5 text-[#64748B]">{finding.whatItMeans}</p>
      <p className="mt-2 text-[10px] leading-4 text-[#94A3B8]">
        Source: {finding.sourceIds.length ? finding.sourceIds.join(", ") : "no source attached"}
      </p>
      {linked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {linked.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onOpenTab?.(action.targetTab)}
                className="report-no-print flex w-full items-center justify-between gap-2 rounded-xl border border-[#FF6A00]/25 bg-white px-3 py-2 text-left text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/50 hover:bg-[#fffaf2]"
              >
                {action.title}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** One large, calm report section built from findings of a given category. */
export function ReportFindingsBlock({
  anchorId,
  eyebrow,
  title,
  intro,
  findings,
  actions,
  onOpenTab,
  emptyMessage,
  children,
}: {
  anchorId: string;
  eyebrow: string;
  title: string;
  intro?: string;
  findings: ReportFinding[];
  actions?: ReportAction[];
  onOpenTab?: (tab: string) => void;
  emptyMessage: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={anchorId}
      className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
    >
      <ReportSectionTitleBlock eyebrow={eyebrow} title={title} />
      {intro && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">{intro}</p>}
      {children}
      {findings.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              actions={actions}
              onOpenTab={onOpenTab}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-sm leading-6 text-[#0D1B2A]/70">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

/**
 * Official cadastral area vs registered/deed extent, shown side by side with
 * the reconciliation action when the evidence layer recorded a discrepancy.
 */
export function ReportAreaReconciliation({
  identity,
  officialAreaLabel,
  discrepancy,
  actions,
  onOpenTab,
}: {
  identity: PropertyIdentityDisplay;
  officialAreaLabel: string | null;
  discrepancy: ReportFinding | null;
  actions?: ReportAction[];
  onOpenTab?: (tab: string) => void;
}) {
  if (!identity.registeredExtent && !discrepancy) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        Area reconciliation
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#D9E6F2] bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            Official cadastral area
          </div>
          <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
            {officialAreaLabel ? `${officialAreaLabel} m²` : "Not available"}
          </div>
        </div>
        <div className="rounded-xl border border-[#D9E6F2] bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            Registered / deed extent
          </div>
          <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
            {identity.registeredExtent?.value ?? "Not read from a document"}
          </div>
          {identity.registeredExtent && (
            <p className="mt-1 text-[10px] text-[#94A3B8]">
              Source: {identity.registeredExtent.sourceIds.join(", ") || "unattributed"}
            </p>
          )}
        </div>
      </div>
      {discrepancy && (
        <div className="mt-3">
          <FindingCard finding={discrepancy} actions={actions} onOpenTab={onOpenTab} />
        </div>
      )}
    </div>
  );
}

/** Ranked open actions. The first row is the report's Next Best Action. */
export function ReportActionPlan({
  actions,
  onOpenTab,
}: {
  actions: ReportAction[];
  onOpenTab?: (tab: string) => void;
}) {
  if (!actions.length) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E6F2] bg-white px-3 py-2 text-sm text-[#0D1B2A]/70">
        No open due-diligence action is generated from the current evidence.
      </p>
    );
  }
  return (
    <ol className="mt-4 space-y-3">
      {actions.map((action, index) => (
        <li
          key={action.id}
          data-action-id={action.id}
          className={cn(
            "rounded-2xl border p-4",
            index === 0 ? "border-[#FF6A00]/35 bg-[#FFF7ED]" : "border-[#D9E6F2] bg-white",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#0D1B2A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              Priority {action.priority}
            </span>
            {index === 0 && (
              <span className="rounded-full bg-[#FF6A00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                Next best action
              </span>
            )}
            {action.professionalType && (
              <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#334155]">
                {action.professionalType}
              </span>
            )}
          </div>
          <h4 className="mt-2 text-base font-semibold tracking-tight text-[#0D1B2A]">
            {action.title}
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/75">{action.reason}</p>
          <p className="mt-2 text-xs leading-5 text-[#64748B]">
            Done when: {action.completionCriteria}
          </p>
          <button
            type="button"
            onClick={() => onOpenTab?.(action.targetTab)}
            className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Open {action.targetTab.replace(/-/g, " ")} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ol>
  );
}
