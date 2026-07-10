import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizePilotParcelRegistry,
  searchPilotParcelRegistry,
  type PilotParcelRegistryPayload,
} from "@/lib/search/pilotParcelRegistry";

const payload: PilotParcelRegistryPayload = {
  metadata: {
    name: "Kouga / St Francis pilot parcel registry",
    pilotArea: "Kouga / St Francis pilot only",
    sourceUrl: "https://example.com/FeatureServer/32/query",
    sourceLabel: "Pilot parcel registry / CSG public parcel layer",
    fetchedAt: "2026-07-10T00:00:00.000Z",
    recordCount: 3,
    note: "This is not national erf search.",
  },
  records: [
    {
      id: "csg:lpi:c03400140000102100000",
      erf: "1021",
      portion: "0",
      township: "SEA VISTA",
      municipality: "Kouga",
      province: "EASTERN CAPE",
      lpi: "C03400140000102100000",
      parcelKey: "E108C034001400001021000000",
      lat: -34.1738007346513,
      lng: 24.8348574696859,
      areaSqm: 857.46,
      sourceLayer: "csg-parcels",
      sourceLabel: "Pilot parcel registry / CSG public parcel layer",
      confidence: "source-backed",
      sourceQuality: "official_public_layer",
      properties: {
        PARCEL_NO: 1021,
        PORTION: 0,
        MIN_REGION: "SEA VISTA",
        MAJ_REGION: "HUMANSDORP",
        PROVINCE: "EASTERN CAPE",
        ID: "C03400140000102100000",
        PRCL_KEY: "E108C034001400001021000000",
      },
    },
    {
      id: "csg:lpi:c03400150000102100000",
      erf: "1021",
      portion: "0",
      township: "CAPE ST FRANCIS",
      municipality: "Kouga",
      province: "EASTERN CAPE",
      lpi: "C03400150000102100000",
      parcelKey: "E108C034001500001021000000",
      lat: -34.205,
      lng: 24.839,
      sourceLayer: "csg-parcels",
      sourceLabel: "Pilot parcel registry / CSG public parcel layer",
      confidence: "source-backed",
      sourceQuality: "official_public_layer",
      properties: {
        PARCEL_NO: 1021,
        PORTION: 0,
        MIN_REGION: "CAPE ST FRANCIS",
        MAJ_REGION: "HUMANSDORP",
        PROVINCE: "EASTERN CAPE",
        ID: "C03400150000102100000",
        PRCL_KEY: "E108C034001500001021000000",
      },
    },
    {
      id: "csg:lpi:c03400140000383800000",
      erf: "3838",
      portion: "0",
      township: "SEA VISTA",
      municipality: "Kouga",
      province: "EASTERN CAPE",
      lpi: "C03400140000383800000",
      parcelKey: "E108C034001400003838000000",
      lat: -34.1731094327744,
      lng: 24.8332660114564,
      sourceLayer: "csg-parcels",
      sourceLabel: "Pilot parcel registry / CSG public parcel layer",
      confidence: "source-backed",
      sourceQuality: "official_public_layer",
      properties: {
        PARCEL_NO: 3838,
        PORTION: 0,
        MIN_REGION: "SEA VISTA",
        MAJ_REGION: "HUMANSDORP",
        PROVINCE: "EASTERN CAPE",
        ID: "C03400140000383800000",
        PRCL_KEY: "E108C034001400003838000000",
      },
    },
  ],
};

describe("pilot parcel registry", () => {
  const registry = normalizePilotParcelRegistry(payload);

  it("searches by erf number and keeps multiple same-erf candidates", () => {
    const results = searchPilotParcelRegistry("1021", registry.parcels);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.fields.town)).toEqual(
      expect.arrayContaining(["SEA VISTA", "CAPE ST FRANCIS"]),
    );
  });

  it("ranks township context above other same-erf matches", () => {
    expect(searchPilotParcelRegistry("1021 Sea Vista", registry.parcels)[0]).toMatchObject({
      fields: { erf: "1021", town: "SEA VISTA", municipality: "Kouga" },
      sourceLabel: "Pilot parcel registry / CSG public parcel layer",
    });
  });

  it("returns exact LPI and parcel key matches", () => {
    expect(searchPilotParcelRegistry("C03400140000383800000", registry.parcels)[0]).toMatchObject({
      confidence: "exact_official_match",
      fields: { erf: "3838" },
    });
    expect(
      searchPilotParcelRegistry("E108C034001400001021000000", registry.parcels)[0],
    ).toMatchObject({
      confidence: "exact_official_match",
      fields: { town: "SEA VISTA" },
    });
  });

  it("provides coordinates for zoom/open without claiming national search", () => {
    const result = searchPilotParcelRegistry("3838 Sea Vista", registry.parcels)[0];
    expect(result.parcel?.centroid).toEqual({ lng: 24.8332660114564, lat: -34.1731094327744 });
    expect(payload.metadata.pilotArea).toContain("Kouga / St Francis");
    expect(payload.metadata.note).toContain("not national erf search");
  });

  it("generated registry contains source-backed pilot records", () => {
    const generated = JSON.parse(
      readFileSync("public/data/kouga-st-francis-pilot-parcels.json", "utf8"),
    ) as PilotParcelRegistryPayload;
    expect(generated.metadata.sourceUrl).toContain("Kouga_SG_Properties/FeatureServer/32/query");
    expect(generated.metadata.recordCount).toBeGreaterThan(0);
    expect(generated.records.some((record) => record.erf === "1021")).toBe(true);
    expect(generated.records.some((record) => record.erf === "3131")).toBe(true);
    expect(generated.records.some((record) => record.erf === "3838")).toBe(true);
  });
});
