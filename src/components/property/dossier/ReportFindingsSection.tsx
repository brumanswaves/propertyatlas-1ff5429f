/**
 * Findings-driven report primitives.
 *
 * Presentation only: every status, sentence and action already exists in the
 * findings/actions layer (`reportFindings.ts`). Nothing here invents evidence,
 * upgrades a status, or hides a missing state.
 */
import { ArrowRight, ExternalLink } from "lucide-react";
import { groupReportActions, reportEvidenceAnchor, reportProfessionalSearch, reportTaskLabel, safeReportSourceUrl } from "@/lib/reports/reportPresentation";
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
  sourceLabels,
}: {
  finding: ReportFinding;
  actions?: ReportAction[];
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void;
  sourceLabels?: Record<string, string>;
}) {
  const linked = (actions ?? []).filter((action) => finding.actionIds.includes(action.id));
  return (
    <article
      data-finding-id={finding.id}
      id={`finding-${finding.id}`}
      className="border-b border-border py-5 scroll-mt-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FindingStatusChip status={finding.status} />
      </div>
      <h4 className="mt-2 text-base font-semibold text-[#0D1B2A]">
        {finding.headline}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/75">{finding.whatWeFound}</p>
      <p className="mt-2 text-xs leading-5 text-[#64748B]">{finding.whatItMeans}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {finding.sourceIds.length ? <>Source: {finding.sourceIds.map((id, index) => <span key={id}>{index ? "; " : ""}{sourceLabels?.[id]
          ? <a href={`#investigation-source-${encodeURIComponent(id)}`} className="underline">{sourceLabels[id]}</a>
          : "Recorded evidence (see source appendix)"}</span>)}</> : "No supporting source attached."}
      </p>
      {linked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {linked.map((action) => (
            <li key={action.id}>
              {onOpenTab ? <button
                type="button"
                onClick={() => onOpenTab(action.targetTab, { anchorId: action.targetAnchorId })}
                className="report-no-print flex w-full items-center justify-between gap-2 rounded-xl border border-[#FF6A00]/25 bg-white px-3 py-2 text-left text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/50 hover:bg-[#fffaf2]"
              >
                {reportTaskLabel(action.targetTab)}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button> : <p className="text-xs text-muted-foreground">{action.title} Investigation changes are unavailable in this report view.</p>}
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
  sourceLabels,
}: {
  anchorId: string;
  eyebrow: string;
  title: string;
  intro?: string;
  findings: ReportFinding[];
  actions?: ReportAction[];
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void;
  emptyMessage: string;
  children?: React.ReactNode;
  sourceLabels?: Record<string, string>;
}) {
  return (
    <section
      id={anchorId}
      className="report-section py-5 scroll-mt-6"
    >
      <ReportSectionTitleBlock eyebrow={eyebrow} title={title} />
      {intro && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">{intro}</p>}
      {children}
      {findings.length ? (
        <div className="mt-4">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              actions={actions}
              onOpenTab={onOpenTab}
              sourceLabels={sourceLabels}
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
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void;
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
  canonicalAction, summary = false, location, evidenceLinks = false, printOnly = false,
}: {
  actions: ReportAction[];
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void;
  canonicalAction?: ReportAction | null;
  summary?: boolean;
  location?: string | null;
  evidenceLinks?: boolean;
  printOnly?: boolean;
}) {
  const groups = groupReportActions(actions, canonicalAction);
  const visible = summary ? groups.slice(0, 3) : groups;
  if (!groups.length) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E6F2] bg-white px-3 py-2 text-sm text-[#0D1B2A]/70">
        No open due-diligence action is generated from the current evidence.
      </p>
    );
  }
  return (
    <><ol className="mt-4 divide-y divide-border">
      {visible.map(({ action, members, title }, index) => (
        <li
          key={action.id}
          data-action-id={action.id}
          className="py-4 first:pt-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">{index + 1}.</span>
            {canonicalAction?.id === action.id && (
              <span className="text-xs font-semibold text-accent">
                Next best action
              </span>
            )}
          </div>
          <h4 className="mt-2 text-base font-semibold text-[#0D1B2A]">
            {title}
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/75">{action.reason}</p>
          <details open={printOnly || undefined} className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">{members.length > 1 ? `${members.length} checks in this action` : "Steps and supporting sources"}</summary>
            <ul className="mt-2 space-y-3">{members.map((member) => <li key={member.id}>
              {members.length > 1 && <p className="font-medium">{member.title}</p>}
              <p className="text-xs leading-5 text-muted-foreground">{member.completionCriteria.replace(/^(Done when:\s*)?(Resolved when:\s*)?/i, "")}</p>
              {member.steps && <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">{member.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
              {member.limitations && <p className="mt-2 text-xs text-muted-foreground">{member.limitations}</p>}
              {member.requestTemplate && <details className="mt-2"><summary className="cursor-pointer text-xs">Request template</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5">{member.requestTemplate}</p></details>}
              {[...(member.sourceUrl && member.sourceLabel ? [{ url: member.sourceUrl, label: member.sourceLabel }] : []), ...(member.extraSources ?? [])].map((source) => {
                const href = safeReportSourceUrl(source.url);
                return href ? printOnly ? <p key={source.url} className="mt-2 text-xs">Source: {source.label}</p> : <a key={source.url} href={href} target="_blank" rel="noopener noreferrer" className="report-no-print mt-2 mr-4 inline-flex min-h-11 items-center gap-2 underline">{source.label} <ExternalLink className="h-3.5 w-3.5" /></a> : null;
              })}
            </li>)}</ul>
          </details>
          {!printOnly && <div className="report-no-print mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {onOpenTab && <button type="button" onClick={() => onOpenTab(action.targetTab, { anchorId: action.targetAnchorId })}
              className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 py-2 font-semibold text-primary-foreground">{action.actionLabel ?? reportTaskLabel(action.targetTab)} <ArrowRight className="h-4 w-4" /></button>}
            {evidenceLinks && <a href={`#${reportEvidenceAnchor(action.professionalType === "Town planner" ? "zoning-build" : action.targetTab, action.targetAnchorId)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">{action.targetTab === "zoning-build" || action.professionalType === "Town planner" ? "View planning evidence" : "View supporting evidence"}</a>}
            {reportProfessionalSearch(action, location) && <a href={reportProfessionalSearch(action, location)!} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4">Find {action.professionalType?.toLowerCase()} <ExternalLink className="h-4 w-4" /></a>}
          </div>}
          {action.professionalType && <p className="mt-1 text-xs text-muted-foreground">{location ? `Professional search near ${location}. External results, not an Easy Erf endorsement.` : "Record a property location before searching for a local professional."}</p>}
        </li>
      ))}
    </ol>{!onOpenTab && !printOnly && <p className="mt-2 text-xs text-muted-foreground">Investigation editing is unavailable in this report view. Use the evidence links to review recorded sources.</p>}
    {summary && groups.length > 3 && evidenceLinks && <a href="#investigation-actions" className="report-no-print inline-block min-h-11 py-3 text-sm underline">View all {groups.length} grouped actions</a>}</>
  );
}
