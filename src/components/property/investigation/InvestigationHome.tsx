import { useMemo } from "react";
import type { ReactNode } from "react";
import { ShieldQuestion } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import {
  getChosenStrategyScenario,
  readStrategyScenarios,
  readStrategyWorkspace,
} from "@/lib/workbench/erfWorkspaceState";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import { selectedMarketAddress } from "@/features/marketEvidence/addressIntelligence";
import { useVendorWorkspace } from "@/lib/vendors/useVendorWorkspace";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import {
  findMunicipalityPlanningRegistry,
  findZone,
} from "@/lib/planning/municipalityPlanningRegistry";
import { readStoredPlanningZone } from "@/lib/planning/storedPlanningZone";
import { isUsableSubjectZoningDocument } from "@/lib/planning/zoningEvidence";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { buildAskEasyErfEvidencePayload } from "@/lib/reports/askEasyErf";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import { canonicalReportAction } from "@/lib/investigation/canonicalNextAction";
import type { DossierView } from "@/components/property/dossier/reportViews";
import {
  buildPropertyInvestigation,
  deriveInvestigationFacts,
  type BuildPropertyInvestigationInput,
} from "@/lib/investigation/propertyInvestigation";
import {
  buildMasterInvestigationPlan,
  type InvestigationPlanRow,
} from "@/lib/investigation/masterPlan";
import type { GuidedInvestigationStepId } from "@/lib/investigation/guidedJourney";
import {
  buildGuidedInvestigationJourney,
  selectGuidedInvestigationStep,
} from "@/lib/investigation/guidedJourney";
import { InvestigationJourney } from "./InvestigationJourney";
import { InvestigationPlanTable } from "./InvestigationPlanTable";
import { ReportReadinessPanel } from "./ReportReadinessPanel";

export interface InvestigationHomeProps {
  parcel: NormalizedOfficialParcel;
  userId: string | null;
  workspaceState: ErfWorkspaceState;
  onConfirmIdentity: () => void;
  onFlagIdentityUncertain: () => void;
  onSelectGuidedStep: (stepId: GuidedInvestigationStepId) => void;
  onSkipGuidedStep: (stepId: GuidedInvestigationStepId) => void;
  onOpenExpertWorkspace: (
    view?: DossierView,
    options?: { anchorId?: string; guidedReturnStepId?: "strategy" | "site-potential" },
  ) => void;
  onBackToMap: () => void;
  mapSlot?: ReactNode;
}

export function InvestigationHome({
  parcel,
  userId,
  workspaceState,
  onConfirmIdentity,
  onFlagIdentityUncertain,
  onSelectGuidedStep,
  onSkipGuidedStep,
  onOpenExpertWorkspace,
  onBackToMap,
  mapSlot,
}: InvestigationHomeProps) {
  const { assets } = useErfFileVault(parcel.id);
  const { evidence, marketAddressIntelligence, propertyIdentity } = useSavedMarketEvidence(
    parcel.id,
  );
  const vendorWorkspace = useVendorWorkspace(parcel.id);

  const scenarios = useMemo(
    () => readStrategyScenarios(parcel.id, undefined, userId),
    [parcel.id, userId],
  );
  const chosenScenario = useMemo(
    () => getChosenStrategyScenario(parcel.id, undefined, userId),
    [parcel.id, userId],
  );
  const strategyWorkspace = useMemo(
    () => readStrategyWorkspace(parcel.id, undefined, userId),
    [parcel.id, userId],
  );
  const savedMarketAddress = useMemo(
    () => selectedMarketAddress(marketAddressIntelligence),
    [marketAddressIntelligence],
  );

  const planning = useMemo(() => {
    const manualZoneCode = readStoredPlanningZone(parcel.id, userId);
    const registry = findMunicipalityPlanningRegistry(parcel.municipality ?? null);
    const selectedZone = registry ? findZone(registry, manualZoneCode) : null;
    const documentZone = selectedZone
      ? (assets.find((asset) => isUsableSubjectZoningDocument(asset, selectedZone)) ?? null)
      : null;
    const signals = derivePlanningEvidenceSignals(assets, {
      zoningCertificateUploaded: Boolean(documentZone),
    });

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
  }, [assets, parcel, userId]);

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
        planningAssessment: planning,
      }),
    [
      assets,
      chosenScenario,
      evidence,
      marketAddressIntelligence,
      parcel,
      planning,
      scenarios,
      selectedSiteDesign,
      strategyWorkspace,
      workspaceState,
    ],
  );

  const investigationInput = useMemo<BuildPropertyInvestigationInput>(
    () => ({
      parcel,
      workspaceState,
      assets,
      savedEvidence: evidence,
      planning,
      scenarioCount: scenarios.length,
      chosenScenarioId: chosenScenario?.id ?? null,
      vendorAssignmentCount: vendorWorkspace.loading ? 0 : vendorWorkspace.assignments.length,
      marketAddressLine: savedMarketAddress?.formattedAddress ?? propertyIdentity?.address ?? null,
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
    [
      assets,
      chosenScenario,
      evidence,
      parcel,
      planning,
      propertyIdentity?.address,
      report.evidencePack?.contradictions,
      savedMarketAddress?.formattedAddress,
      scenarios.length,
      vendorWorkspace.assignments.length,
      vendorWorkspace.loading,
      workspaceState,
    ],
  );

  const facts = useMemo(() => deriveInvestigationFacts(investigationInput), [investigationInput]);
  const guidedSteps = useMemo(
    () => buildGuidedInvestigationJourney(facts, workspaceState),
    [facts, workspaceState],
  );
  const activeStepId = selectGuidedInvestigationStep(facts, workspaceState.investigation);
  const activeStep =
    guidedSteps.find((step) => step.id === activeStepId) ??
    guidedSteps.find((step) => step.current) ??
    guidedSteps[0];

  const investigation = useMemo(
    () => buildPropertyInvestigation(investigationInput),
    [investigationInput],
  );

  const plan = useMemo(
    () => buildMasterInvestigationPlan(investigationInput),
    [investigationInput],
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
  const canonicalNextAction = useMemo(
    () => canonicalReportAction(investigationInput),
    [investigationInput],
  );

  function openPlanRow(row: InvestigationPlanRow) {
    onOpenExpertWorkspace(row.targetTab as DossierView, { anchorId: row.targetAnchorId });
  }

  return (
    <div className="space-y-4 md:space-y-5">
        <InvestigationJourney
          parcel={parcel}
          userId={userId}
        workspaceState={workspaceState}
        plan={plan}
        report={report}
        chosenScenario={chosenScenario}
        savedScenarioCount={scenarios.length}
        steps={guidedSteps}
        activeStep={activeStep}
        mapSlot={mapSlot}
        onConfirmIdentity={onConfirmIdentity}
        onFlagIdentityUncertain={onFlagIdentityUncertain}
        onBackToMap={onBackToMap}
        onSelectStep={onSelectGuidedStep}
        onSkipStep={onSkipGuidedStep}
        onOpenExpertWorkspace={onOpenExpertWorkspace}
      />

      <details className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/90 p-4 md:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <ShieldQuestion className="h-4 w-4 text-[#FF6A00]" />
            Investigation detail and master plan
          </span>
          <span className="text-xs font-semibold text-[#64748B] group-open:hidden">Show</span>
          <span className="hidden text-xs font-semibold text-[#64748B] group-open:inline">
            Hide
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-[#0D1B2A]/66">
            The full plan remains available as a reference. Opening a row uses the expert workspace
            and does not overwrite the guided resume step.
          </p>
          <InvestigationPlanTable plan={plan} onRowAction={openPlanRow} />
          <ReportReadinessPanel
            plan={plan}
            report={report}
            onOpenReport={() => onOpenExpertWorkspace("stoep-report")}
          />
          <AskEasyErfPanel
            compact
            maxSuggestions={3}
            suggestionPayload={askPayload}
            evidencePack={report.evidencePack ?? null}
            canonicalNextAction={canonicalNextAction}
            onSelectView={(view, options) => onOpenExpertWorkspace(view, options)}
          />
          <div className="rounded-[1rem] border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3 text-sm leading-6 text-[#0D1B2A]/66">
            Current legacy investigation status: {investigation.headline}. The guided journey above
            is the normal user path; this detail area is secondary.
          </div>
        </div>
      </details>
    </div>
  );
}

export default InvestigationHome;
