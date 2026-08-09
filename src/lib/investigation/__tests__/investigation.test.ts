import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPropertyInvestigation } from "@/lib/investigation/propertyInvestigation";
import {
  buildCanonicalNextAction,
  GUIDED_TASK_DEFINITIONS,
  selectNextGuidedTask,
} from "@/lib/investigation/guidedTaskRegistry";
import { canonicalReportAction } from "@/lib/investigation/canonicalNextAction";
import { deriveInvestigationFacts } from "@/lib/investigation/propertyInvestigation";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";

const read = (path: string) => readFileSync(path, "utf8");

function erf1570(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "parcel:erf-1570",
    sourceLabel: "Chief Surveyor-General",
    erfNumber: 1570,
    portion: 0,
    lpi: "C01900010000157000000",
    parcelKey: "C01900010000157000000",
    municipality: "Kouga",
    province: "Eastern Cape",
    suburbOrArea: "Cape St Francis",
    knownFields: [{ label: "Erf", value: "1570", source: "csg" }],
    missingFields: [],
    rawProperties: { SHAPE_Area: 619 },
    coordinates: { lng: 24.83, lat: -34.19 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    parcel: erf1570(),
    workspaceState: createEmptyErfWorkspaceState(),
    assets: [],
    savedEvidence: [],
    planning: null,
    now: new Date("2026-07-29T00:00:00Z"),
    ...overrides,
  } as Parameters<typeof buildPropertyInvestigation>[0];
}

function evidenceAsset(partial: Partial<ErfAsset>): ErfAsset {
  return {
    id: "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT",
    user_id: "user-1",
    parcel_id: "parcel:erf-1570",
    asset_category: "architectural_plan",
    asset_type: "approved_building_plan",
    source_label: "User identified as approved municipal building plans",
    storage_bucket: "erf-files",
    storage_path: "user-1/parcel:erf-1570/architectural_plan/test-fixture.pdf",
    original_file_name: "approved-plans-test-fixture.pdf",
    mime_type: "application/pdf",
    size_bytes: 1234,
    checksum_sha256: null,
    status: "uploaded_reference_only",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-07-31T08:00:00.000Z",
    updated_at: "2026-07-31T08:00:00.000Z",
    ...partial,
  };
}

function searchableSubjectAsset(
  category: ErfAsset["asset_category"],
  partial: Partial<ErfAsset> = {},
): ErfAsset {
  return evidenceAsset({
    id: `asset-${category}`,
    asset_category: category,
    asset_type: category,
    status: "ready",
    metadata: { extractionStatus: "ready", identityMatchStatus: "matched" },
    ...partial,
  });
}

function verifiedPlanningAssessment(): ParcelPlanningAssessment {
  return {
    parcelId: "parcel:erf-1570",
    municipality: "Kouga",
    planningArea: "Cape St Francis",
    registryMatched: true,
    detection: {
      method: "document_supported",
      zoneCode: "SR1",
      zoneName: "Single Residential",
      confidence: "high",
      suppliedBy: "Uploaded zoning certificate",
      supportingAssetId: "asset-zoning_document",
      statement: "Zoning certificate supports Single Residential zoning.",
    },
    zone: null,
    publishedRules: [],
    verifiedRights: [],
    possibleRestrictions: [],
    guidelines: [],
    overlays: [],
    envelope: {
      erfAreaM2: 619,
      coveragePercent: null,
      theoreticalGroundFloorM2: null,
      heightLimitM: null,
      setbackConstrainedM2: null,
      setbackCalculationSkippedReason: null,
      confidence: "high",
      missingConstraints: [],
      caveat: "Test fixture planning assessment.",
    },
    riskFlags: [],
    checklist: [],
    actions: [],
    missingEvidence: [],
    sources: [],
    permittedUseSummary: "Single residential use recorded in the test fixture.",
    headlineWarning: "Test fixture only.",
    assessedAt: "2026-07-31T08:00:00.000Z",
  };
}

function savedComparableEvidence(): SavedMarketEvidence {
  return {
    id: "market-evidence-1",
    parcelId: "parcel:erf-1570",
    sourceUrl: "https://www.property24.com/for-sale/example",
    sourcePortal: "Property24",
    title: "Comparable listing",
    askingPrice: 1500000,
    propertyType: "Vacant land",
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    savedAt: "2026-07-31T08:00:00.000Z",
    updatedAt: "2026-07-31T08:00:00.000Z",
  };
}

describe("investigation model", () => {
  it("starts an investigation from the selected parcel with identity facts, not a blank chat", () => {
    const investigation = buildPropertyInvestigation(baseInput());

    expect(investigation.parcelId).toBe("parcel:erf-1570");
    expect(investigation.identitySummary).toContain("Erf 1570");
    expect(investigation.messages.length).toBeGreaterThan(3);
    expect(investigation.messages[0].text).toBe("I identified Erf 1570 in Cape St Francis.");
    expect(investigation.messages.every((message) => message.text.trim().length > 0)).toBe(true);
  });

  it("derives stage status deterministically from recorded evidence only", () => {
    const investigation = buildPropertyInvestigation(baseInput());
    const byId = Object.fromEntries(investigation.stages.map((s) => [s.id, s]));

    expect(byId.identify.status).toBe("in_progress");
    expect(byId.planning.status).toBe("unavailable");
    expect(byId.constraints.status).toBe("waiting");
    expect(byId.market.status).toBe("waiting");
    expect(investigation.progress.totalStages).toBe(investigation.stages.length);
    expect(investigation.progress.percent).toBe(investigation.overallProgressPercent);
  });

  it("never claims zoning is verified without a supporting document", () => {
    const investigation = buildPropertyInvestigation(baseInput());
    const zoning = investigation.messages.find((message) => message.id === "msg-zoning");

    expect(zoning?.kind === "estimated" || zoning?.kind === "missing").toBe(true);
    expect(zoning?.text.toLowerCase()).not.toContain("zoning is confirmed");
  });

  it("never clears servitudes or title restrictions from absent evidence", () => {
    const investigation = buildPropertyInvestigation(baseInput());
    const constraints = investigation.messages.find((message) => message.id === "msg-constraints");

    expect(constraints?.kind).toBe("missing");
    expect(constraints?.text).toContain("have not confirmed title restrictions");
  });

  it("surfaces a recorded area conflict without inventing one", () => {
    const clean = buildPropertyInvestigation(baseInput());
    expect(clean.messages.some((message) => message.kind === "conflict")).toBe(false);

    const conflicted = buildPropertyInvestigation(
      baseInput({
        contradictions: [
          {
            id: "official-area-vs-registered-extent",
            title: "Cadastral area and registered extent differ",
            explanation: "Both figures are kept until a professional confirms which applies.",
            displayedValues: ["619 m²", "602 m²"],
            targetTab: "research",
          },
        ],
      }),
    );

    const conflict = conflicted.messages.find((message) => message.kind === "conflict");
    expect(conflict?.text).toContain("619 m²");
    expect(conflict?.text).toContain("602 m²");
    expect(conflicted.latestFindings.some((finding) => finding.status === "conflicting")).toBe(
      true,
    );
  });

  it("exposes exactly one canonical next action and progresses when it is completed", () => {
    const first = buildPropertyInvestigation(baseInput());
    expect(first.nextAction?.id).toBe("confirm-property-identity");
    expect(first.nextTask?.id).toBe(first.nextAction?.id);

    const confirmed = createEmptyErfWorkspaceState();
    confirmed.identityStatus = "looks_correct";
    const second = buildPropertyInvestigation(baseInput({ workspaceState: confirmed }));

    expect(second.nextAction?.id).not.toBe("confirm-property-identity");
    expect(second.nextTask?.id).toBe(second.nextAction?.id);
  });

  it("advances the canonical next action from recorded workspace, vault, planning and market evidence", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const actionFrom = (
      overrides: Partial<Parameters<typeof deriveInvestigationFacts>[0]> = {},
    ) => {
      const input = baseInput({
        workspaceState: workspace,
        ...overrides,
      });
      return buildCanonicalNextAction(deriveInvestigationFacts(input), [])?.id;
    };

    expect(actionFrom()).toBe("add-sg-diagram");

    const sgDiagram = searchableSubjectAsset("sg_diagram");
    expect(actionFrom({ assets: [sgDiagram] })).toBe("confirm-zoning");

    const approvedPlan = evidenceAsset({
      id: "asset-approved-plan",
      metadata: { planApprovalStatus: "verified_municipal_approval" },
    });
    const marketEvidence = savedComparableEvidence();
    expect(
      actionFrom({
        assets: [sgDiagram, approvedPlan],
        planning: verifiedPlanningAssessment(),
        savedEvidence: [marketEvidence],
      }),
    ).toBe("add-lightstone-report");

    const paidReport = searchableSubjectAsset("paid_report");
    expect(
      actionFrom({
        assets: [sgDiagram, approvedPlan, paidReport],
        planning: verifiedPlanningAssessment(),
        savedEvidence: [marketEvidence],
      }),
    ).toBe("choose-strategy");

    workspace.strategyScenarioCount = 1;
    expect(
      actionFrom({
        assets: [sgDiagram, approvedPlan, paidReport],
        planning: verifiedPlanningAssessment(),
        savedEvidence: [marketEvidence],
      }),
    ).toBe("review-site-potential");

    const facts = deriveInvestigationFacts(
      baseInput({
        workspaceState: workspace,
        assets: [
          sgDiagram,
          approvedPlan,
          paidReport,
          searchableSubjectAsset("title_deed"),
          searchableSubjectAsset("topography"),
          evidenceAsset({
            id: "asset-existing-house-photo",
            asset_category: "existing_house_photo",
          }),
        ],
        planning: verifiedPlanningAssessment(),
        savedEvidence: [marketEvidence],
      }),
    );

    expect(facts.zoningConfirmedByDocument).toBe(true);
    expect(facts.zoningRegistryPublished).toBe(true);
    expect(facts.approvedPlansOnFile).toBe(true);
    expect(facts.titleDeedSearchable).toBe(true);
    expect(facts.paidReportSearchable).toBe(true);
    expect(facts.usableTopographySurveyCount).toBe(1);
    expect(facts.existingHousePhotoCount).toBe(1);
  });

  it("lets user-confirmed readable documents advance Guided without calling them official matches", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const confirmed = (category: ErfAsset["asset_category"]) =>
      evidenceAsset({
        id: `asset-user-confirmed-${category}`,
        asset_category: category,
        asset_type: category,
        status: "ready",
        metadata: {
          extractionStatus: "partial",
          identityMatchStatus: "unverified",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: "parcel:erf-1570",
        },
      });

    const facts = deriveInvestigationFacts(
      baseInput({
        workspaceState: workspace,
        assets: [confirmed("sg_diagram"), confirmed("title_deed"), confirmed("paid_report")],
      }),
    );

    expect(facts.sgDiagramSearchable).toBe(true);
    expect(facts.titleDeedSearchable).toBe(true);
    expect(facts.paidReportSearchable).toBe(true);
    expect(facts.sgDiagramParentLineageOnly).toBe(false);
  });

  it("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT: user-identified plan files do not complete approved-plan facts", () => {
    const userIdentified = deriveInvestigationFacts(
      baseInput({
        assets: [
          evidenceAsset({
            metadata: { planApprovalStatus: "user_identified" },
          }),
        ],
      }),
    );
    const verified = deriveInvestigationFacts(
      baseInput({
        assets: [
          evidenceAsset({
            metadata: { planApprovalStatus: "verified_municipal_approval" },
          }),
        ],
      }),
    );

    expect(userIdentified.approvedPlansOnFile).toBe(false);
    expect(verified.approvedPlansOnFile).toBe(true);
  });

  it("shows the same top action in the report opening as in the investigation panel", () => {
    const input = baseInput();
    const investigation = buildPropertyInvestigation(input);
    const reportAction = canonicalReportAction(input);

    expect(reportAction?.id).toBe(`investigation-${investigation.nextAction?.id}`);
    expect(reportAction?.targetTab).toBe(investigation.nextAction?.targetTab);
    expect(reportAction?.status).toBe("open");
  });

  it("preserves the selected Guided task execution metadata for the report", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const input = baseInput({ workspaceState: workspace });
    const reportAction = canonicalReportAction(input);
    const definition = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-sg-diagram");

    expect(reportAction?.id).toBe("investigation-add-sg-diagram");
    expect(reportAction?.title).toBe(definition?.title);
    expect(reportAction?.reason).toBe(definition?.whyItMatters);
    expect(reportAction?.actionLabel).toBe(definition?.primaryActionLabel);
    expect(reportAction?.estimatedMinutes).toBe(definition?.estimatedMinutes);
    expect(reportAction?.steps).toEqual(definition?.steps);
    expect(reportAction?.sourceUrl).toBe(definition?.sourceUrl);
    expect(reportAction?.sourceLabel).toBe(definition?.sourceLabel);
    expect(reportAction?.targetAnchorId).toBe(definition?.targetAnchorId);
    expect(reportAction?.afterCompletion).toBe(definition?.afterCompletion);
    expect(reportAction?.limitations).toBe(definition?.limitations);
  });

  it("advances the report action when the SG task becomes genuinely complete", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const before = canonicalReportAction(baseInput({ workspaceState: workspace }));
    const after = canonicalReportAction(
      baseInput({
        workspaceState: workspace,
        assets: [searchableSubjectAsset("sg_diagram")],
      }),
    );

    expect(before?.id).toBe("investigation-add-sg-diagram");
    expect(after?.id).toBe("investigation-confirm-zoning");
    expect(after?.title).not.toBe(before?.title);
    expect(after?.sourceUrl).not.toBe(before?.sourceUrl);
  });

  it("only exposes a request template when the canonical task provides one", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const sgAction = canonicalReportAction(baseInput({ workspaceState: workspace }));
    const plansAction = canonicalReportAction(
      baseInput({
        workspaceState: workspace,
        assets: [searchableSubjectAsset("sg_diagram")],
        planning: verifiedPlanningAssessment(),
      }),
    );

    expect(sgAction?.requestTemplate).toBeUndefined();
    expect(plansAction?.id).toBe("investigation-add-approved-plans");
    expect(plansAction?.requestTemplate).toContain("approved building plans");
  });

  it("preserves canonical secondary sources and limitations for comparable evidence", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const action = canonicalReportAction(
      baseInput({
        workspaceState: workspace,
        assets: [
          searchableSubjectAsset("sg_diagram"),
          evidenceAsset({
            id: "asset-approved-plan",
            metadata: { planApprovalStatus: "verified_municipal_approval" },
          }),
        ],
        planning: verifiedPlanningAssessment(),
      }),
    );
    const definition = GUIDED_TASK_DEFINITIONS.find(
      (task) => task.id === "add-comparable-listing",
    );

    expect(action?.id).toBe("investigation-add-comparable-listing");
    expect(action?.extraSources).toEqual(definition?.extraSources);
    expect(action?.limitations).toBe(definition?.limitations);
  });

  it("does not mutate evidence facts, readiness or task completion while adapting the action", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.identityStatus = "looks_correct";
    const input = baseInput({ workspaceState: workspace });
    const workspaceBefore = JSON.stringify(workspace);
    const factsBefore = deriveInvestigationFacts(input);
    const taskBefore = selectNextGuidedTask(factsBefore, []);

    canonicalReportAction(input);

    const factsAfter = deriveInvestigationFacts(input);
    expect(JSON.stringify(workspace)).toBe(workspaceBefore);
    expect(factsAfter).toEqual(factsBefore);
    expect(selectNextGuidedTask(factsAfter, [])?.id).toBe(taskBefore?.id);
    expect(taskBefore?.isComplete(factsAfter)).toBe(false);
  });

  it("guides the SG diagram task with numbered steps and the public CSG source", () => {
    const sg = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-sg-diagram");

    expect(sg?.steps.length).toBeGreaterThanOrEqual(3);
    expect(sg?.sourceUrl).toContain("csg");
    expect(sg?.targetTab).toBe("research");
    expect(sg?.targetAnchorId).toBe("sg-diagram-evidence");
  });

  it("routes the comparable listing task to Market without auto-classifying a comp", () => {
    const comp = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-comparable-listing");

    expect(comp?.targetTab).toBe("listings");
    expect(comp?.sourceUrl).toContain("property24");
    expect(comp?.extraSources?.[0]?.url).toContain("privateproperty");
    expect(comp?.steps.join(" ")).toContain("Save the listing as comparable evidence");
    expect(comp?.limitations).toContain("not a valuation");
  });

  it("offers a deterministic plans request template and no payment flow", () => {
    const plans = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-approved-plans");
    const lightstone = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-lightstone-report");

    expect(plans?.requestTemplate).toContain("approved building plans");
    expect(lightstone?.canSkip).toBe(true);
    expect(lightstone?.limitations).toContain("does not verify zoning rights");
  });

  it("blocks downstream tasks while identity is uncertain", () => {
    const uncertain = createEmptyErfWorkspaceState();
    uncertain.identityStatus = "uncertain";
    const facts = deriveInvestigationFacts(baseInput({ workspaceState: uncertain }));

    expect(selectNextGuidedTask(facts, [])?.id).toBe("confirm-property-identity");
    expect(buildCanonicalNextAction(facts, [])?.id).toBe("confirm-property-identity");
  });
});

describe("investigation surface guardrails", () => {
  it("keeps the map, back-to-map control and full tool access available", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const home = read("src/components/property/investigation/InvestigationHome.tsx");

    expect(panel).toContain("<InvestigationHome");
    expect(panel).toContain("handleBackToMap");
    expect(panel).toContain("Back to full map");
    expect(home).toContain("InvestigationJourney");
    expect(home).toContain("Investigation detail and master plan");
    expect(panel).toContain("Open full research workspace");
    expect(panel).toContain("Return to guided investigation");
    expect(home).toContain("stoep-report");
    expect(home).toContain("AskEasyErfPanel");
  });

  it("renders deterministic messages instead of a blank chatbot", () => {
    const home = read("src/components/property/investigation/InvestigationHome.tsx");
    expect(home).toContain("buildGuidedInvestigationJourney");
    expect(home).toContain("buildPropertyInvestigation");
    expect(home).not.toContain("assistantMessages");
  });
});
