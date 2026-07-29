import { cn } from "@/lib/utils";
import { formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import type {
  ParcelPlanningAssessment,
  PlanningChecklistStatus,
  PlanningRiskSeverity,
  ZoningRule,
} from "@/lib/planning/municipalityPlanningTypes";

/**
 * Zoning & Build presentation.
 *
 * Trust separation is visible, not implied: published general rules, verified
 * parcel rights, possible restrictions and missing evidence each have their own
 * block and their own wording. Nothing here says an erf *can* be built to a
 * published control.
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
  tone = "light",
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <section
      className={cn(
        "rounded-[1.5rem] border p-5",
        tone === "dark"
          ? "border-white/10 bg-[#0D1B2A] text-white"
          : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A]",
      )}
    >
      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#FF6A00]">{title}</h3>
      {intro ? (
        <p
          className={cn(
            "mt-2 text-xs leading-5",
            tone === "dark" ? "text-white/68" : "text-[#64748B]",
          )}
        >
          {intro}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
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

  return (
    <div className="space-y-5">
      {/* HEADLINE — always leads with the trust boundary */}
      <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-[#0D1B2A] p-6 text-white">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
          Zoning &amp; Build
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {detection.zoneName ?? "Zoning not confirmed for this erf"}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78">{detection.statement}</p>
        <p className="mt-3 max-w-3xl rounded-2xl border border-[#FF6A00]/35 bg-[#FF6A00]/10 px-4 py-3 text-xs leading-5 text-white/85">
          {assessment.headlineWarning}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">
            Municipality: {assessment.municipality ?? "Not identified"}
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">
            Planning area: {assessment.planningArea ?? "Not matched"}
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">
            Zoning source: {detection.suppliedBy}
          </span>
        </div>
      </section>

      {/* ZONE SELECTION — manual, explicitly labelled as unconfirmed */}
      {onSelectZone && zoneOptions.length ? (
        <Block
          title="Select the zone you believe applies"
          intro="Easy Erf has no confirmed official zoning polygon service for this municipality, so a manual selection is a working assumption only. Attach a zoning certificate to strengthen it."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectZone(null)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
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
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
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
        intro="These are the authority's published controls for the matched zone. They are not confirmed rights for this erf."
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
                  <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/72">{rule.statement}</p>
                  {rule.conditions.length ? (
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-[#64748B]">
                      {rule.conditions.map((condition) => (
                        <li key={condition}>• {condition}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 text-[#64748B]">{rule.interpretation}</p>
                  {rule.citation ? (
                    <p className="mt-2 text-[11px] text-[#64748B]">Citation: {rule.citation}</p>
                  ) : null}
                  {note ? (
                    <p className="mt-2 rounded-xl border border-[#F59E0B]/35 bg-[#FFFBEB] px-3 py-2 text-[11px] leading-4 text-[#B45309]">
                      {note}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#64748B]">
            No published rule set is matched for this erf yet. Select a zone, or attach a zoning
            certificate.
          </p>
        )}
      </Block>

      {/* BUILDABLE ENVELOPE */}
      <Block
        title="Theoretical buildable envelope"
        intro="A calculation from the published rules and the recorded erf extent. It is not an approval, a design, or a confirmed right."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Erf extent
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
              {formatAreaM2WithUnit(envelope.erfAreaM2) ?? "Area not available"}
            </div>
          </div>
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Theoretical ground floor
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
              {formatAreaM2WithUnit(envelope.theoreticalGroundFloorM2) ?? "Not calculable"}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#64748B]">
              {envelope.coveragePercent != null
                ? `Erf extent × ${envelope.coveragePercent}% published coverage.`
                : "No published coverage rule is matched."}
            </p>
          </div>
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Height limit
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0D1B2A]">
              {envelope.heightLimitM != null ? `${envelope.heightLimitM} m` : "Not published here"}
            </div>
          </div>
        </div>
        {envelope.setbackCalculationSkippedReason ? (
          <p className="mt-3 rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-xs leading-5 text-[#64748B]">
            {envelope.setbackCalculationSkippedReason}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-[#64748B]">{envelope.caveat}</p>
        {envelope.missingConstraints.length ? (
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[#64748B]">
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
                  <div className="mt-1 text-xs leading-5 text-[#0D1B2A]/72">{right.value}</div>
                  <div className="mt-1 text-[11px] text-[#15803D]">{right.evidenceLabel}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-[#64748B]">
              Nothing property-specific has been verified yet. Published rules above remain general.
            </p>
          )}
        </Block>
        <Block
          title="May restrict what is published"
          intro="Each item can reduce the published rules for this specific erf."
        >
          <ul className="space-y-2">
            {assessment.possibleRestrictions.map((restriction) => (
              <li
                key={restriction.id}
                className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F2F4F7] px-4 py-3"
              >
                <div className="text-sm font-semibold text-[#0D1B2A]">{restriction.label}</div>
                <div className="mt-1 text-xs leading-5 text-[#0D1B2A]/72">{restriction.detail}</div>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      {/* LOCAL DESIGN GUIDELINES */}
      {assessment.guidelines.length ? (
        <Block
          title="Local design rules"
          intro="Design documents matched to this planning area. Draft and pending documents are not proved to be enforceable."
        >
          <ul className="space-y-2">
            {assessment.guidelines.map((guideline) => (
              <li
                key={guideline.id}
                className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#0D1B2A]">{guideline.title}</span>
                  <span className="rounded-full border border-[#0D1B2A]/12 bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                    {guideline.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/72">{guideline.summary}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {/* RISK FLAGS */}
      <Block
        title="Planning risk flags"
        intro="Each flag states why it exists and what to do next."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {assessment.riskFlags.map((flag) => (
            <article
              key={flag.id}
              className={cn("rounded-2xl border p-4", SEVERITY_TONE[flag.severity])}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]">
                  {flag.severity}
                </span>
                <h4 className="text-sm font-semibold text-[#0D1B2A]">{flag.title}</h4>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/78">{flag.why}</p>
              <p className="mt-2 text-xs font-semibold text-[#0D1B2A]">Next: {flag.nextAction}</p>
            </article>
          ))}
        </div>
      </Block>

      {/* EVIDENCE CHECKLIST */}
      <Block
        title="Evidence checklist"
        intro="Where this erf actually stands on each planning input."
      >
        <ul className="grid gap-2 md:grid-cols-2">
          {assessment.checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-[#0D1B2A]">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-[#64748B]">{item.detail}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
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
      <Block
        title="What to do next"
        intro="Ranked by what most improves certainty about what may be built here."
      >
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
                <div className="mt-1 text-xs leading-5 text-[#64748B]">{action.detail}</div>
              </div>
              {onOpenTab ? (
                <button
                  type="button"
                  onClick={() => onOpenTab(action.actionTab)}
                  className="rounded-full bg-[#FF6A00] px-4 py-1.5 text-xs font-semibold text-white"
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
        <Block
          title="Ask Easy Erf about planning"
          intro="Answers stay bound to the evidence attached to this erf. Published rules are answered as published rules, never as confirmed rights."
        >
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
                className="rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
              >
                {question}
              </button>
            ))}
          </div>
        </Block>
      ) : null}

      {/* SOURCES */}
      <Block
        title="Planning sources"
        intro="Official documents this assessment is matched against."
      >
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
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#64748B]">
                <span>Status: {source.status}</span>
                {source.version ? <span>Version: {source.version}</span> : null}
                <span>Last checked by Easy Erf: {source.lastVerifiedAt ?? "Not recorded"}</span>
              </div>
              {source.notes ? (
                <p className="mt-1 text-xs leading-5 text-[#64748B]">{source.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}

export default ZoningBuildPanel;
