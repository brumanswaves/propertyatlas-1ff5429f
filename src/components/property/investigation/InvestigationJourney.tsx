import type { ReactNode } from "react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { MasterInvestigationPlan } from "@/lib/investigation/masterPlan";
import type { ReportViewModel } from "@/lib/reports/buildReportViewModel";
import type {
  GuidedInvestigationStep,
  GuidedInvestigationStepId,
} from "@/lib/investigation/guidedJourney";
import type { DossierView } from "@/components/property/dossier/reportViews";
import { AddAddressStep } from "./AddAddressStep";
import { ConfirmPropertyStep } from "./ConfirmPropertyStep";
import { ExpertWorkspaceLauncher } from "./ExpertWorkspaceLauncher";
import { GuidedMarketEvidenceStep } from "./GuidedMarketEvidenceStep";
import { GuidedPropertyChecksStep } from "./GuidedPropertyChecksStep";
import { GuidedReportStep } from "./GuidedReportStep";
import { GuidedSgDiagramStep } from "./GuidedSgDiagramStep";
import { GuidedSitePotentialStep } from "./GuidedSitePotentialStep";
import { GuidedTitleStep } from "./GuidedTitleStep";
import { GuidedZoningStep } from "./GuidedZoningStep";
import { InvestigationProgress } from "./InvestigationProgress";
import { InvestigationStepNavigator } from "./InvestigationStepNavigator";
import { InvestigationStepShell } from "./InvestigationStepShell";

interface InvestigationJourneyProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  plan: MasterInvestigationPlan;
  report: ReportViewModel;
  steps: GuidedInvestigationStep[];
  activeStep: GuidedInvestigationStep;
  mapSlot?: ReactNode;
  onConfirmIdentity: () => void;
  onFlagIdentityUncertain: () => void;
  onBackToMap: () => void;
  onSelectStep: (stepId: GuidedInvestigationStepId) => void;
  onSkipStep: (stepId: GuidedInvestigationStepId) => void;
  onOpenExpertWorkspace: (view?: DossierView) => void;
}

export function InvestigationJourney({
  parcel,
  workspaceState,
  plan,
  report,
  steps,
  activeStep,
  mapSlot,
  onConfirmIdentity,
  onFlagIdentityUncertain,
  onBackToMap,
  onSelectStep,
  onSkipStep,
  onOpenExpertWorkspace,
}: InvestigationJourneyProps) {
  return (
    <div className="space-y-4 md:space-y-5">
      <InvestigationProgress steps={steps} />
      <InvestigationStepNavigator steps={steps} onSelectStep={onSelectStep} />
      <InvestigationStepShell
        step={activeStep}
        steps={steps}
        onSelectStep={onSelectStep}
        onSkipStep={onSkipStep}
        onOpenExpertWorkspace={onOpenExpertWorkspace}
      >
        {activeStep.id === "confirm-property" ? (
          <ConfirmPropertyStep
            parcel={parcel}
            workspaceState={workspaceState}
            mapSlot={mapSlot}
            onConfirm={onConfirmIdentity}
            onFlagUncertain={onFlagIdentityUncertain}
            onBackToMap={onBackToMap}
          />
        ) : activeStep.id === "add-address" ? (
          <AddAddressStep parcel={parcel} onContinue={() => onSelectStep("sg-diagram")} />
        ) : activeStep.id === "sg-diagram" ? (
          <GuidedSgDiagramStep parcel={parcel} onContinue={() => onSelectStep("title")} />
        ) : activeStep.id === "title" ? (
          <GuidedTitleStep
            parcel={parcel}
            onContinue={() => onSelectStep("zoning")}
            onOpenPaidReports={() => onOpenExpertWorkspace("reports")}
          />
        ) : activeStep.id === "zoning" ? (
          <GuidedZoningStep parcel={parcel} onContinue={() => onSelectStep("property-checks")} />
        ) : activeStep.id === "property-checks" ? (
          <GuidedPropertyChecksStep
            parcel={parcel}
            onContinue={() => onSelectStep("site-potential")}
          />
        ) : activeStep.id === "site-potential" ? (
          <GuidedSitePotentialStep
            workspaceState={workspaceState}
            onOpenSitePotential={() => onOpenExpertWorkspace("site-potential")}
            onContinue={() => onSelectStep("market")}
          />
        ) : activeStep.id === "market" ? (
          <GuidedMarketEvidenceStep parcel={parcel} onContinue={() => onSelectStep("report")} />
        ) : activeStep.id === "report" ? (
          <GuidedReportStep
            plan={plan}
            report={report}
            onOpenReport={() => onOpenExpertWorkspace("stoep-report")}
          />
        ) : null}
      </InvestigationStepShell>
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white/82 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#0D1B2A]">
              Need the expert tools?
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/62">
              Existing Sources, Market, Strategy, Documents, Site Potential and Report workspaces
              are still available, but they are no longer the default path.
            </p>
          </div>
          <ExpertWorkspaceLauncher onOpenExpertWorkspace={onOpenExpertWorkspace} />
        </div>
      </section>
    </div>
  );
}

export default InvestigationJourney;
