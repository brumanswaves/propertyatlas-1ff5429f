import { describe, expect, it } from "vitest";
import {
  buildGuidedInvestigationJourney,
  GUIDED_IDENTITY_CONFIRMATION_SUCCESS_MESSAGE,
  GUIDED_INVESTIGATION_STEPS,
  selectGuidedInvestigationStep,
  type GuidedInvestigationStepId,
} from "@/lib/investigation/guidedJourney";
import type { InvestigationFacts } from "@/lib/investigation/guidedTaskRegistry";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function facts(overrides: Partial<InvestigationFacts> = {}): InvestigationFacts {
  return {
    parcelId: "parcel-1",
    identityConfirmed: false,
    identityUncertain: false,
    identityChecked: false,
    hasOfficialParcelKey: true,
    hasAreaEvidence: true,
    sgDiagramSearchable: false,
    sgDiagramParentLineageOnly: false,
    sgDiagramCount: 0,
    usableSubjectSgDiagramCount: 0,
    zoningConfirmedByDocument: false,
    zoningRegistryPublished: false,
    zoningWorkingAssumption: false,
    approvedPlansOnFile: false,
    titleDeedSearchable: false,
    paidReportSearchable: false,
    paidReportCount: 0,
    marketEvidenceCount: 0,
    marketAddressSaved: false,
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

describe("guided investigation journey registry", () => {
  it("defines the approved eight-step Phase 1 order", () => {
    expect(GUIDED_INVESTIGATION_STEPS.map((step) => step.id)).toEqual([
      "confirm-property",
      "add-address",
      "sg-diagram",
      "title",
      "zoning",
      "property-checks",
      "market",
      "report",
    ]);
    expect(GUIDED_INVESTIGATION_STEPS).toHaveLength(8);
    expect(GUIDED_INVESTIGATION_STEPS[0]).toMatchObject({
      id: "confirm-property",
      canSkip: false,
    });
  });

  it("starts at confirm-property and advances to add-address after identity confirmation", () => {
    const workspace = createEmptyErfWorkspaceState();

    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe(
      "confirm-property",
    );
    expect(
      selectGuidedInvestigationStep(
        facts({ identityConfirmed: true, identityChecked: true }),
        workspace.investigation,
      ),
    ).toBe("add-address");
  });

  it("uses Add address, not Market, as the guided identity confirmation next step", () => {
    expect(GUIDED_IDENTITY_CONFIRMATION_SUCCESS_MESSAGE).toContain("Add address");
    expect(GUIDED_IDENTITY_CONFIRMATION_SUCCESS_MESSAGE).not.toMatch(/\bmarket\b/i);
  });

  it("keeps skipped distinct from complete and recommends the next unskipped step", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.investigation.skippedStepIds = ["add-address"];
    const journey = buildGuidedInvestigationJourney(
      facts({ identityConfirmed: true, identityChecked: true }),
      workspace,
    );

    expect(journey.find((step) => step.id === "add-address")).toMatchObject({
      skipped: true,
      complete: false,
      status: "skipped",
    });
    expect(journey.find((step) => step.current)?.id).toBe("sg-diagram");
  });

  it("respects intentional revisits without using the last expert tab as guided resume state", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.investigation.currentStepId = "market";
    workspace.investigation.intentionallyVisitedStepIds = ["market"];
    workspace.investigation.expertWorkspaceOpen = true;
    workspace.investigation.lastExpertView = "calculators";

    expect(
      selectGuidedInvestigationStep(
        facts({ identityConfirmed: true, identityChecked: true }),
        workspace.investigation,
      ),
    ).toBe("market");

    workspace.investigation.currentStepId = null;
    workspace.investigation.intentionallyVisitedStepIds = [];
    expect(
      selectGuidedInvestigationStep(
        facts({ identityConfirmed: true, identityChecked: true }),
        workspace.investigation,
      ),
    ).toBe("add-address");
  });

  it("allows backward navigation to a completed earlier step", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.investigation.currentStepId = "confirm-property";
    workspace.investigation.intentionallyVisitedStepIds = ["confirm-property"];
    const confirmedFacts = facts({ identityConfirmed: true, identityChecked: true });

    expect(selectGuidedInvestigationStep(confirmedFacts, workspace.investigation)).toBe(
      "confirm-property",
    );

    const journey = buildGuidedInvestigationJourney(confirmedFacts, workspace);
    expect(journey.find((step) => step.id === "confirm-property")).toMatchObject({
      complete: true,
      current: true,
    });
    expect(journey.find((step) => step.id === "add-address")?.current).toBe(false);
  });

  it("only allows known step ids to drive the current step", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.investigation.currentStepId = "research" as GuidedInvestigationStepId;
    workspace.investigation.intentionallyVisitedStepIds = ["research"];

    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe(
      "confirm-property",
    );
  });
});
