import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InvestigationStepShell } from "@/components/property/investigation/InvestigationStepShell";
import {
  buildGuidedInvestigationJourney,
  selectGuidedInvestigationStep,
} from "@/lib/investigation/guidedJourney";
import type { InvestigationFacts } from "@/lib/investigation/guidedTaskRegistry";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const noop = vi.fn();

function facts(overrides: Partial<InvestigationFacts> = {}): InvestigationFacts {
  return {
    parcelId: "parcel-1",
    identityConfirmed: true,
    identityUncertain: false,
    identityChecked: true,
    hasOfficialParcelKey: true,
    hasAreaEvidence: true,
    sgDiagramSearchable: true,
    sgDiagramParentLineageOnly: false,
    sgDiagramCount: 1,
    usableSubjectSgDiagramCount: 1,
    zoningConfirmedByDocument: true,
    zoningRegistryPublished: true,
    zoningWorkingAssumption: false,
    approvedPlansOnFile: true,
    titleDeedSearchable: true,
    paidReportSearchable: false,
    paidReportCount: 0,
    marketEvidenceCount: 1,
    marketAddressSaved: true,
    scenarioCount: 1,
    hasChosenScenario: false,
    sitePotentialAccepted: false,
    usableTopographySurveyCount: 0,
    sitePhotoCount: 0,
    existingHousePhotoCount: 0,
    vendorAssignmentCount: 0,
    siteSkipped: true,
    reportStarted: false,
    ...overrides,
  };
}

describe("guided report review", () => {
  it("starts at report after Site Potential and market evidence are resolved", () => {
    const workspace = createEmptyErfWorkspaceState();
    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe("report");
  });

  it("marks the final step complete after the report is opened", () => {
    const workspace = createEmptyErfWorkspaceState();
    const journey = buildGuidedInvestigationJourney(facts({ reportStarted: true }), workspace);

    expect(journey.find((step) => step.id === "report")).toMatchObject({
      complete: true,
      status: "complete",
    });
    expect(journey.every((step) => step.complete)).toBe(true);
  });

  it("renders report as a live final step with Back and no preview or skip", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const reportStep = steps.find((step) => step.id === "report");
    if (!reportStep) throw new Error("Expected report step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={reportStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided report readiness</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided report readiness");
    expect(html).toContain("Back");
    expect(html).not.toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });
});
