import { useMemo } from "react";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, MapPin, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import {
  getChosenStrategyScenario,
  readStrategyScenarios,
  readStrategyWorkspace,
} from "@/lib/workbench/erfWorkspaceState";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { readStoredPlanningZone } from "@/lib/planning/storedPlanningZone";
import { canonicalAreaM2, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { buildAskEasyErfEvidencePayload } from "@/lib/reports/askEasyErf";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import type { DossierView } from "@/components/property/dossier/reportViews";
import { buildPropertyInvestigation } from "@/lib/investigation/propertyInvestigation";
import {
  buildMasterInvestigationPlan,
  type InvestigationPlanRow,
} from "@/lib/investigation/masterPlan";
import type {
  GuidedEvidenceTask,
  InvestigationFinding,
  InvestigationStage,
} from "@/lib/investigation/types";
import { MESSAGE_TONE } from "./investigationTone";
import { GuidedEvidenceTaskCard } from "./GuidedEvidenceTaskCard";
import { InvestigationPlanTable } from "./InvestigationPlanTable";
import { ReportReadinessPanel } from "./ReportReadinessPanel";


/**
 * Investigation Home: the default screen after an erf is selected.
 *
 * It explains what Easy Erf has actually found, what is still unconfirmed, and
 * the single best next action. Every statement is derived from recorded state.
 */

export interface InvestigationHomeProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  onSelectView: (view: DossierView, options?: { anchorId?: string }) => void;
  onSkipTask?: (taskId: string) => void;
  mapSlot?: ReactNode;
}

const STAGE_TONE: Record<InvestigationStage["status"], string> = {
  complete: "border-emerald-300/40 bg-emerald-400/12 text-emerald-100",
  in_progress: "border-[#FFB86B]/40 bg-[#FF6A00]/14 text-[#FFD8B4]",
  waiting: "border-white/12 bg-white/[0.06] text-white/62",
  blocked: "border-red-300/35 bg-red-400/12 text-red-100",
  unavailable: "border-white/10 bg-white/[0.04] text-white/45",
};

const FINDING_TONE: Record<InvestigationFinding["status"], string> = {
  verified: "bg-emerald-100 text-emerald-800",
  supported: "bg-[#DCFCE7] text-[#166534]",
  estimated: "bg-[#FFFBEB] text-[#92400E]",
  user_supplied: "bg-[#E0F2FE] text-[#075985]",
  missing: "bg-[#F1F5F9] text-[#334155]",
  conflicting: "bg-[#FEE2E2] text-[#991B1B]",
};

const FINDING_LABEL: Record<InvestigationFinding["status"], string> = {
  verified: "Verified",
  supported: "Supported",
  estimated: "Approximate",
  user_supplied: "You supplied",
  missing: "Not confirmed",
  conflicting: "Needs attention",
};

export function InvestigationHome({
  parcel,
  workspaceState,
  onSelectView,
  onSkipTask,
  mapSlot,
}: InvestigationHomeProps) {
  const { assets } = useErfFileVault(parcel.id);
  const { evidence, marketAddressIntelligence } = useSavedMarketEvidence(parcel.id);

  const scenarios = useMemo(() => readStrategyScenarios(parcel.id), [parcel.id]);
  const chosenScenario = useMemo(() => getChosenStrategyScenario(parcel.id), [parcel.id]);
  const strategyWorkspace = useMemo(() => readStrategyWorkspace(parcel.id), [parcel.id]);

  const planning = useMemo(() => {
    const signals = derivePlanningEvidenceSignals(assets);
    const manualZoneCode = readStoredPlanningZone(parcel.id);
    const documentZone = signals.zoningCertificateUploaded
      ? (assets.find((asset) => asset.asset_category === "zoning_document") ?? null)
      : null;
    return buildParcelPlanningAssessment({
      parcelId: parcel.id,
      municipality: parcel.municipality ?? null,
      locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
      erfAreaM2: canonicalAreaM2(parcel.rawProperties),
      manualZoneCode,
      documentZoneCode: documentZone && manualZoneCode ? manualZoneCode : null,
      documentZoneAssetId: documentZone?.id ?? null,
      hasParcelPolygon: Boolean(parcel.rawProperties),
      evidence: signals,
    });
  }, [assets, parcel]);

  const selectedSiteDesign = useMemo(
    () =>
      assets.find((asset) => asset.id === workspaceState.sitePotential.selectedDesignAssetId) ??
      null,
    [assets, workspaceState.sitePotential.selectedDesignAssetId],
  );

  const report = useMemo(
    () =>
      buildReportViewModel({
        parcel,
        workspaceState,
        savedEvidence: evidence,
        marketAddress: marketAddressIntelligence ?? null,
        assets,
        chosenScenario,
        strategyScenarios: scenarios,
        selectedSiteDesign,
        strategyWorkspace,
      }),
    [
      assets,
      chosenScenario,
      evidence,
      marketAddressIntelligence,
      parcel,
      scenarios,
      selectedSiteDesign,
      strategyWorkspace,
      workspaceState,
    ],
  );

  const investigation = useMemo(
    () =>
      buildPropertyInvestigation({
        parcel,
        workspaceState,
        assets,
        savedEvidence: evidence,
        planning,
        scenarioCount: scenarios.length,
        chosenScenarioId: chosenScenario?.id ?? null,
        skippedTaskIds: workspaceState.investigation.skippedTaskIds,
        startedAt: workspaceState.investigation.startedAt,
        contradictions: (report.evidencePack?.contradictions ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          explanation: item.explanation,
          displayedValues: item.displayedValues,
          targetTab: item.targetTab ?? null,
        })),
      }),
    [assets, chosenScenario, evidence, parcel, planning, report, scenarios.length, workspaceState],
  );

  const plan = useMemo(
    () =>
      buildMasterInvestigationPlan({
        parcel,
        workspaceState,
        assets,
        savedEvidence: evidence,
        planning,
        scenarioCount: scenarios.length,
        chosenScenarioId: chosenScenario?.id ?? null,
        skippedTaskIds: workspaceState.investigation.skippedTaskIds,
        startedAt: workspaceState.investigation.startedAt,
        contradictions: (report.evidencePack?.contradictions ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          explanation: item.explanation,
          displayedValues: item.displayedValues,
          targetTab: item.targetTab ?? null,
        })),
      }),
    [assets, chosenScenario, evidence, parcel, planning, report, scenarios.length, workspaceState],
  );

  function runPlanRow(row: InvestigationPlanRow) {
    onSelectView(row.targetTab as DossierView, { anchorId: row.targetAnchorId });
  }


  const askPayload = useMemo(
    () =>
      buildAskEasyErfEvidencePayload({
        report,
        decision: buildDecisionIntelligence(report),
        assets,
        savedEvidence: evidence,
        strategyScenarios: scenarios,
      }),
    [assets, evidence, report, scenarios],
  );

  const areaLabel = formatAreaM2WithUnit(canonicalAreaM2(parcel.rawProperties));

  function runTask(task: GuidedEvidenceTask) {
    onSelectView(task.targetTab as DossierView, { anchorId: task.targetAnchorId });
  }

  const currentStep =
    investigation.journey.find((step) => step.current) ??
    investigation.journey[investigation.journey.length - 1];
  const rewardMessage = investigation.messages.find((message) => message.kind === "reward") ?? null;
  const supportingMessages = investigation.messages.filter((message) => message.kind !== "reward");

  const knownFindings = investigation.latestFindings.filter(
    (finding) => finding.status !== "missing",
  );
  const missingFindings = investigation.latestFindings.filter(
    (finding) => finding.status === "missing",
  );
  const topFacts = knownFindings.slice(0, 3);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* A. Identity + progress + plain-language verdict */}
      <section className="rounded-[1.5rem] border border-white/10 bg-[#0D1B2A] p-5 text-white shadow-[0_28px_70px_-40px_rgba(0,0,0,0.85)] md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
            Investigating
          </span>
          <span className="text-[13px] font-semibold text-white/70">
            Step {investigation.currentStepIndex} of {investigation.totalSteps} ·{" "}
            {investigation.overallProgressPercent}%
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          {investigation.identitySummary}
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/76 md:text-sm">
          {currentStep?.summary ?? investigation.headline}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold text-white/70">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1">
            <MapPin className="h-3.5 w-3.5" />
            {parcel.municipality ?? "Municipality not confirmed"}
          </span>
          <span className="rounded-full bg-white/[0.08] px-3 py-1">
            {areaLabel ? `${areaLabel}` : "Extent not available"}
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1",
              investigation.reportReady
                ? "bg-emerald-400/18 text-emerald-100"
                : "bg-[#FF6A00]/16 text-[#FFD8B4]",
            )}
          >
            {investigation.reportReady ? "Identity confirmed" : "Identity not confirmed"}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={investigation.overallProgressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Investigation progress"
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#FF6A00,#FFB86B)]"
            style={{ width: `${investigation.overallProgressPercent}%` }}
          />
        </div>

        {/* Compact journey: current dominates, done are ticks, future muted */}
        <ol className="mt-3 -mx-1 flex snap-x items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {investigation.journey.map((step) => {
            const done = step.status === "complete";
            return (
              <li key={step.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => onSelectView(step.targetTab as DossierView)}
                  aria-current={step.current ? "step" : undefined}
                  title={step.label}
                  className={cn(
                    "flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left transition hover:brightness-110",
                    step.current
                      ? "border-[#FF6A00] bg-[#FF6A00]/18 px-3 text-[13px] font-semibold text-white"
                      : done
                        ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-100"
                        : "border-white/10 bg-white/[0.04] text-white/45",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5" />
                  )}
                  {step.current ? (
                    <span>{step.shortLabel}</span>
                  ) : (
                    <span className="sr-only">{step.shortLabel}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* B. Reward moment for the step just completed */}
      {rewardMessage && (
        <section className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 md:px-5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p className="text-[13px] leading-6 text-[#0D1B2A]">{rewardMessage.text}</p>
          </div>
        </section>
      )}

      {/* C. The one dominant current task */}
      {investigation.nextTask ? (
        <GuidedEvidenceTaskCard
          task={investigation.nextTask}
          onPrimaryAction={runTask}
          onSkip={onSkipTask ? (task) => onSkipTask(task.id) : undefined}
        />
      ) : (
        <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-lg font-semibold tracking-tight text-[#0D1B2A]">
            Nothing left to guide
          </h3>
          <p className="mt-1 text-[13px] leading-6 text-[#0D1B2A]/70">
            Open the Easy Erf Report to review what is still unconfirmed.
          </p>
          <button
            type="button"
            onClick={() => onSelectView("stoep-report")}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-3 text-sm font-semibold text-white"
          >
            Open Easy Erf Report <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* D. The whole roadmap, always visible */}
      <InvestigationPlanTable plan={plan} onRowAction={runPlanRow} />

      {/* E. Live report preview */}
      <ReportReadinessPanel
        plan={plan}
        report={report}
        onOpenReport={() => onSelectView("stoep-report")}
      />

      {/* F. Three facts + one "still needed" line */}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-4 md:p-5">
        <h3 className="text-sm font-semibold tracking-tight text-[#0D1B2A]">What Easy Erf knows</h3>
        <ul className="mt-3 divide-y divide-[#0D1B2A]/8">
          {topFacts.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-start gap-3 py-2.5">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                  FINDING_TONE[finding.status],
                )}
              >
                {FINDING_LABEL[finding.status]}
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-semibold leading-6 text-[#0D1B2A]">
                {finding.title}
              </p>
              {finding.targetTab && (
                <button
                  type="button"
                  onClick={() => onSelectView(finding.targetTab as DossierView)}
                  className="min-h-9 shrink-0 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40"
                >
                  Open
                </button>
              )}
            </li>
          ))}
          {topFacts.length === 0 && (
            <li className="py-2.5 text-[13px] leading-6 text-[#0D1B2A]/66">
              Nothing confirmed yet. Start with the step above.
            </li>
          )}
        </ul>
        <p className="mt-3 text-[13px] leading-6 text-[#64748B]">
          Still needed: {missingFindings.length}
          {missingFindings.length > 0 ? ` — starting with ${missingFindings[0].title}.` : "."}
        </p>
      </section>

      {/* E. Compact Ask Easy Erf */}
      <AskEasyErfPanel
        compact
        maxSuggestions={3}
        suggestionPayload={askPayload}
        evidencePack={report.evidencePack ?? null}
        onSelectView={onSelectView}
      />

      {mapSlot}

      {/* F. Everything technical, collapsed by default */}
      <details className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-4 md:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <ShieldQuestion className="h-4 w-4 text-[#FF6A00]" />
            Investigation detail
          </span>
          <span className="text-xs font-semibold text-[#64748B] group-open:hidden">Show</span>
          <span className="hidden text-xs font-semibold text-[#64748B] group-open:inline">
            Hide
          </span>
        </summary>

        {supportingMessages.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-[#0D1B2A]/72">
            {supportingMessages.map((message) => (
              <li key={message.id} className="flex gap-2">
                <span
                  className={cn(
                    "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                    MESSAGE_TONE[message.kind],
                  )}
                />
                <span>
                  {message.text}
                  {message.targetTab && (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectView(message.targetTab as DossierView, {
                          anchorId: message.targetAnchorId,
                        })
                      }
                      className="ml-2 text-[12px] font-semibold text-[#B45309] underline"
                    >
                      Open
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-3 divide-y divide-[#0D1B2A]/8">
          {investigation.latestFindings.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-start gap-3 py-3">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                  FINDING_TONE[finding.status],
                )}
              >
                {FINDING_LABEL[finding.status]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#0D1B2A]">{finding.title}</p>
                <p className="mt-0.5 text-[13px] leading-6 text-[#0D1B2A]/66">{finding.body}</p>
                <p className="mt-1 text-[12px] text-[#64748B]">Source: {finding.sourceLabel}</p>
              </div>
              {finding.targetTab && (
                <button
                  type="button"
                  onClick={() => onSelectView(finding.targetTab as DossierView)}
                  className="min-h-9 shrink-0 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40"
                >
                  Open
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-[#0D1B2A]/8 pt-4">
          <p className="text-[13px] font-semibold text-[#0D1B2A]">Open investigation tools</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["research", "Property & Sources"],
                ["zoning-build", "Zoning & Build"],
                ["site-potential", "Site Potential"],
                ["listings", "Market"],
                ["reports", "Reports & Documents"],
                ["calculators", "Strategy"],
                ["notes", "Notes"],
                ["local-services", "Local Services"],
                ["stoep-report", "Easy Erf Report"],
              ] as Array<[DossierView, string]>
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => onSelectView(view)}
                className="rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff8ec]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export default InvestigationHome;
