import { describe, expect, it } from "vitest";
import {
  buildExtractionContent,
  findUnsupportedContentMime,
  planDenseSheetTiles,
  type NormalizedExtractionPage,
} from "../../../../supabase/functions/_shared/erfExtractionMedia";
import {
  applyGeneralPlanSubjectClaimPolicy,
  evaluateGeneralPlanSubjectMatch,
} from "../../../../supabase/functions/_shared/generalPlanSubjectEvidence";
import type {
  ErfExpectedIdentity,
  ErfExtractedClaim,
  ErfExtractedIdentity,
  ErfIdentityMatchResult,
} from "../../../../supabase/functions/_shared/erfExtractionContract";

const expected: ErfExpectedIdentity = {
  parcelId: "csg:lpi:C07600000000102100000",
  erfNumber: "1021",
  portionNumber: "0",
  municipality: "Kouga",
  province: "Eastern Cape",
  town: "Sea Vista",
};

const documentIdentity: ErfExtractedIdentity = {
  erfNumber: "1021",
  portionNumber: null,
  lpiCode: null,
  sgCode: "TP 9905",
  streetAddress: null,
  suburbOrTown: "Sea Vista",
  municipality: null,
  province: "Eastern Cape",
};

const erfTitleConflict: ErfIdentityMatchResult = {
  status: "mismatch",
  reason: "Identity conflict: the document states erf 999, not erf 1021.",
};

function claim(overrides: Partial<ErfExtractedClaim>): ErfExtractedClaim {
  return {
    domain: "planning",
    key: "buildingLines",
    label: "Building line",
    value: "4 m",
    numericValue: 4,
    unit: "m",
    page: 1,
    quote: "Erf 1021: building line 4 m",
    confidence: "high",
    interpretation: false,
    scope: "subject",
    ...overrides,
  };
}

describe("dense SG General Plan extraction", () => {
  it.each([
    [12484, 8899],
    [12774, 9109],
    [13048, 8014],
  ])("plans four bounded overlapping tiles for a %i x %i dense scan", (width, height) => {
    const tiles = planDenseSheetTiles(width, height);

    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => [tile.row, tile.col])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);
    for (const tile of tiles) {
      expect(tile.x0).toBeGreaterThanOrEqual(0);
      expect(tile.y0).toBeGreaterThanOrEqual(0);
      expect(tile.x1).toBeLessThanOrEqual(width);
      expect(tile.y1).toBeLessThanOrEqual(height);
      expect(tile.x1).toBeGreaterThan(tile.x0);
      expect(tile.y1).toBeGreaterThan(tile.y0);
    }
    expect(tiles[0].x1).toBeGreaterThan(tiles[1].x0);
    expect(tiles[0].y1).toBeGreaterThan(tiles[2].y0);
  });

  it("does not add detail tiles to an ordinary low-resolution diagram", () => {
    expect(planDenseSheetTiles(3000, 2000)).toEqual([]);
  });

  it("sends a PNG overview and high-detail crops, never raw TIFF", () => {
    const pages: NormalizedExtractionPage[] = [
      {
        pageNumber: 1,
        mimeType: "image/png",
        base64: "overview",
        width: 3000,
        height: 2100,
        detail: null,
      },
      {
        pageNumber: 1,
        mimeType: "image/png",
        base64: "tile",
        width: 2400,
        height: 1700,
        detail: {
          index: 1,
          row: 1,
          col: 1,
          rows: 2,
          cols: 2,
          x0: 0,
          y0: 0,
          x1: 6800,
          y1: 4700,
        },
      },
    ];

    const content = buildExtractionContent({
      fileName: "TEST FIXTURE - DENSE GENERAL PLAN.TIF",
      mimeType: "image/tiff",
      dataUrl: "data:image/tiff;base64,RAW-MUST-NOT-LEAVE",
      pages,
      subjectErfNumber: "1021",
    });

    expect(findUnsupportedContentMime(content)).toBeNull();
    expect(JSON.stringify(content)).not.toContain("image/tiff");
    expect(JSON.stringify(content)).not.toContain("RAW-MUST-NOT-LEAVE");
    expect(JSON.stringify(content)).toContain("detail\":\"high");
    expect(JSON.stringify(content)).toMatch(/visibly present|never infer|never invent/i);
    expect(JSON.stringify(content)).toContain("Erf 1021");
  });

  it("accepts a General Plan only when the selected erf is visibly printed", () => {
    const match = evaluateGeneralPlanSubjectMatch({
      expected,
      document: documentIdentity,
      assetCategory: "sg_diagram",
      documentType: "General Plan",
      documentText: "GENERAL PLAN TP No. 9905. Erf 1021. Sea Vista Township Extension 9.",
      documentGeneralPlanReference: "GP9905",
      baseline: erfTitleConflict,
    });

    expect(match).toMatchObject({ matched: true, generalPlanReference: "GP9905" });
    expect(match.reason).toMatch(/visibly printed/i);
  });

  it("accepts a printed erf range but rejects an unrelated plan", () => {
    expect(
      evaluateGeneralPlanSubjectMatch({
        expected,
        document: { ...documentIdentity, erfNumber: "999" },
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN TP 9905. ERVEN 1000 TO 1099.",
        baseline: erfTitleConflict,
      }).matched,
    ).toBe(true);

    expect(
      evaluateGeneralPlanSubjectMatch({
        expected,
        document: { ...documentIdentity, erfNumber: "999" },
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN TP 9905. ERVEN 2000 TO 2099.",
        baseline: erfTitleConflict,
      }).matched,
    ).toBe(false);
  });

  it("never overrides a strong LPI or place conflict", () => {
    expect(
      evaluateGeneralPlanSubjectMatch({
        expected,
        document: documentIdentity,
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN TP 9905. Erf 1021.",
        baseline: {
          status: "mismatch",
          reason: "Identity conflict: the document LPI code is for a different parcel.",
        },
      }).matched,
    ).toBe(false);
  });

  it("keeps only claims explicitly tied to Erf 1021 as subject evidence", () => {
    const scoped = applyGeneralPlanSubjectClaimPolicy(
      [
        claim({}),
        claim({ quote: "Erf 1022: building line 3 m", value: "3 m" }),
        claim({ domain: "planning", key: "zoning", quote: "Residential zoning" }),
      ],
      { subjectErfNumber: "1021", generalPlanReference: "GP9905" },
    );

    expect(scoped).toHaveLength(2);
    expect(scoped[0]).toMatchObject({ scope: "subject", key: "buildingLines" });
    expect(scoped[1]).toMatchObject({
      scope: "parent_plan",
      domain: "documents",
      key: "contextualPlanAnnotation",
      confidence: "low",
    });
    expect(scoped.some((item) => item.key === "zoning")).toBe(false);
  });
});
