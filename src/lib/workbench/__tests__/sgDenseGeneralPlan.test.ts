import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ERF_TIFF_MAX_PAGE_BYTES,
  ERF_TIFF_MAX_PLANNED_OUTPUT_PIXELS,
  ERF_TIFF_MAX_TOTAL_BYTES,
  buildExtractionContent,
  checkTiffPixelBudget,
  findUnsupportedContentMime,
  planBilevelTiffOutputs,
  planDenseSheetTiles,
  planTiffRegionStrips,
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
  it("accepts and bounds the real dense G4 sheet dimensions", () => {
    const width = 7151;
    const height = 10017;
    const plan = planBilevelTiffOutputs(width, height);

    expect(checkTiffPixelBudget(width, height, { bilevel: true })).toEqual({ ok: true });
    expect(plan.overview).toMatchObject({ width: 1285, height: 1800 });
    expect(plan.details).toHaveLength(4);
    expect(plan.details.every((detail) => detail.output.height === 2400)).toBe(true);
    expect(plan.totalOutputPixels).toBeLessThanOrEqual(ERF_TIFF_MAX_PLANNED_OUTPUT_PIXELS);

    const plannedImages = [plan.overview, ...plan.details.map((detail) => detail.output)];
    const rawGrayBytes = plannedImages.map((image) => image.width * image.height + image.height);
    expect(Math.max(...rawGrayBytes)).toBeLessThan(ERF_TIFF_MAX_PAGE_BYTES);
    expect(rawGrayBytes.reduce((total, bytes) => total + bytes, 0)).toBeLessThan(
      ERF_TIFF_MAX_TOTAL_BYTES,
    );

    expect(Math.min(...plan.details.map((detail) => detail.tile.x0))).toBe(0);
    expect(Math.min(...plan.details.map((detail) => detail.tile.y0))).toBe(0);
    expect(Math.max(...plan.details.map((detail) => detail.tile.x1))).toBe(width);
    expect(Math.max(...plan.details.map((detail) => detail.tile.y1))).toBe(height);
  });

  it("decodes only strips intersecting each vertical detail region", () => {
    const width = 7151;
    const height = 10017;
    const rowsPerStrip = 5;
    const stripCount = Math.ceil(height / rowsPerStrip);
    const plan = planBilevelTiffOutputs(width, height);
    const top = plan.details[0].tile;
    const bottom = plan.details[2].tile;
    const topStrips = planTiffRegionStrips({
      height,
      rowsPerStrip,
      stripCount,
      y0: top.y0,
      y1: top.y1,
    });
    const bottomStrips = planTiffRegionStrips({
      height,
      rowsPerStrip,
      stripCount,
      y0: bottom.y0,
      y1: bottom.y1,
    });

    expect(topStrips[0].index).toBe(0);
    expect(topStrips.at(-1)!.yBase).toBeLessThan(top.y1);
    expect(topStrips.every((strip) => strip.yBase < top.y1)).toBe(true);
    expect(bottomStrips[0].yBase + bottomStrips[0].rowCount).toBeGreaterThan(bottom.y0);
    expect(bottomStrips.every((strip) => strip.yBase + strip.rowCount > bottom.y0)).toBe(true);
    expect(topStrips).toHaveLength(1062);
    expect(bottomStrips).toHaveLength(1063);
  });

  it("materially reduces dense detail strip work below every-strip-per-crop decoding", () => {
    const width = 7151;
    const height = 10017;
    const rowsPerStrip = 5;
    const stripCount = Math.ceil(height / rowsPerStrip);
    const plan = planBilevelTiffOutputs(width, height);
    const detailStripWork = plan.details.reduce(
      (total, detail) => total + planTiffRegionStrips({
        height,
        rowsPerStrip,
        stripCount,
        y0: detail.tile.y0,
        y1: detail.tile.y1,
      }).length,
      0,
    );
    const plannedWork = stripCount + detailStripWork;
    const previousWork = stripCount * (1 + plan.details.length);

    expect(plannedWork).toBe(6254);
    expect(plannedWork).toBeLessThan(previousWork * 0.65);
  });

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
    expect(planBilevelTiffOutputs(3000, 2000)).toMatchObject({
      overview: { width: 3000, height: 2000, downscaled: false },
      details: [],
    });
  });

  it("keeps the G4 path out of the full-size RGBA decoder", () => {
    const decoderSource = readFileSync(
      new URL("../../../../supabase/functions/extract-erf-asset/tiffDecode.ts", import.meta.url),
      "utf8",
    );
    const g4BranchStart = decoderSource.indexOf("if (isBilevelG4) {");
    const rgbaBranchStart = decoderSource.indexOf("} else {", g4BranchStart);

    expect(g4BranchStart).toBeGreaterThan(-1);
    expect(rgbaBranchStart).toBeGreaterThan(g4BranchStart);
    expect(decoderSource.slice(g4BranchStart, rgbaBranchStart)).not.toContain("UTIF.toRGBA8");
    expect(decoderSource.slice(rgbaBranchStart)).toContain("UTIF.toRGBA8");
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

  it("keeps the existing PDF extraction payload unchanged", () => {
    expect(
      buildExtractionContent({
        fileName: "title-deed.pdf",
        mimeType: "application/pdf",
        dataUrl: "data:application/pdf;base64,PDF",
      }),
    ).toEqual([
      { type: "text", text: "Extract this property document: title-deed.pdf" },
      {
        type: "file",
        file: {
          filename: "title-deed.pdf",
          file_data: "data:application/pdf;base64,PDF",
        },
      },
    ]);
  });

  it("treats a General Plan with the selected erf visibly printed as supporting context", () => {
    const match = evaluateGeneralPlanSubjectMatch({
      expected,
      document: documentIdentity,
      assetCategory: "sg_diagram",
      documentType: "General Plan",
      documentText: "GENERAL PLAN TP No. 9905. Erf 1021. Sea Vista Township Extension 9.",
      documentGeneralPlanReference: "GP9905",
      baseline: erfTitleConflict,
    });

    expect(match).toMatchObject({ supportsSubject: true, generalPlanReference: "GP9905" });
    expect(match.reason).toMatch(/supports this investigation/i);
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
      }).supportsSubject,
    ).toBe(true);

    expect(
      evaluateGeneralPlanSubjectMatch({
        expected,
        document: { ...documentIdentity, erfNumber: "999" },
        assetCategory: "sg_diagram",
        documentType: "General Plan",
        documentText: "GENERAL PLAN TP 9905. ERVEN 2000 TO 2099.",
        baseline: erfTitleConflict,
      }).supportsSubject,
    ).toBe(false);
  });

  it("never overrides a strong LPI conflict", () => {
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
      }).supportsSubject,
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
