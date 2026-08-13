import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InvestigationStepShell } from "@/components/property/investigation/InvestigationStepShell";
import {
  buildGuidedInvestigationJourney,
  selectGuidedInvestigationStep,
} from "@/lib/investigation/guidedJourney";
import type { InvestigationFacts } from "@/lib/investigation/guidedTaskRegistry";
import {
  findSupportingZoningClaim,
  isUsableSubjectZoningDocument,
  zoningClaimSupportsZone,
} from "@/lib/planning/zoningEvidence";
import type { ZoneDefinition } from "@/lib/planning/municipalityPlanningTypes";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const noop = vi.fn();

const zone: ZoneDefinition = {
  code: "RES1",
  name: "Residential Zone 1 (single residential)",
  municipality: "Kouga Local Municipality",
  permittedUses: ["Dwelling house"],
  consentUses: [],
  rules: [],
  sourceId: "kouga-land-use-scheme-2021",
  status: "manual_candidate",
  summary: "Single residential zoning.",
};

function asset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "zoning-1",
    user_id: "user-1",
    parcel_id: "parcel-1",
    asset_category: "zoning_document",
    asset_type: "zoning_certificate",
    source_label: "Municipal zoning certificate",
    storage_bucket: "erf-files",
    storage_path: "user-1/parcel-1/zoning_document/zoning-1/certificate.pdf",
    original_file_name: "zoning-certificate.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    checksum_sha256: null,
    status: "ready",
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      extractedClaims: [
        {
          domain: "planning",
          key: "zoning",
          label: "Zoning",
          value: "Residential Zone 1",
          numericValue: null,
          unit: null,
          page: 1,
          quote: "Zoning: Residential Zone 1",
          confidence: "high",
          interpretation: false,
          scope: "subject",
        },
      ],
    },
    local_migration_fingerprint: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

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
    zoningConfirmedByDocument: false,
    zoningUserConfirmed: false,
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

describe("guided zoning evidence gate", () => {
  it("matches common zoning wording to the selected registry zone", () => {
    expect(zoningClaimSupportsZone("Residential Zone 1", zone)).toBe(true);
    expect(zoningClaimSupportsZone("RES1", zone)).toBe(true);
    expect(zoningClaimSupportsZone("Business Zone 1", zone)).toBe(false);
  });

  it("requires readable, identity-matched evidence to call zoning document-backed", () => {
    const supporting = asset();
    expect(findSupportingZoningClaim(supporting, zone)?.value).toBe("Residential Zone 1");
    expect(isUsableSubjectZoningDocument(supporting, zone)).toBe(true);

    expect(
      isUsableSubjectZoningDocument(
        asset({ metadata: { ...supporting.metadata, identityMatchStatus: "mismatch" } }),
        zone,
      ),
    ).toBe(false);

    expect(
      isUsableSubjectZoningDocument(
        asset({
          metadata: {
            ...supporting.metadata,
            extractedClaims: [
              {
                domain: "planning",
                key: "zoning",
                label: "Zoning",
                value: "Business Zone 1",
                numericValue: null,
                unit: null,
                page: 1,
                quote: "Zoning: Business Zone 1",
                confidence: "high",
                interpretation: false,
                scope: "subject",
              },
            ],
          },
        }),
        zone,
      ),
    ).toBe(false);
  });

  it("requires a user-confirmed working zoning before Guided advances", () => {
    const workspace = createEmptyErfWorkspaceState();
    expect(selectGuidedInvestigationStep(facts(), workspace.investigation)).toBe("zoning");

    const selectedOnly = buildGuidedInvestigationJourney(
      facts({ zoningWorkingAssumption: true, zoningConfirmedByDocument: false }),
      workspace,
    );
    expect(selectedOnly.find((step) => step.id === "zoning")).toMatchObject({
      complete: false,
      status: "current",
    });

    const journey = buildGuidedInvestigationJourney(
      facts({ zoningUserConfirmed: true, zoningWorkingAssumption: false }),
      workspace,
    );
    expect(journey.find((step) => step.id === "zoning")).toMatchObject({
      complete: true,
      status: "complete",
    });
    expect(journey.find((step) => step.current)?.id).toBe("property-checks");
  });

  it("also advances when the selected zoning is document-backed", () => {
    const workspace = createEmptyErfWorkspaceState();
    const journey = buildGuidedInvestigationJourney(
      facts({ zoningConfirmedByDocument: true, zoningWorkingAssumption: false }),
      workspace,
    );
    expect(journey.find((step) => step.id === "zoning")?.complete).toBe(true);
    expect(journey.find((step) => step.current)?.id).toBe("property-checks");
  });

  it("renders zoning as a live step with Back and Skip but no shared bypass Continue", () => {
    const workspace = createEmptyErfWorkspaceState();
    const steps = buildGuidedInvestigationJourney(facts(), workspace);
    const zoningStep = steps.find((step) => step.id === "zoning");
    if (!zoningStep) throw new Error("Expected zoning step");

    const html = renderToStaticMarkup(
      <InvestigationStepShell
        step={zoningStep}
        steps={steps}
        onSelectStep={noop}
        onSkipStep={noop}
        onOpenExpertWorkspace={noop}
      >
        <div>Guided zoning confirmation</div>
      </InvestigationStepShell>,
    );

    expect(html).toContain("Guided zoning confirmation");
    expect(html).toContain("Back");
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("This guided action is coming in a later build phase.");
    expect(html).not.toContain(">Continue<");
  });
});
