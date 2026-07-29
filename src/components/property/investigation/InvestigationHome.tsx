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
import { readStoredPlanningZone } from "@/components/property/dossier/ZoningBuildTab";
import { canonicalAreaM2, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { buildAskEasyErfEvidencePayload } from "@/lib/reports/askEasyErf";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import type { DossierView } from "@/components/property/dossier/reportViews";
import { buildPropertyInvestigation } from "@/lib/investigation/propertyInvestigation";
import type {
  GuidedEvidenceTask,
  InvestigationFinding,
  InvestigationStage,
} from "@/lib/investigation/types";
import { GuidedEvidenceTaskCard } from "./GuidedEvidenceTaskCard";

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
      }),
    [assets, chosenScenario, evidence, parcel, planning, scenarios.length, workspaceState],
  );

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

  return (
    <div className="space-y-5">
      {/* A. Compact identity header */}
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/90 px-5 py-4 shadow-[0_18px_45px_-38px_rgba(13,27,42,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Investigating
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-[#0D1B2A] md:text-2xl">
              {investigation.identitySummary}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[#0D1B2A]/70">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-1">
                <MapPin className="h-3 w-3" />
                {parcel.municipality ?? "Municipality not confirmed"}
              </span>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1">
                {areaLabel ? `${areaLabel} recorded extent` : "Extent not available"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  investigation.reportReady
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-[#FFFBEB] text-[#92400E]",
                )}
              >
                {investigation.reportReady ? "Identity confirmed" : "Identity not confirmed"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* B. Investigation hero */}
      <section className="rounded-[1.75rem] border border-white/10 bg-[#0D1B2A] p-5 text-white shadow-[0_28px_70px_-40px_rgba(0,0,0,0.85)] md:p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
          Easy Erf investigation
        </div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {investigation.headline}
        </h3>
        <ul className="mt-3 max-w-3xl space-y-1.5 text-sm leading-6 text-white/74">
          {investigation.assistantMessages.map((message) => (
            <li key={message} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8A33]" />
              <span>{message}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-white/62">
            <span>Investigation progress</span>
            <span>{investigation.overallProgressPercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={investigation.overallProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Investigation progress"
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#FF6A00,#FFB86B)]"
              style={{ width: `${investigation.overallProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {investigation.stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectView(stage.targetTab as DossierView)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-left transition hover:brightness-110",
                STAGE_TONE[stage.status],
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                {stage.status === "complete" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <CircleDashed className="h-3.5 w-3.5" />
                )}
                {stage.label}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-80">{stage.summary}</p>
            </button>
          ))}
        </div>
      </section>

      {/* C. Latest findings */}
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-5 shadow-[0_18px_45px_-38px_rgba(13,27,42,0.4)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
          Latest findings
        </div>
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
                <p className="text-sm font-semibold text-[#0D1B2A]">{finding.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-[#0D1B2A]/66">{finding.body}</p>
                <p className="mt-1 text-[11px] text-[#64748B]">Source: {finding.sourceLabel}</p>
              </div>
              {finding.targetTab && (
                <button
                  type="button"
                  onClick={() => onSelectView(finding.targetTab as DossierView)}
                  className="shrink-0 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40"
                >
                  Open
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* D. One guided evidence task */}
      {investigation.nextTask ? (
        <GuidedEvidenceTaskCard
          task={investigation.nextTask}
          onPrimaryAction={runTask}
          onSkip={onSkipTask ? (task) => onSkipTask(task.id) : undefined}
        />
      ) : (
        <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-lg font-semibold tracking-tight text-[#0D1B2A]">
            No outstanding guided task
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            Everything Easy Erf can guide you through for this erf has been completed or skipped.
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

      {/* E. Compact Ask Easy Erf */}
      <AskEasyErfPanel
        compact
        maxSuggestions={3}
        suggestionPayload={askPayload}
        evidencePack={report.evidencePack ?? null}
        onSelectView={onSelectView}
      />

      {mapSlot}

      {/* F. Advanced tools disclosure */}
      <details className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/88 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <ShieldQuestion className="h-4 w-4 text-[#FF6A00]" />
            Open investigation tools
          </span>
          <span className="text-xs font-semibold text-[#64748B] group-open:hidden">Show</span>
          <span className="hidden text-xs font-semibold text-[#64748B] group-open:inline">
            Hide
          </span>
        </summary>
        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/62">
          Every tool stays available. Use these directly when you already know what you are looking
          for.
        </p>
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
              className="rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff8ec]"
            >
              {label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export default InvestigationHome;
