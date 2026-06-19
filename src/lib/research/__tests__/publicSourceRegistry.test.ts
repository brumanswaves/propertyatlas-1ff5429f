import { describe, expect, it } from "vitest";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "../publicSourceRegistry";

const baseParcel: NormalizedOfficialParcel = {
  id: "csg:lpi:c01900000000007480000",
  source: "csg",
  sourceLabel: "Chief Surveyor-General",
  layer: "csg-parcels",
  erfNumber: "748",
  portion: "0",
  lpi: "C01900000000007480000",
  parcelKey: "PK-748",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  suburbOrArea: "St Francis Bay",
  coordinates: { lng: 24.83, lat: -34.16 },
  knownFields: [],
  missingFields: [],
};

describe("public source registry", () => {
  it("generates search urls from known parcel fields", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const planning = sources.find((source) => source.id === "planning-public-notices");

    expect(planning?.status).toBe("open-search");
    expect(planning?.url).toContain("google.com/search");
    expect(decodeURIComponent(planning?.url ?? "")).toContain("Erf 748");
    expect(decodeURIComponent(planning?.url ?? "")).toContain("Kouga Local Municipality");
  });

  it("returns manual check state when required fields are missing", () => {
    const sources = buildPublicResearchSources({
      ...baseParcel,
      erfNumber: null,
      municipality: null,
    });
    const planning = sources.find((source) => source.id === "planning-public-notices");

    expect(planning?.status).toBe("manual-check");
    expect(planning?.url).toBeNull();
    expect(planning?.missingFields).toEqual(["erfNumber", "municipality"]);
  });

  it("does not attach paid provider urls or fake paid data", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const paid = sources.find((source) => source.id === "paid-report-slots");

    expect(paid?.status).toBe("paid-report");
    expect(paid?.url).toBeNull();
    expect(paid?.complianceNote).toContain("not yet attached");
  });

  it("generates unverified listing research URLs when enough fields exist", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const listingIds = [
      "property24-search",
      "private-property-search",
      "google-listing-search",
      "google-images-market-evidence",
      "google-maps-listing-context",
    ];

    for (const id of listingIds) {
      const source = sources.find((item) => item.id === id);

      expect(source?.status).toBe("open-search");
      expect(source?.url).toBeTruthy();
      expect(source?.complianceNote.toLowerCase()).toContain("verif");
    }
  });
});
