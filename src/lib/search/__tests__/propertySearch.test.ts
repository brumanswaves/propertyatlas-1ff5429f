import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import { buildOfficialParcelIndex } from "@/lib/search/officialParcelIndex";
import {
  parsePropertyQuery,
  searchByCoordinate,
  searchOfficialParcels,
} from "@/lib/search/propertySearch";

const erf962: Feature<Polygon> = {
  type: "Feature",
  properties: {
    PARCEL_NO: "962",
    PORTION: "0",
    ID: "C03400140000096200000",
    PRCL_KEY: "E108C034001400000962000000",
    MIN_REGION: "Sea Vista",
    MAJ_REGION: "St Francis Bay",
    MUNICIPALITY: "Kouga",
    PROVINCE: "Eastern Cape",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [24.8308, -34.1722],
        [24.8322, -34.1722],
        [24.8322, -34.1712],
        [24.8308, -34.1712],
        [24.8308, -34.1722],
      ],
    ],
  },
};

const anotherErf962: Feature<Polygon> = {
  type: "Feature",
  properties: {
    PARCEL_NO: "962",
    PORTION: "0",
    ID: "C09900140000096200000",
    PRCL_KEY: "E999C034001400000962000000",
    MIN_REGION: "Another Town",
    MAJ_REGION: "Another Municipality",
    PROVINCE: "Western Cape",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [18.1, -33.9],
        [18.2, -33.9],
        [18.2, -33.8],
        [18.1, -33.8],
        [18.1, -33.9],
      ],
    ],
  },
};

const parcelIndex = buildOfficialParcelIndex([
  { layer: "csg-parcels", feature: anotherErf962 },
  { layer: "csg-parcels", feature: erf962 },
]);

describe("property search parsing", () => {
  it("detects LPI, parcel key, erf, portion plus erf, and coordinates", () => {
    expect(parsePropertyQuery("C03400140000096200000").lpi).toBe("c03400140000096200000");
    expect(parsePropertyQuery("E108C034001400000962000000").parcelKey).toBe(
      "e108c034001400000962000000",
    );
    expect(parsePropertyQuery("Erf 962 Sea Vista")).toMatchObject({
      erfNumber: "962",
    });
    expect(parsePropertyQuery("Portion 0 Erf 962")).toMatchObject({
      erfNumber: "962",
      portion: "0",
    });
    expect(parsePropertyQuery("-34.1717374, 24.8314966").coordinate).toEqual({
      lat: -34.1717374,
      lng: 24.8314966,
    });
  });
});

describe("official parcel search", () => {
  it("returns exact LPI and exact parcel key as top official matches", () => {
    expect(searchOfficialParcels("C03400140000096200000", parcelIndex)[0]).toMatchObject({
      confidence: "exact_official_match",
      fields: { lpi: "c03400140000096200000" },
    });
    expect(searchOfficialParcels("E108C034001400000962000000", parcelIndex)[0]).toMatchObject({
      confidence: "exact_official_match",
      fields: { parcelKey: "e108c034001400000962000000" },
    });
  });

  it("returns multiple erf-only candidates but ranks erf plus town context first", () => {
    const erfOnly = searchOfficialParcels("Erf 962", parcelIndex);
    expect(erfOnly).toHaveLength(2);
    expect(searchOfficialParcels("Erf 962 Sea Vista", parcelIndex)[0].fields.town).toBe(
      "Sea Vista",
    );
    expect(searchOfficialParcels("8 Harbour Road St Francis Bay", parcelIndex)[0].fields.lpi).toBe(
      "c03400140000096200000",
    );
  });

  it("prefers visible map area context for erf-only searches", () => {
    expect(
      searchOfficialParcels("Erf 962", parcelIndex, {
        visibleAreaTerms: ["sea", "vista", "kouga", "eastern", "cape"],
      })[0],
    ).toMatchObject({
      matchReason: "Official erf match inside visible map area",
      fields: { lpi: "c03400140000096200000" },
    });
  });

  it("returns the official parcel for a coordinate inside the polygon", () => {
    expect(searchByCoordinate(-34.1717374, 24.8314966, parcelIndex)).toMatchObject({
      confidence: "address_inside_official_parcel",
      fields: { lpi: "c03400140000096200000" },
    });
  });

  it("does not invent details for coordinates outside loaded polygons", () => {
    expect(searchByCoordinate(-35, 25, parcelIndex)).toBeNull();
    expect(searchOfficialParcels("No Such Erf", parcelIndex)).toEqual([]);
  });

  it("keeps pilot demo examples out of official search results", () => {
    expect(searchOfficialParcels("pilot demo example", parcelIndex)).toEqual([]);
  });
});
