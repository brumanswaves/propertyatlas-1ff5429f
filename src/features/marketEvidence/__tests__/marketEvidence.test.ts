import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { calculateMarketEvidenceSummary } from "../calculateMarketEvidenceSummary";
import { generateMarketEvidenceActions } from "../generateMarketEvidenceActions";
import type { SavedMarketEvidence } from "../types";

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "csg:erf:eastern-cape:kouga:962:0",
    source: "csg",
    sourceLabel: "Chief Surveyor-General",
    erfNumber: "962",
    portion: "0",
    lpi: "C03400140000096200000",
    parcelKey: "E108C034001400000962000000",
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Cape St Francis",
    town: "St Francis Bay",
    coordinates: { lng: 24.8, lat: -34.1 },
    knownFields: [
      { label: "Address", value: "8 Harbour Drive", source: "User" },
      { label: "Street", value: "Harbour Drive", source: "User" },
      { label: "Geometry area", value: "912", source: "CSG" },
    ],
    missingFields: [],
    ...overrides,
  };
}

describe("market evidence generation", () => {
  it("generates exact, address, street, nearby and broad ladder items for an official erf", () => {
    const result = generateMarketEvidenceActions(parcel());
    const phrases = result.searchLadder.map((item) => item.phrase);

    expect(phrases).toContain("Erf 962 Cape St Francis");
    expect(phrases).toContain("8 Harbour Drive Cape St Francis");
    expect(phrases).toContain("Harbour Drive Cape St Francis");
    expect(phrases).toContain("St Francis Bay property for sale");
    expect(phrases).toContain("Eastern Cape coastal property for sale");
    expect(result.searchLadder.length).toBeGreaterThan(5);
  });

  it("works without address and falls back to town or municipality", () => {
    const result = generateMarketEvidenceActions(
      parcel({
        knownFields: [],
        suburbOrArea: null,
        town: "Humansdorp",
      }),
    );

    expect(result.searchLadder.some((item) => item.phrase.includes("Humansdorp"))).toBe(true);
    expect(result.searchLadder.length).toBeGreaterThan(1);
  });

  it("generates vacant land terminology", () => {
    const result = generateMarketEvidenceActions(
      parcel({
        knownFields: [
          { label: "Zoning description", value: "Vacant undeveloped stand", source: "Kouga" },
        ],
      }),
    );
    const phrases = result.searchLadder.map((item) => item.phrase).join(" ");

    expect(phrases).toContain("plot");
    expect(phrases).toContain("stand");
    expect(phrases).toContain("vacant land");
    expect(phrases).toContain("erf");
  });

  it("prioritizes sectional-title scheme/address terms", () => {
    const result = generateMarketEvidenceActions(
      parcel({
        knownFields: [
          { label: "Scheme", value: "Harbour Views Scheme", source: "User" },
          { label: "Address", value: "8 Harbour Drive", source: "User" },
        ],
      }),
    );

    expect(result.context.category).toBe("sectional_title");
    expect(result.searchLadder[0].label).toBe("Scheme or complex");
  });

  it("promotes farm/smallholding searches and lowers residential priority", () => {
    const result = generateMarketEvidenceActions(
      parcel({
        knownFields: [{ label: "Farm number", value: "Farm 123", source: "CSG" }],
        suburbOrArea: null,
        municipality: "Kouga",
      }),
    );

    expect(result.context.category).toBe("farm_smallholding");
    expect(result.searchLadder.some((item) => item.label === "Farm / smallholding")).toBe(true);
    expect(result.portalActions[0].group).toBe("farm_smallholding");
  });

  it("warns when province is missing and keeps deterministic action ids", () => {
    const result = generateMarketEvidenceActions(parcel({ province: null }));
    const again = generateMarketEvidenceActions(parcel({ province: null }));

    expect(result.context.warnings.some((warning) => warning.includes("Province missing"))).toBe(
      true,
    );
    expect(result.portalActions.map((action) => action.id)).toEqual(
      again.portalActions.map((action) => action.id),
    );
  });

  it("keeps Google as a fallback and excludes paid report providers", () => {
    const actions = generateMarketEvidenceActions(parcel()).portalActions;

    expect(actions[0].portal).not.toContain("Google");
    expect(actions.at(-1)?.portal).toContain("Google");
    expect(actions.some((action) => /Lightstone|WinDeed/i.test(action.portal))).toBe(false);
    expect(actions.every((action) => action.helperText && action.searchPhrase !== undefined)).toBe(
      true,
    );
  });
});

describe("market evidence summary", () => {
  const base: SavedMarketEvidence = {
    id: "one",
    parcelId: "parcel",
    sourceUrl: "https://example.com/one",
    sourcePortal: "Property24",
    title: "Comp",
    askingPrice: 2_000_000,
    landSizeM2: 500,
    buildingSizeM2: 200,
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    savedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("calculates price and R/m2 metrics from included evidence only", () => {
    const summary = calculateMarketEvidenceSummary([
      base,
      {
        ...base,
        id: "two",
        sourceUrl: "https://example.com/two",
        askingPrice: 3_000_000,
        landSizeM2: 600,
      },
      { ...base, id: "excluded", relationship: "not_related", askingPrice: 9_000_000 },
    ]);

    expect(summary.totalEvidence).toBe(3);
    expect(summary.includedEvidence).toBe(2);
    expect(summary.averageAskingPrice).toBe(2_500_000);
    expect(summary.medianAskingPrice).toBe(2_500_000);
    expect(summary.averageLandPricePerM2).toBe(4_500);
    expect(summary.averageBuildingPricePerM2).toBe(12_500);
  });

  it("reports no usable price data when priced evidence is missing", () => {
    const summary = calculateMarketEvidenceSummary([{ ...base, askingPrice: null }]);

    expect(summary.hasUsablePriceData).toBe(false);
    expect(summary.averageAskingPrice).toBeUndefined();
  });
});
