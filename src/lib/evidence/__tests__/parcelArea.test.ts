import { describe, expect, it } from "vitest";
import {
  AREA_UNAVAILABLE_LABEL,
  canonicalAreaM2,
  formatAreaM2Value,
  formatAreaM2WithUnit,
  resolveParcelArea,
} from "../parcelArea";
import { buildEvidencePackFixture, evidenceParcel, evidenceMarket } from "./propertyEvidenceTestUtils";

/** Real live attributes observed on the CSG mirror for Erf 1570. */
const ERF_1570_RAW = {
  OBJECTID: 415188,
  PRCL_KEY: "C03400140000157000000",
  GEOM_AREA: 618.7,
  Shape__Area: 897.4231,
  Shape__Length: 104.55,
  ERF_NO: 1570,
};

describe("canonical parcel area", () => {
  it("resolves Erf 1570 GEOM_AREA 618.7 and displays 619 m²", () => {
    const resolved = resolveParcelArea(ERF_1570_RAW);
    expect(resolved).toMatchObject({
      areaM2: 618.7,
      approximate: false,
      sourceKey: "GEOM_AREA",
      sourceKind: "csg_geom_area",
      confidence: "high",
    });
    expect(canonicalAreaM2(ERF_1570_RAW)).toBe(618.7);
    expect(formatAreaM2WithUnit(618.7)).toBe("619 m²");
  });

  it("prefers GEOM_AREA over Shape__Area", () => {
    const resolved = resolveParcelArea({ GEOM_AREA: 618.7, Shape__Area: 897.4 });
    expect(resolved?.areaM2).toBe(618.7);
    expect(resolved?.sourceKey).toBe("GEOM_AREA");
    expect(resolved?.approximate).toBe(false);
  });

  it("falls back to Shape__Area only as an approximate value with a warning", () => {
    const resolved = resolveParcelArea({ Shape__Area: 897.4 });
    expect(resolved?.areaM2).toBe(897.4);
    expect(resolved?.approximate).toBe(true);
    expect(resolved?.sourceKind).toBe("shape_area_approximate");
    expect(resolved?.confidence).toBe("low");
    expect(resolved?.warning).toMatch(/Approximate/i);
  });

  it("prefers a verified registered extent above every raw attribute", () => {
    const resolved = resolveParcelArea(ERF_1570_RAW, {
      verifiedExtent: { areaM2: 620, sourceKey: "asset:abc#page2" },
    });
    expect(resolved).toMatchObject({
      areaM2: 620,
      sourceKind: "verified_extent",
      sourceKey: "asset:abc#page2",
    });
  });

  it("never accepts zero, negative, NaN or non-finite areas", () => {
    for (const raw of [
      { GEOM_AREA: 0 },
      { GEOM_AREA: -100 },
      { GEOM_AREA: Number.NaN },
      { GEOM_AREA: Number.POSITIVE_INFINITY },
      { GEOM_AREA: "not-a-number" },
      { GEOM_AREA: null },
      {},
    ]) {
      expect(resolveParcelArea(raw)).toBeNull();
      expect(canonicalAreaM2(raw)).toBeNull();
    }
  });

  it("never renders 0 m² for an unavailable area", () => {
    for (const value of [0, -1, Number.NaN, null, undefined]) {
      expect(formatAreaM2Value(value)).toBeNull();
      expect(formatAreaM2WithUnit(value)).toBeNull();
    }
    expect(AREA_UNAVAILABLE_LABEL).toBe("Area not available");
  });

  it("skips an invalid higher-precedence value and uses the next valid tier", () => {
    expect(resolveParcelArea({ GEOM_AREA: 0, AREA_M2: 500 })?.areaM2).toBe(500);
  });
});

describe("evidence pack uses the canonical area helper", () => {
  it("creates one identity areaM2 fact claim from GEOM_AREA", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: ERF_1570_RAW }),
    });
    const areaClaims = pack.claims.filter((claim) => claim.key === "areaM2" && claim.domain === "identity");
    expect(areaClaims).toHaveLength(1);
    expect(areaClaims[0]).toMatchObject({
      domain: "identity",
      key: "areaM2",
      nature: "fact",
      unit: "m2",
      confidence: "high",
      normalizedValue: 618.7,
      sourceIds: ["official-parcel-record"],
    });
    expect(areaClaims[0].locators?.[0]?.fieldPath).toBe("parcel.rawProperties.GEOM_AREA");
  });

  it("keeps the missing-erf-area gap when no trustworthy area exists", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: { ZONING: "Residential 1" } }),
    });
    expect(pack.claims.some((claim) => claim.key === "areaM2")).toBe(false);
    expect(pack.gaps.map((gap) => gap.id)).toContain("missing-erf-area");
  });

  it("does not let a listing land size overwrite the official parcel area", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: ERF_1570_RAW }),
      savedMarketEvidence: [
        evidenceMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 1200,
        }),
      ],
    });
    const areaClaim = pack.claims.find((claim) => claim.domain === "identity" && claim.key === "areaM2");
    expect(areaClaim?.normalizedValue).toBe(618.7);
    // The listing size lives in its own market claim, never in identity.
    expect(
      pack.claims.filter((claim) => claim.domain === "identity" && claim.key === "areaM2"),
    ).toHaveLength(1);
  });
});
