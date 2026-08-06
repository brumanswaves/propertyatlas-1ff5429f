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
