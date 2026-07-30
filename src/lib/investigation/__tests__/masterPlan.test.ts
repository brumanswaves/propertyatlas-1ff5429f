import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import {
  buildMasterInvestigationPlan,
  calculatePlanReadiness,
  type InvestigationPlanRow,
} from "../masterPlan";
import type { BuildPropertyInvestigationInput } from "../propertyInvestigation";

const parcel = {
  id: "erf-1570",
  erfNumber: "1570",
  portion: "0",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  town: "Jeffreys Bay",
  suburbOrArea: "Wavecrest",
  rawProperties: { extent: 619 },
  knownFields: [],
  missingFields: [],
} as unknown as NormalizedOfficialParcel;

function makeInput(
  overrides: Partial<BuildPropertyInvestigationInput> = {},
): BuildPropertyInvestigationInput {
  const workspaceState = createEmptyErfWorkspaceState();
  return {
    parcel,
    workspaceState,
    assets: [],
    savedEvidence: [],
    planning: buildParcelPlanningAssessment({
      parcelId: parcel.id,
      municipality: parcel.municipality ?? null,
      locationHints: [parcel.town, parcel.municipality],
      erfAreaM2: 619,
      manualZoneCode: null,
      documentZoneCode: null,
      documentZoneAssetId: null,
      hasParcelPolygon: true,
      evidence: {
        zoningCertificateUploaded: false,
        approvedPlansUploaded: false,
        titleDeedUploaded: false,
        sgDiagramUploaded: false,
      } as never,
    }),
    scenarioCount: 0,
    chosenScenarioId: null,
    skippedTaskIds: [],
    startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    contradictions: [],
    ...overrides,
  };
}

function row(rows: InvestigationPlanRow[], id: string) {
  const found = rows.find((item) => item.id === id);
  expect(found, `expected plan row ${id}`).toBeDefined();
  return found!;
}

describe("master investigation plan", () => {
  it("always exposes the full roadmap with importance groups", () => {
    const plan = buildMasterInvestigationPlan(makeInput());
    expect(plan.rows.length).toBeGreaterThanOrEqual(10);
    expect(plan.rows.filter((r) => r.importance === "required").length).toBeGreaterThanOrEqual(4);
    expect(plan.rows.some((r) => r.importance === "recommended")).toBe(true);
    expect(plan.rows.some((r) => r.importance === "optional")).toBe(true);
    for (const item of plan.rows) {
      expect(item.whyItMatters.length).toBeGreaterThan(0);
      expect(item.completionCriteria.length).toBeGreaterThan(0);
      expect(item.reportSections.length).toBeGreaterThan(0);
    }
  });

  it("names the missing item for every incomplete required row", () => {
    const plan = buildMasterInvestigationPlan(makeInput());
    for (const item of plan.rows.filter((r) => r.importance === "required")) {
      if (item.status !== "complete" && item.status !== "not_applicable") {
        expect(item.missingItem).toBeTruthy();
      }
    }
  });

  it("never lets optional analysis block a dependable Standard report", () => {
    const complete = calculatePlanReadiness([
      {
        importance: "required",
        status: "complete",
      } as InvestigationPlanRow,
      {
        importance: "recommended",
        status: "complete",
      } as InvestigationPlanRow,
      {
        importance: "optional",
        status: "not_started",
      } as InvestigationPlanRow,
    ]);
    expect(complete.percent).toBe(100);
    expect(complete.dependableStandardReport).toBe(true);
  });

  it("weights required checks above recommended ones", () => {
    const requiredMissing = calculatePlanReadiness([
      { importance: "required", status: "not_started" } as InvestigationPlanRow,
      { importance: "recommended", status: "complete" } as InvestigationPlanRow,
    ]);
    const recommendedMissing = calculatePlanReadiness([
      { importance: "required", status: "complete" } as InvestigationPlanRow,
      { importance: "recommended", status: "not_started" } as InvestigationPlanRow,
    ]);
    expect(recommendedMissing.percent).toBeGreaterThan(requiredMissing.percent);
    expect(requiredMissing.dependableStandardReport).toBe(false);
  });

  it("marks approved plans not applicable on vacant land", () => {
    const workspaceState = createEmptyErfWorkspaceState();
    workspaceState.sitePotential.mode = "vacant_land";
    const plan = buildMasterInvestigationPlan(makeInput({ workspaceState }));
    expect(plan.siteState).toBe("vacant_land");
    expect(row(plan.rows, "buildings-plans").status).toBe("not_applicable");
    expect(row(plan.rows, "site-conditions").missingItem).toMatch(/topographical/i);
  });

  it("surfaces a recorded extent conflict on the SG row", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        contradictions: [
          {
            id: "area-conflict",
            title: "Extent differs between sources",
            explanation: "Official area 619 m² differs from the diagram area 602 m².",
            displayedValues: ["619 m²", "602 m²"],
            targetTab: null,
          },
        ],
      }),
    );
    expect(row(plan.rows, "sg-servitudes").conflicts).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(1);
  });

  it("keeps one canonical next action tied to a plan row", () => {
    const plan = buildMasterInvestigationPlan(makeInput());
    expect(plan.nextAction).not.toBeNull();
    if (plan.nextActionRowId) {
      expect(plan.rows.some((item) => item.id === plan.nextActionRowId)).toBe(true);
    }
  });

  it("is deterministic for identical input", () => {
    expect(JSON.stringify(buildMasterInvestigationPlan(makeInput()))).toEqual(
      JSON.stringify(buildMasterInvestigationPlan(makeInput())),
    );
  });
});
