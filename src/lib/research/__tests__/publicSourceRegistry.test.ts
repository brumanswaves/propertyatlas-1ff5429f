import { describe, expect, it } from "vitest";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "../publicSourceRegistry";
import { matchesErf962HarbourRoad } from "../seedParcels/erf962HarbourRoad";

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

const erf962Parcel: NormalizedOfficialParcel = {
  ...baseParcel,
  id: "csg:lpi:c03400140000096200000",
  erfNumber: "962",
  portion: "0",
  lpi: "C03400140000096200000",
  parcelKey: "E108C034001400000962000000",
  suburbOrArea: "Santareme / St Francis Bay / Sea Vista",
  knownFields: [{ label: "Address", value: "8 Harbour Road", source: "Seed fixture" }],
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

  it("detects Erf 962 Harbour Road and includes parcel-specific evidence", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const valuation = sources.find((source) => source.id === "erf-962-kouga-valuation-roll-2014");

    expect(matchesErf962HarbourRoad(erf962Parcel)).toBe(true);
    expect(valuation?.parcelSpecific).toBe(true);
    expect(valuation?.confidence).toBe("confirmed_for_parcel");
    expect(valuation?.fieldsFound).toContain("Historic municipal value: R1,700,000");
    expect(valuation?.complianceNote).toContain("not current market value");
  });

  it("adds Erf 962 generated searches", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const queries = sources
      .filter((source) => source.dossierGroup === "generated-searches")
      .map((source) => source.name);

    expect(queries).toContain(`"8 Harbour Road" "St Francis Bay"`);
    expect(queries).toContain(`"SEA VISTA" "00000962"`);
    expect(queries).toContain(`site:airbnb.com "8 Harbour Road" "Saint Francis Bay"`);
  });

  it("groups sources for the dossier library", () => {
    const sources = buildPublicResearchSources(erf962Parcel);

    expect(sources.some((source) => source.dossierGroup === "official-parcel-identity")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "municipal-evidence")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "rental-tourism")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "paid-reports")).toBe(true);
  });

  it("does not add Erf 962 evidence to other parcels", () => {
    const sources = buildPublicResearchSources(baseParcel);

    expect(
      sources.find((source) => source.id === "erf-962-kouga-valuation-roll-2014"),
    ).toBeUndefined();
  });

  it("does not fabricate owner names or current valuation fields", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const foundFields = sources.flatMap((source) => source.fieldsFound ?? []);

    expect(foundFields.some((field) => /owner/i.test(field))).toBe(false);
    expect(foundFields.some((field) => /current (market )?value/i.test(field))).toBe(false);
  });
});
