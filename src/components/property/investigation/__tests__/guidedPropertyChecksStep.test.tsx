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
    approvedPlansOnFile: false,
    titleDeedSearchable: true,
    paidReportSearchable: false,
    paidReportCount: 0,
    marketEvidenceCount: 0,
    marketAddressSaved: true,
    scenarioCount: 0,
    hasChosenScenario: false,
    siteConceptCount: 0,
    siteDesignSelected: false,
    usableTopographySurveyCount: 0,
    sitePhotoCount: 0,
    existingHousePhotoCount: 0,
    vendorAssignmentCount: 0,
    siteSkipped: false,
    reportStarted: false,
    ...overrides,
  };
}

describe("guided property checks", () => {
  it("starts at property checks after zoning is confirmed", () => {
    const workspace = createEmptyErfWorkspaceState();
    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe("property-checks");
  });

  it.each([
    ["approved plans", { approvedPlansOnFile: true }],
    ["matched topography", { usableTopographySurveyCount: 1 }],
    ["site photos", { sitePhotoCount: 1 }],
    ["building photos", { existingHousePhotoCount: 1 }],
  ])("completes with %s and advances to market", (_label, evidence) => {
    const workspace = createEmptyErfWorkspaceState();
    const journey = buildGuidedInvestigationJourney(facts(evidence), workspace);

    expect(journey.find((step) => step.id === "property-checks")).toMatchObject({
      complete: true,
      status: "complete",
    });
    expect(journey.find((step) => step.current)?.id).toBe("market");
  });

  it("renders property checks as a live step with no bypass Continue", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const propertyStep = steps.find((step) => step.id === "property-checks");
    if (!propertyStep) throw new Error("Expected property-checks step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={propertyStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided property evidence</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided property evidence");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });
});
