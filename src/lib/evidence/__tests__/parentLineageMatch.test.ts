import { describe, expect, it } from "vitest";
import {
  applyParentLineageClaimPolicy,
  isClaimExplicitlyTiedToSubjectErf,
  matchDocumentIdentity,
  normalizeExtractedClaim,
  type ErfExtractedClaim,
  type ErfExtractedIdentity,
} from "../../../../supabase/functions/_shared/erfExtractionContract";
import { buildPropertyEvidencePack } from "../buildPropertyEvidencePack";
import {
  EVIDENCE_TEST_NOW,
  evidenceAsset,
  evidenceParcel,
  evidenceWorkspace,
} from "./propertyEvidenceTestUtils";
import { createEmptyStrategyWorkspace } from "@/lib/workbench/erfWorkspaceState";
import { buildAskEasyErfEvidencePayload } from "@/lib/reports/askEasyErf";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const PARCEL_ID = "csg:lpi:C03400140000157000000";

function docIdentity(partial: Partial<ErfExtractedIdentity>): ErfExtractedIdentity {
  return {
    erfNumber: null,
    portionNumber: null,
    lpiCode: null,
    sgCode: null,
    streetAddress: null,
    suburbOrTown: null,
    municipality: null,
    province: null,
    ...partial,
  };
}

const expected = {
  parcelId: PARCEL_ID,
  erfNumber: "1570",
  town: "HUMANSDORP",
  province: "EASTERN CAPE",
};
const knownLineage = {
  parentErfNumber: "1496",
  generalPlanReference: "GP12252",
  sourceLabel: "Lightstone deeds report",
};

/** A realistic claim that could survive the production extraction contract. */
function claim(partial: Partial<ErfExtractedClaim> & Pick<ErfExtractedClaim, "domain" | "key" | "label" | "value">) {
  const normalized = normalizeExtractedClaim({
    numericValue: null,
    unit: null,
    page: 1,
    quote: partial.quote ?? String(partial.value),
    confidence: "high",
    ...partial,
  });
  if (!normalized) throw new Error(`invalid test claim: ${partial.key}`);
  return normalized;
}

const policyContext = { subjectErfNumber: "1570", parentErfNumber: "1496", generalPlanReference: "GP12252" };

describe("parent General Plan lineage matching", () => {
  it("1. treats the proven parent erf + general plan as parent_lineage_match, not matched", () => {
    const result = matchDocumentIdentity(
      expected,
      docIdentity({ erfNumber: "1496", suburbOrTown: "HUMANSDORP", sgCode: "GP12252" }),
      {
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN No. 12252 of ERF 1496 HUMANSDORP",
        documentGeneralPlanReference: "GP12252",
        knownLineage,
      },
    );
    expect(result.status).toBe("parent_lineage_match");
    expect(result.status).not.toBe("matched");
    expect(result.lineage?.parentErfNumber).toBe("1496");
    expect(result.lineage?.generalPlanReference).toBe("GP12252");
  });

  it("2. still rejects an unrelated erf's general plan as a mismatch", () => {
    const result = matchDocumentIdentity(
      expected,
      docIdentity({ erfNumber: "2210", suburbOrTown: "HUMANSDORP", sgCode: "GP99999" }),
      {
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN No. 99999 of ERF 2210",
        documentGeneralPlanReference: "GP99999",
        knownLineage,
      },
    );
    expect(result.status).toBe("mismatch");
  });

  it("rejects a parent plan when no matched document has proven the lineage", () => {
    const result = matchDocumentIdentity(
      expected,
      docIdentity({ erfNumber: "1496", suburbOrTown: "HUMANSDORP", sgCode: "GP12252" }),
      {
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN No. 12252 of ERF 1496",
        documentGeneralPlanReference: "GP12252",
        knownLineage: null,
      },
    );
    expect(result.status).toBe("mismatch");
  });
});

describe("parent-lineage claim policy", () => {
  it("3./4. never lets the parent plan state this erf's extent, erf number or LPI", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({
          domain: "identity",
          key: "areaM2",
          label: "Extent",
          value: "8941 m2",
          numericValue: 8941,
          unit: "m2",
          quote: "EXTENT 8 941 m²",
        }),
        claim({ domain: "identity", key: "erfNumber", label: "Erf number", value: "1496", quote: "ERF 1496" }),
        claim({
          domain: "identity",
          key: "lpiCode",
          label: "LPI code",
          value: "C03400140000149600000",
          quote: "LPI C03400140000149600000",
        }),
      ],
      policyContext,
    );
    expect(out.some((item) => item.domain === "identity" && item.key === "areaM2")).toBe(false);
    expect(out.some((item) => item.key === "lpiCode")).toBe(false);
    const extent = out.find((item) => item.key === "parentPlanExtent");
    expect(extent?.domain).toBe("documents");
    expect(extent?.scope).toBe("parent_plan");
    const parentErf = out.find((item) => item.key === "parentErfNumber");
    expect(parentErf?.scope).toBe("parent_plan");
    expect(out.some((item) => item.domain === "identity" && item.key === "erfNumber")).toBe(false);
  });

  it("5. keeps a plan-wide servitude as a contextual plan annotation", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({
          domain: "deeds",
          key: "servitudes",
          label: "Servitude",
          value: "3 m municipal servitude along the northern boundary",
          quote: "3m municipal servitude along the northern boundary",
          confidence: "medium",
        }),
      ],
      policyContext,
    );
    const annotation = out.find((item) => item.key === "contextualPlanAnnotation");
    expect(annotation?.domain).toBe("documents");
    expect(annotation?.scope).toBe("parent_plan");
    expect(annotation?.interpretation).toBe(true);
  });

  it("6. keeps a servitude explicitly labelled for Erf 1570 as a subject-scoped deeds claim", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({
          domain: "deeds",
          key: "servitudes",
          label: "Servitude",
          value: "2 m sewer servitude affecting Erf 1570",
          quote: "SEWER SERVITUDE 2m WIDE AFFECTING ERF 1570",
          page: 2,
        }),
      ],
      policyContext,
    );
    const servitude = out[0];
    expect(servitude.domain).toBe("deeds");
    expect(servitude.key).toBe("servitudes");
    expect(servitude.scope).toBe("subject");
    expect(servitude.page).toBe(2);
    expect(servitude.quote).toBe("SEWER SERVITUDE 2m WIDE AFFECTING ERF 1570");
    expect(servitude.label).toMatch(/GP12252/);
  });

  it("7. keeps a building line explicitly labelled for Erf 1570 as a subject-scoped planning claim", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({
          domain: "planning",
          key: "buildingLines",
          label: "Building line",
          value: "3 m building line",
          quote: "3 m BUILDING LINE ERF 1570",
        }),
      ],
      policyContext,
    );
    expect(out[0].domain).toBe("planning");
    expect(out[0].key).toBe("buildingLines");
    expect(out[0].scope).toBe("subject");
  });

  it("8. does not treat a subdivision range mentioning 1570 as child-specific", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({
          domain: "deeds",
          key: "servitudes",
          label: "Servitude",
          value: "Servitude over Erven 1560 to 1580",
          quote: "SERVITUDE OVER ERVEN 1560 TO 1580",
        }),
        claim({
          domain: "planning",
          key: "buildingLines",
          label: "Building line",
          value: "Building line noted on subdivision of Erf 1496 into Erven 1568, 1569, 1570, 1571",
          quote: "SUBDIVISION OF ERF 1496 INTO ERVEN 1568, 1569, 1570, 1571",
        }),
      ],
      policyContext,
    );
    expect(out.every((item) => item.scope === "parent_plan")).toBe(true);
    expect(out.every((item) => item.key === "contextualPlanAnnotation")).toBe(true);
  });

  it("8b. the helper rejects list, legend and adjoining references", () => {
    expect(
      isClaimExplicitlyTiedToSubjectErf({ quote: "SERVITUDE AFFECTING ERF 1570", label: "", value: "" }, "1570"),
    ).toBe(true);
    expect(
      isClaimExplicitlyTiedToSubjectErf({ quote: "ADJOINING ERF 1570", label: "", value: "" }, "1570"),
    ).toBe(false);
    expect(
      isClaimExplicitlyTiedToSubjectErf({ quote: "LEGEND: ERF 1570", label: "", value: "" }, "1570"),
    ).toBe(false);
    expect(
      isClaimExplicitlyTiedToSubjectErf({ quote: "ERVEN 1569 & 1570", label: "", value: "" }, "1570"),
    ).toBe(false);
    expect(
      isClaimExplicitlyTiedToSubjectErf({ quote: "ERF 1570 TO 1580", label: "", value: "" }, "1570"),
    ).toBe(false);
    expect(isClaimExplicitlyTiedToSubjectErf({ quote: "ERF 1496", label: "", value: "" }, "1570")).toBe(false);
  });

  it("9. blocks ownership, valuation, transfers and development-permission claims", () => {
    const out = applyParentLineageClaimPolicy(
      [
        claim({ domain: "ownership", key: "registeredOwner", label: "Owner", value: "J A Smith" }),
        claim({ domain: "valuation", key: "municipalValue", label: "Value", value: "R1 200 000", numericValue: 1200000 }),
        claim({ domain: "transfers", key: "lastSalePrice", label: "Price", value: "R900 000", numericValue: 900000 }),
        claim({ domain: "planning", key: "zoning", label: "Zoning", value: "Residential 1, affecting Erf 1570" }),
        claim({ domain: "planning", key: "far", label: "FAR", value: "0.6 for Erf 1570" }),
        claim({ domain: "planning", key: "coverage", label: "Coverage", value: "50% Erf 1570" }),
        claim({ domain: "planning", key: "densityUnits", label: "Density", value: "1 unit Erf 1570" }),
        claim({ domain: "planning", key: "landUse", label: "Land use", value: "Dwelling, Erf 1570" }),
      ],
      policyContext,
    );
    for (const key of ["registeredOwner", "municipalValue", "lastSalePrice", "zoning", "far", "coverage", "densityUnits", "landUse"]) {
      expect(out.some((item) => item.key === key)).toBe(false);
    }
    expect(out.some((item) => item.domain === "ownership" || item.domain === "valuation" || item.domain === "transfers")).toBe(
      false,
    );
  });
});

function sgAsset(claims: ErfExtractedClaim[], overrides: Record<string, unknown> = {}) {
  return evidenceAsset({
    id: "asset-gp12252",
    parcel_id: PARCEL_ID,
    asset_category: "sg_diagram",
    original_file_name: "GP12252-sheet-1.tif",
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "parent_lineage_match",
      identityMatchReason: "Parent General Plan GP12252 of parent Erf 1496.",
      documentLineage: { parentErfNumber: "1496", generalPlanReference: "GP12252" },
      extractedText: "GENERAL PLAN No. 12252 OF ERF 1496 HUMANSDORP. SEWER SERVITUDE 2m AFFECTING ERF 1570.",
      pageCount: 1,
      extractedClaims: claims,
    },
    ...overrides,
  } as never);
}

function pack(assets: ReturnType<typeof evidenceAsset>[]) {
  return buildPropertyEvidencePack({
    parcel: evidenceParcel({
      id: PARCEL_ID,
      erfNumber: 1570,
      lpi: "C03400140000157000000",
      rawProperties: { GEOM_AREA: 618.7 },
    }),
    workspaceState: evidenceWorkspace(),
    strategyWorkspace: createEmptyStrategyWorkspace(PARCEL_ID),
    assets,
    savedMarketEvidence: [],
    now: EVIDENCE_TEST_NOW,
  });
}

describe("evidence pack with a parent General Plan", () => {
  const policied = applyParentLineageClaimPolicy(
    [
      claim({
        domain: "identity",
        key: "areaM2",
        label: "Extent",
        value: "8941 m2",
        numericValue: 8941,
        unit: "m2",
        quote: "EXTENT 8 941 m²",
      }),
      claim({ domain: "identity", key: "erfNumber", label: "Erf number", value: "1496", quote: "ERF 1496" }),
      claim({
        domain: "deeds",
        key: "servitudes",
        label: "Servitude",
        value: "2 m sewer servitude affecting Erf 1570",
        quote: "SEWER SERVITUDE 2m WIDE AFFECTING ERF 1570",
        page: 1,
      }),
      claim({
        domain: "deeds",
        key: "servitudes",
        label: "Servitude",
        value: "3 m municipal servitude along the northern boundary",
        quote: "3m MUNICIPAL SERVITUDE NORTHERN BOUNDARY",
      }),
    ],
    policyContext,
  );

  const built = pack([sgAsset(policied)]);

  it("3b. the parent extent never becomes this erf's area and never contradicts 619 m²", () => {
    const area = built.claims.find((item) => item.domain === "identity" && item.key === "areaM2");
    expect(area?.normalizedValue).toBe(618.7);
    expect(built.claims.some((item) => item.normalizedValue === 8941 && item.domain === "identity")).toBe(false);
    expect(
      built.contradictions.some((item) => item.explanation.includes("8941") || item.title.toLowerCase().includes("extent")),
    ).toBe(false);
  });

  it("4b. parent Erf 1496 never replaces Erf 1570 as the subject", () => {
    expect(built.parcelId).toBe(PARCEL_ID);
    const erf = built.claims.find((item) => item.domain === "identity" && item.key === "erfNumber");
    expect(String(erf?.value ?? "")).toContain("1570");
  });

  it("5b. the plan-wide servitude stays contextual and not reviewed", () => {
    const contextual = built.claims.find((item) => item.key === "contextualPlanAnnotation");
    expect(contextual?.status).toBe("not_reviewed");
    expect(contextual?.confidence).toBe("unverified");
  });

  it("6b. the Erf 1570 servitude stays a supported deeds claim sourced from the parent plan", () => {
    const servitude = built.claims.find((item) => item.domain === "deeds" && item.key === "servitudes");
    expect(servitude?.status).toBe("supported");
    expect(servitude?.confidenceReason).toMatch(/parent plan|GP12252/i);
    expect(servitude?.confidenceReason).toMatch(/surveyor|conveyancer/i);
    expect(servitude?.locators[0]?.excerpt).toContain("ERF 1570");
  });

  it("10. surfaces GP12252 and parent Erf 1496 as parent-lineage evidence", () => {
    const gap = built.gaps.find((item) => item.id === "document-parent-lineage-asset-gp12252");
    expect(gap?.title).toContain("GP12252");
    expect(gap?.title).toContain("1496");
    expect(built.claims.some((item) => item.key === "parentErfNumber")).toBe(true);
    expect(built.claims.some((item) => item.key === "parentPlanExtent")).toBe(true);
  });
});

describe("Ask Easy Erf parent-plan context", () => {
  it("11./12. labels the parent plan as context, keeps the Erf 1570 exception, and resolves the file name", () => {
    const assets = [
      sgAsset(
        applyParentLineageClaimPolicy(
          [
            claim({
              domain: "deeds",
              key: "servitudes",
              label: "Servitude",
              value: "2 m sewer servitude affecting Erf 1570",
              quote: "SEWER SERVITUDE 2m WIDE AFFECTING ERF 1570",
            }),
          ],
          policyContext,
        ),
      ),
    ];
    const report = buildReportViewModel({
      parcel: evidenceParcel({
        id: PARCEL_ID,
        erfNumber: 1570,
        lpi: "C03400140000157000000",
        rawProperties: { GEOM_AREA: 618.7 },
      }),
      workspaceState: createEmptyErfWorkspaceState(),
      savedEvidence: [],
      assets,
      chosenScenario: null,
      strategyScenarios: [],
      selectedSiteDesign: null,
      siteBrief: null,
      now: EVIDENCE_TEST_NOW,
    });
    const payload = buildAskEasyErfEvidencePayload({
      report,
      decision: buildDecisionIntelligence(report),
      assets,
      savedEvidence: [],
      strategyScenarios: [],
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain("PARENT GENERAL PLAN");
    expect(serialized).toMatch(/explicitly names this erf/i);
    expect(serialized).toContain("GP12252-sheet-1.tif");
  });
});
