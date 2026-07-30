import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset, ErfAssetCategory } from "@/lib/workbench/erfFileVault";
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

function asset(
  asset_category: ErfAssetCategory,
  overrides: Partial<ErfAsset> = {},
): ErfAsset {
  return {
    id: `${asset_category}-1`,
    user_id: "user-1",
    parcel_id: parcel.id,
    asset_category,
    asset_type: asset_category,
    source_label: asset_category.replace(/_/g, " "),
    storage_bucket: "erf-files",
    storage_path: `user-1/${parcel.id}/${asset_category}/file.pdf`,
    original_file_name: `${asset_category}.pdf`,
    mime_type: "application/pdf",
    size_bytes: 1234,
    checksum_sha256: null,
    status: "ready",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function searchableSubjectAsset(
  asset_category: ErfAssetCategory,
  overrides: Partial<ErfAsset> = {},
) {
  return asset(asset_category, {
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      extractedText: `${asset_category} readable subject evidence`,
      ...(overrides.metadata ?? {}),
    },
    ...overrides,
  });
}

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

  it("completes SG and servitudes only with searchable subject SG plus searchable subject title deed", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [searchableSubjectAsset("sg_diagram"), searchableSubjectAsset("title_deed")],
      }),
    );

    const sg = row(plan.rows, "sg-servitudes");
    expect(sg.status).toBe("complete");
    expect(sg.missingItem).toBeNull();
    expect(sg.supportedEvidenceCount).toBe(2);
    expect(sg.requiredEvidenceCount).toBe(2);
  });

  it("keeps searchable SG partial until title and servitude evidence is confirmed", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [searchableSubjectAsset("sg_diagram")],
      }),
    );

    const sg = row(plan.rows, "sg-servitudes");
    expect(sg.status).toBe("partial");
    expect(sg.summary).toMatch(/title conditions and servitudes/i);
    expect(sg.missingItem).toMatch(/title deed/i);
    expect(sg.supportedEvidenceCount).toBe(1);
  });

  it("does not treat a paid report as certified SG or title deed evidence", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [searchableSubjectAsset("paid_report")],
      }),
    );

    const sg = row(plan.rows, "sg-servitudes");
    expect(sg.status).toBe("partial");
    expect(sg.summary).toMatch(/paid report adds context/i);
    expect(sg.supportedEvidenceCount).toBe(0);
  });

  it("labels parent-lineage SG evidence as context only", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [
          asset("sg_diagram", {
            metadata: {
              extractionStatus: "ready",
              identityMatchStatus: "parent_lineage_match",
              extractedText: "Parent general plan only",
            },
          }),
        ],
      }),
    );

    const sg = row(plan.rows, "sg-servitudes");
    expect(sg.status).toBe("partial");
    expect(sg.summary).toMatch(/parent property/i);
    expect(sg.supportedEvidenceCount).toBe(0);
  });

  it("does not let generated Site Potential concepts advance Site conditions", () => {
    const workspaceState = createEmptyErfWorkspaceState();
    workspaceState.sitePotential.conceptCount = 2;
    workspaceState.sitePotential.selectedDesignAssetId = "concept-1";

    const plan = buildMasterInvestigationPlan(
      makeInput({
        workspaceState,
        assets: [asset("generated_design", { id: "concept-1", mime_type: "image/png" })],
      }),
    );

    expect(row(plan.rows, "site-potential").status).toBe("complete");
    expect(row(plan.rows, "site-conditions").status).toBe("not_started");
    expect(row(plan.rows, "site-conditions").supportedEvidenceCount).toBe(0);
  });

  it("uses site photos as partial site-condition context only", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [asset("site_photo", { mime_type: "image/jpeg" })],
      }),
    );

    const site = row(plan.rows, "site-conditions");
    expect(site.status).toBe("partial");
    expect(site.summary).toMatch(/visual context/i);
    expect(site.missingItem).toMatch(/survey/i);
  });

  it("completes Site conditions with a usable topographical survey", () => {
    const plan = buildMasterInvestigationPlan(
      makeInput({
        assets: [searchableSubjectAsset("topography")],
      }),
    );

    const site = row(plan.rows, "site-conditions");
    expect(site.status).toBe("complete");
    expect(site.missingItem).toBeNull();
    expect(site.supportedEvidenceCount).toBe(1);
  });

  it("reflects assigned local property team professionals from vendor assignments", () => {
    const empty = buildMasterInvestigationPlan(makeInput());
    expect(row(empty.rows, "local-team").status).toBe("not_started");
    expect(row(empty.rows, "local-team").supportedEvidenceCount).toBe(0);

    const assigned = buildMasterInvestigationPlan(makeInput({ vendorAssignmentCount: 2 }));
    const localTeam = row(assigned.rows, "local-team");
    expect(localTeam.status).toBe("complete");
    expect(localTeam.summary).toContain("2 professionals are assigned");
    expect(localTeam.supportedEvidenceCount).toBe(2);
  });

  it("can reach complete required and recommended readiness without optional analysis", () => {
    const workspaceState = createEmptyErfWorkspaceState();
    workspaceState.identityStatus = "checked";
    workspaceState.sitePotential.mode = "vacant_land";
    const plan = buildMasterInvestigationPlan(
      makeInput({
        workspaceState,
        assets: [
          searchableSubjectAsset("sg_diagram"),
          searchableSubjectAsset("title_deed"),
          searchableSubjectAsset("zoning_document"),
          searchableSubjectAsset("topography"),
        ],
        savedEvidence: [
          { id: "comp-1" },
          { id: "comp-2" },
          { id: "comp-3" },
        ] as never,
        planning: buildParcelPlanningAssessment({
          parcelId: parcel.id,
          municipality: parcel.municipality ?? null,
          locationHints: [parcel.town, parcel.municipality],
          erfAreaM2: 619,
          manualZoneCode: null,
          documentZoneCode: "RES1",
          documentZoneAssetId: "zoning_document-1",
          hasParcelPolygon: true,
          evidence: {
            zoningCertificateUploaded: true,
            approvedPlansUploaded: false,
            titleDeedUploaded: true,
            sgDiagramUploaded: true,
          } as never,
        }),
      }),
    );

    expect(row(plan.rows, "identity").status).toBe("complete");
    expect(row(plan.rows, "ownership").status).toBe("complete");
    expect(row(plan.rows, "zoning").status).toBe("complete");
    expect(row(plan.rows, "sg-servitudes").status).toBe("complete");
    expect(row(plan.rows, "buildings-plans").status).toBe("not_applicable");
    expect(row(plan.rows, "site-conditions").status).toBe("complete");
    expect(row(plan.rows, "market").status).toBe("complete");
    expect(row(plan.rows, "strategy").status).toBe("not_started");
    expect(plan.readiness.percent).toBe(100);
    expect(plan.readiness.dependableStandardReport).toBe(true);
    expect(plan.readiness.conclusion).not.toMatch(/verified|legally complete|bank-ready/i);
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
