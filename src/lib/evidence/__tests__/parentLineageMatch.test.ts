import { describe, expect, it } from "vitest";
import {
  applyParentLineageClaimPolicy,
  matchDocumentIdentity,
} from "../../../../supabase/functions/_shared/erfExtractionContract";

const expected = {
  parcelId: "csg:lpi:C03400140000157000000",
  erfNumber: "1570",
  town: "HUMANSDORP",
  province: "EASTERN CAPE",
};
const knownLineage = {
  parentErfNumber: "1496",
  generalPlanReference: "GP12252",
  sourceLabel: "Lightstone deeds report",
};

describe("parent General Plan lineage matching", () => {
  it("matches when the plan states the proven parent erf and general plan reference", () => {
    const result = matchDocumentIdentity(
      expected,
      { erfNumber: "1496", town: "HUMANSDORP", sgCode: "GP12252" },
      {
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN No. 12252 of ERF 1496 HUMANSDORP",
        documentGeneralPlanReference: "GP12252",
        knownLineage,
      },
    );
    expect(result.status).toBe("parent_lineage_match");
    expect(result.lineage?.parentErfNumber).toBe("1496");
  });

  it("still rejects an unrelated erf's general plan as a mismatch", () => {
    const result = matchDocumentIdentity(
      expected,
      { erfNumber: "2210", town: "HUMANSDORP", sgCode: "GP99999" },
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
      { erfNumber: "1496", town: "HUMANSDORP", sgCode: "GP12252" },
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

  it("never lets a parent plan state this erf's extent", () => {
    const claims = applyParentLineageClaimPolicy(
      [
        {
          domain: "identity",
          key: "areaM2",
          label: "Extent",
          value: "8 941 m²",
          numericValue: 8941,
          unit: "m2",
          page: 1,
          quote: "EXTENT 8 941 m²",
          confidence: "high",
        },
        {
          domain: "planning",
          key: "servitude",
          label: "Servitude",
          value: "3 m municipal servitude along the northern boundary",
          numericValue: null,
          unit: null,
          page: 1,
          quote: "3m municipal servitude",
          confidence: "medium",
        },
      ] as never,
      { subjectErfNumber: "1570", parentErfNumber: "1496", generalPlanReference: "GP12252" },
    );
    expect(claims.some((claim) => claim.domain === "identity" && claim.key === "areaM2")).toBe(false);
    const servitude = claims.find((claim) => claim.key === "servitude");
    expect(servitude?.scope).toBe("parent_plan");
    expect(servitude?.label).toMatch(/parent|general plan/i);
  });
});
