import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmPropertyStep } from "@/components/property/investigation/ConfirmPropertyStep";
import { InvestigationStepNavigator } from "@/components/property/investigation/InvestigationStepNavigator";
import { InvestigationStepShell } from "@/components/property/investigation/InvestigationStepShell";
import {
  buildGuidedInvestigationJourney,
  GUIDED_INVESTIGATION_STEPS,
} from "@/lib/investigation/guidedJourney";
import type { InvestigationFacts } from "@/lib/investigation/guidedTaskRegistry";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const noop = vi.fn();

function parcel(): NormalizedOfficialParcel {
  return {
    id: "parcel:erf-1021",
    source: "csg",
    sourceLabel: "Chief Surveyor-General",
    layer: "csg-parcels",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    objectId: 1021,
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Sea Vista",
    town: "St Francis Bay",
    coordinates: { lng: 24.82, lat: -34.16 },
    knownFields: [],
    missingFields: [],
    rawProperties: { SHAPE_Area: 713 },
  };
}

function facts(): InvestigationFacts {
  return {
    parcelId: "parcel:erf-1021",
    identityConfirmed: true,
    identityUncertain: false,
    identityChecked: true,
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
  };
}

describe("guided investigation components", () => {
  it("renders Step 1 as a direct property confirmation action", () => {
    const html = renderToStaticMarkup(
      <ConfirmPropertyStep
        parcel={parcel()}
        workspaceState={createEmptyErfWorkspaceState()}
        mapSlot={<div>Selected erf on the map</div>}
        onConfirm={noop}
        onFlagUncertain={noop}
        onBackToMap={noop}
      />,
    );

    expect(html).toContain("Confirm this is the correct erf");
    expect(html).toContain("Erf number");
    expect(html).toContain("Township / area");
    expect(html).toContain("Official source");
    expect(html).toContain("Selected erf on the map");
    expect(html).toContain("Yes, this is the correct erf");
    expect(html).toContain("This may be the wrong erf");
    expect(html).toContain("bg-[#FF6A00]");
  });

  it("shows an honest wrong-erf recovery path without routing into expert tools", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "uncertain";
    const html = renderToStaticMarkup(
      <ConfirmPropertyStep
        parcel={parcel()}
        workspaceState={workspace}
        onConfirm={noop}
        onFlagUncertain={noop}
        onBackToMap={noop}
      />,
    );

    expect(html).toContain("You marked this erf as possibly wrong.");
    expect(html).toContain("Back to map");
    expect(html).toContain("Search another property");
  });

  it("renders all eight mobile/desktop steps through the navigator", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const html = renderToStaticMarkup(
      <InvestigationStepNavigator steps={steps} onSelectStep={noop} />,
    );

    expect(html).toContain("View all steps");
    for (const step of GUIDED_INVESTIGATION_STEPS) {
      expect(html).toContain(step.shortLabel);
    }
  });

  it("treats every registered journey step as live with no preview or shared bypass", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);

    for (const step of steps) {
      const html = renderToStaticMarkup(
        <InvestigationStepShell
          step={step}
          steps={steps}
          onSelectStep={noop}
          onSkipStep={noop}
          onOpenExpertWorkspace={noop}
        >
          <div>{step.label} guided action</div>
        </InvestigationStepShell>,
      );

      expect(html).toContain(`${step.label} guided action`);
      expect(html).not.toContain("This guided action is coming in a later build phase.");
      expect(html).not.toContain("Open full research workspace");
      expect(html).not.toContain(">Continue<");
    }
  });

  it("renders Add address as a live step without a preview or bypass Continue button", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const addressStep = steps.find((step) => step.id === "add-address");
    if (!addressStep) throw new Error("Expected add-address step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={addressStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided working address form</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided working address form");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });

  it("renders SG diagram as a live step without a preview or bypass Continue button", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(
      { ...facts(), marketAddressSaved: true },
      workspace,
    );
    const sgStep = steps.find((step) => step.id === "sg-diagram");
    if (!sgStep) throw new Error("Expected sg-diagram step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={sgStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided SG diagram upload</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided SG diagram upload");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });

  it("renders title as a live step without a preview or bypass Continue button", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(
      { ...facts(), marketAddressSaved: true, sgDiagramSearchable: true },
      workspace,
    );
    const titleStep = steps.find((step) => step.id === "title");
    if (!titleStep) throw new Error("Expected title step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={titleStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided title evidence upload</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided title evidence upload");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });

  it("does not render the shared Continue control as a Step 1 bypass before confirmation", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(
      {
        ...facts(),
        identityConfirmed: false,
        identityChecked: false,
      },
      workspace,
    );
    const confirmStep = steps.find((step) => step.id === "confirm-property");
    if (!confirmStep) throw new Error("Expected confirm-property step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={confirmStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <ConfirmPropertyStep
          parcel={parcel()}
          workspaceState={workspace}
          onConfirm={noop}
          onFlagUncertain={noop}
          onBackToMap={noop}
        />
      </InvestigationStepShell>,
    );

    expect(html).toContain("Yes, this is the correct erf");
    expect(html).not.toContain("Continue");
  });
});
