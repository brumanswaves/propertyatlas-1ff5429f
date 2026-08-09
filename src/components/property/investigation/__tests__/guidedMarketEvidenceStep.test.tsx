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
    siteSkipped: true,
    reportStarted: false,
    ...overrides,
  };
}

describe("guided market evidence", () => {
  it("starts at market after Property checks and Site Potential are resolved", () => {
    const workspace = createEmptyErfWorkspaceState();
    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe("market");
  });

  it("marks market complete after evidence is saved and advances to Strategy", () => {
    const workspace = createEmptyErfWorkspaceState();
    const journey = buildGuidedInvestigationJourney(facts({ marketEvidenceCount: 1 }), workspace);

    expect(journey.find((step) => step.id === "market")).toMatchObject({
      complete: true,
      status: "complete",
    });
    expect(journey.find((step) => step.current)?.id).toBe("strategy");
  });

  it("renders market as a live step with Back and Skip but no bypass Continue", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const marketStep = steps.find((step) => step.id === "market");
    if (!marketStep) throw new Error("Expected market step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={marketStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided market evidence importer</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided market evidence importer");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });
});
