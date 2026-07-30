import { cn } from "@/lib/utils";
import { formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import { buildZoningSummary } from "@/lib/planning/zoningSummary";
import type {
  ParcelPlanningAssessment,
  PlanningChecklistStatus,
  PlanningRiskSeverity,
  ZoningRule,
} from "@/lib/planning/municipalityPlanningTypes";

/**
 * Zoning & Build presentation.
 *
 * Result first: trust status, zone (only when supported), large metrics, one
 * sentence, one action, top two risks. Every clause, source, checklist item
 * and manual control stays available inside one disclosure.
 *
 * Trust separation is preserved: a published general rule is never rendered as
 * a confirmed right for this erf.
 */

export interface ZoningBuildPanelProps {
  assessment: ParcelPlanningAssessment;
  zoneOptions: Array<{ code: string; name: string }>;
  selectedZoneCode: string | null;
  onSelectZone?: (code: string | null) => void;
  onOpenTab?: (tab: string) => void;
  onAskEasyErf?: (question: string) => void;
  compact?: boolean;
}

const SEVERITY_TONE: Record<PlanningRiskSeverity, string> = {
  high: "border-[#DC2626]/35 bg-[#FEF2F2] text-[#B91C1C]",
  medium: "border-[#F59E0B]/35 bg-[#FFFBEB] text-[#B45309]",
  low: "border-[#0D1B2A]/12 bg-[#F2F4F7] text-[#475569]",
};

const CHECK_TONE: Record<PlanningChecklistStatus, string> = {
  verified: "border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]",
  published_general_rule: "border-[#0EA5E9]/30 bg-[#F0F9FF] text-[#0369A1]",
  detected: "border-[#0EA5E9]/30 bg-[#F0F9FF] text-[#0369A1]",
  uploaded: "border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]",
  requested: "border-[#F59E0B]/30 bg-[#FFFBEB] text-[#B45309]",
  missing: "border-[#0D1B2A]/12 bg-[#F2F4F7] text-[#64748B]",
  conflict: "border-[#DC2626]/35 bg-[#FEF2F2] text-[#B91C1C]",
  needs_professional_confirmation: "border-[#F59E0B]/30 bg-[#FFFBEB] text-[#B45309]",
};

const CHECK_LABEL: Record<PlanningChecklistStatus, string> = {
  verified: "Verified",
  published_general_rule: "Published rule",
  detected: "Detected",
  uploaded: "Uploaded",
  requested: "Requested",
  missing: "Missing",
  conflict: "Conflict",
  needs_professional_confirmation: "Needs professional confirmation",
};

const TRUST_TONE = {
  verified: "bg-emerald-500/18 text-emerald-100 border-emerald-300/40",
  estimated: "bg-[#FF6A00]/16 text-[#FFD8B4] border-[#FFB86B]/40",
  more_information_required: "bg-white/10 text-white/78 border-white/20",
} as const;

function ruleValue(rule: ZoningRule) {
  if (rule.value == null) return "See statement";
  if (rule.unit === "percent") return `${rule.value}%`;
  if (rule.unit === "m") return `${rule.value} m`;
  if (rule.unit === "units") return `${rule.value}`;
  return `${rule.value}${rule.unit ? ` ${rule.unit}` : ""}`;
}

function statusNote(status: ZoningRule["status"]) {
  if (status === "manual_candidate") {
    return "Captured by hand and not yet confirmed against the official document. Review required.";
  }
  if (status === "draft" || status === "pending") {
    return `Document status: ${status}. Not proved to be enforceable.`;
  }
  if (status === "superseded") return "This document may have been superseded.";
  return null;
}

function Block({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4 text-[#0D1B2A] md:p-5">
      <h3 className="text-sm font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
      {intro ? <p className="mt-1 text-[13px] leading-6 text-[#64748B]">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ZoningBuildPanel({
  assessment,
  zoneOptions,
  selectedZoneCode,
  onSelectZone,
  onOpenTab,
  onAskEasyErf,
  compact = false,
}: ZoningBuildPanelProps) {
  const { detection, envelope, publishedRules } = assessment;
  const summary = buildZoningSummary(assessment);

  return (
    <div className="space-y-4">
      {/* RESULT FIRST */}
      <section className="rounded-[1.5rem] border border-white/10 bg-[#0D1B2A] p-5 text-white md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
              TRUST_TONE[summary.trustStatus],
            )}
          >
            {summary.trustLabel}
          </span>
          <span className="text-[12px] text-white/60">Source: {summary.zoneSourceLabel}</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {summary.zoneLabel ?? "Zoning not confirmed"}
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-white/76 md:text-sm">
          {summary.whatThisMeans}
        </p>

        {summary.metrics.length ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {summary.metrics.map((metric) => (
              <div
                key={metric.id}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/56">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                  {metric.value}
                </dd>
                {metric.note ? (
                  <dd className="mt-0.5 text-[11px] leading-4 text-white/58">{metric.note}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}

        {summary.nextAction ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onOpenTab ? (
              <button
                type="button"
                onClick={() => onOpenTab(summary.nextAction!.actionTab)}
                className="inline-flex min-h-11 items-center rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                {summary.nextAction.actionLabel}
              </button>
            ) : null}
            <p className="max-w-md text-[13px] leading-5 text-white/70">
              {summary.nextAction.title}
            </p>
          </div>
        ) : null}
      </section>

      {/* TOP TWO RISKS ONLY */}
      {summary.topRisks.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {summary.topRisks.map((flag) => (
            <article
              key={flag.id}
              className={cn("rounded-[1.25rem] border p-4", SEVERITY_TONE[flag.severity])}
            >
              <h3 className="text-sm font-semibold text-[#0D1B2A]">{flag.title}</h3>
              <p className="mt-1 text-[13px] leading-6 text-[#0D1B2A]/78">{flag.why}</p>
            </article>
          ))}
        </section>
      ) : null}

      <p className="px-1 text-[13px] leading-6 text-[#64748B]">{summary.trustLine}</p>

      {/* EVERYTHING ELSE — one disclosure */}
      <details className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-4 md:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#0D1B2A]">Planning detail and evidence</span>
          <span className="text-xs font-semibold text-[#64748B] group-open:hidden">Show</span>
          <span className="hidden text-xs font-semibold text-[#64748B] group-open:inline">
            Hide
          </span>
        </summary>

        <div className="mt-4 space-y-4">
          <Block title="Zoning statement">
            <p className="text-[13px] leading-6 text-[#0D1B2A]/78">{detection.statement}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#0D1B2A]/72">
              <span className="rounded-full border border-[#0D1B2A]/10 bg-[#F2F4F7] px-3 py-1">
                Municipality: {assessment.municipality ?? "Not identified"}
              </span>
              <span className="rounded-full border border-[#0D1B2A]/10 bg-[#F2F4F7] px-3 py-1">
                Planning area: {assessment.planningArea ?? "Not matched"}
              </span>
              {assessment.overlays.length ? (
                <span className="rounded-full border border-[#0D1B2A]/10 bg-[#F2F4F7] px-3 py-1">
                  Overlays: {assessment.overlays.join(", ")}
                </span>
              ) : null}
            </div>
          </Block>

          {/* ZONE SELECTION — manual, explicitly labelled as unconfirmed */}
          {onSelectZone && zoneOptions.length ? (
            <Block
              title="Select the zone you believe applies"
              intro="A manual selection is a working assumption. Attach a zoning certificate to strengthen it."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectZone(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                    selectedZoneCode
                      ? "border-[#0D1B2A]/12 bg-white text-[#64748B]"
                      : "border-[#FF6A00] bg-[#FF6A00]/10 text-[#0D1B2A]",
                  )}
                >
                  Not selected
                </button>
                {zoneOptions.map((zone) => (
                  <button
                    key={zone.code}
                    type="button"
                    onClick={() => onSelectZone(zone.code)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                      selectedZoneCode === zone.code
                        ? "border-[#FF6A00] bg-[#FF6A00]/10 text-[#0D1B2A]"
                        : "border-[#0D1B2A]/12 bg-white text-[#64748B]",
                    )}
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
            </Block>
          ) : null}

          {/* PUBLISHED GENERAL RULES */}
          <Block
            title="Published general rules"
            intro="The authority's published controls for the matched zone."
          >
            {publishedRules.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {publishedRules.map((rule) => {
                  const note = statusNote(rule.status);
                  return (
                    <article
                      key={rule.id}
                      className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold text-[#0D1B2A]">{rule.label}</h4>
                        <span className="rounded-full border border-[#0D1B2A]/12 bg-white px-2 py-0.5 text-xs font-bold text-[#0D1B2A]">
                          {ruleValue(rule)}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#0D1B2A]/72">
                        {rule.statement}
                      </p>
                      {rule.conditions.length ? (
                        <ul className="mt-2 space-y-1 text-[13px] leading-6 text-[#64748B]">
                          {rule.conditions.map((condition) => (
                            <li key={condition}>• {condition}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-[13px] leading-6 text-[#64748B]">
                        {rule.interpretation}
                      </p>
                      {rule.citation ? (
                        <p className="mt-2 text-[12px] text-[#64748B]">Citation: {rule.citation}</p>
                      ) : null}
                      {note ? (
                        <p className="mt-2 rounded-xl border border-[#F59E0B]/35 bg-[#FFFBEB] px-3 py-2 text-[12px] leading-5 text-[#B45309]">
                          {note}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] leading-6 text-[#64748B]">
                No published rule set is matched yet. Select a zone, or attach a zoning certificate.
              </p>
            )}
          </Block>

          {/* BUILDABLE ENVELOPE */}
          <Block
            title="Theoretical buildable envelope"
            intro="Calculated from published rules and the recorded erf extent."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Erf extent
                </div>
                <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
                  {formatAreaM2WithUnit(envelope.erfAreaM2) ?? "Area not available"}
                </div>
              </div>
              <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Theoretical ground floor
                </div>
                <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
                  {formatAreaM2WithUnit(envelope.theoreticalGroundFloorM2) ?? "Not calculable"}
                </div>
                <p className="mt-1 text-[12px] leading-5 text-[#64748B]">
                  {envelope.coveragePercent != null
                    ? `Erf extent × ${envelope.coveragePercent}% published coverage.`
                    : "No published coverage rule is matched."}
                </p>
              </div>
              <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Height limit
                </div>
                <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
                  {envelope.heightLimitM != null
                    ? `${envelope.heightLimitM} m`
                    : "Not published here"}
                </div>
              </div>
            </div>
            {envelope.setbackCalculationSkippedReason ? (
              <p className="mt-3 rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-[13px] leading-6 text-[#64748B]">
                {envelope.setbackCalculationSkippedReason}
              </p>
            ) : null}
            <p className="mt-3 text-[13px] leading-6 text-[#64748B]">{envelope.caveat}</p>
            {envelope.missingConstraints.length ? (
              <ul className="mt-2 space-y-1 text-[13px] leading-6 text-[#64748B]">
                {envelope.missingConstraints.map((item) => (
                  <li key={item}>• Not accounted for: {item}</li>
                ))}
              </ul>
            ) : null}
          </Block>

          {/* VERIFIED RIGHTS vs POSSIBLE RESTRICTIONS */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Block
              title="Verified for this erf"
              intro="Only evidence actually attached to this erf appears here."
            >
              {assessment.verifiedRights.length ? (
                <ul className="space-y-2">
                  {assessment.verifiedRights.map((right) => (
                    <li
                      key={right.id}
                      className="rounded-2xl border border-[#15803D]/25 bg-[#F0FDF4] px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-[#0D1B2A]">{right.label}</div>
                      <div className="mt-1 text-[13px] leading-6 text-[#0D1B2A]/72">
                        {right.value}
                      </div>
                      <div className="mt-1 text-[12px] text-[#15803D]">{right.evidenceLabel}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-6 text-[#64748B]">
                  Nothing property-specific has been verified yet.
                </p>
              )}
            </Block>
            <Block
              title="May restrict what is published"
              intro="Each item can reduce the published rules for this erf."
            >
              <ul className="space-y-2">
                {assessment.possibleRestrictions.map((restriction) => (
                  <li
                    key={restriction.id}
                    className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-[#0D1B2A]">{restriction.label}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#0D1B2A]/72">
                      {restriction.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </Block>
          </div>

          {/* LOCAL DESIGN GUIDELINES */}
          {assessment.guidelines.length ? (
            <Block
              title="Local design rules"
              intro="Draft and pending documents are not proved to be enforceable."
            >
              <ul className="space-y-2">
                {assessment.guidelines.map((guideline) => (
                  <li
                    key={guideline.id}
                    className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#0D1B2A]">
                        {guideline.title}
                      </span>
                      <span className="rounded-full border border-[#0D1B2A]/12 bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                        {guideline.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#0D1B2A]/72">
                      {guideline.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {/* ALL RISK FLAGS */}
          <Block title="All planning risk flags">
            <div className="grid gap-3 md:grid-cols-2">
              {assessment.riskFlags.map((flag) => (
                <article
                  key={flag.id}
                  className={cn("rounded-2xl border p-4", SEVERITY_TONE[flag.severity])}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                      {flag.severity}
                    </span>
                    <h4 className="text-sm font-semibold text-[#0D1B2A]">{flag.title}</h4>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#0D1B2A]/78">{flag.why}</p>
                  <p className="mt-2 text-[13px] font-semibold text-[#0D1B2A]">
                    Next: {flag.nextAction}
                  </p>
                </article>
              ))}
            </div>
          </Block>

          {/* EVIDENCE CHECKLIST */}
          <Block title="Evidence checklist">
            <ul className="grid gap-2 md:grid-cols-2">
              {assessment.checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#0D1B2A]">{item.label}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#64748B]">{item.detail}</div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                      CHECK_TONE[item.status],
                    )}
                  >
                    {CHECK_LABEL[item.status]}
                  </span>
                </li>
              ))}
            </ul>
          </Block>

          {/* ACTION WORKFLOW */}
          <Block title="What to do next" intro="Ranked by what most improves certainty.">
            <ol className="space-y-2">
              {assessment.actions.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm font-semibold text-[#0D1B2A]">
                      {action.order}. {action.title}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-[#64748B]">{action.detail}</div>
                  </div>
                  {onOpenTab ? (
                    <button
                      type="button"
                      onClick={() => onOpenTab(action.actionTab)}
                      className="rounded-full bg-[#FF6A00] px-4 py-1.5 text-[13px] font-semibold text-white"
                    >
                      {action.actionLabel}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </Block>

          {/* ASK EASY ERF — planning questions only, still evidence-bound */}
          {onAskEasyErf && !compact ? (
            <Block title="Ask Easy Erf about planning">
              <div className="flex flex-wrap gap-2">
                {[
                  "What is the zoning of this erf?",
                  "How much of the erf can I cover?",
                  "Can I add a second dwelling?",
                  "What planning evidence is missing?",
                ].map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onAskEasyErf(question)}
                    className="rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0D1B2A]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </Block>
          ) : null}

          {/* SOURCES */}
          <Block title="Planning sources">
            <ul className="space-y-2">
              {assessment.sources.map((source) => (
                <li
                  key={source.id}
                  className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
                >
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#0D1B2A] underline decoration-[#FF6A00]/50 underline-offset-4"
                  >
                    {source.title}
                  </a>
                  <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[#64748B]">
                    <span>Status: {source.status}</span>
                    {source.version ? <span>Version: {source.version}</span> : null}
                    <span>Last checked by Easy Erf: {source.lastVerifiedAt ?? "Not recorded"}</span>
                  </div>
                  {source.notes ? (
                    <p className="mt-1 text-[13px] leading-6 text-[#64748B]">{source.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Block>
        </div>
      </details>
    </div>
  );
}

export default ZoningBuildPanel;
