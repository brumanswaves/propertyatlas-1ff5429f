import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  buildStrategyPropertyInputFacts,
  strategyDefaultsFromPropertyFacts,
} from "../strategyInputs";
import { resolveSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "csg:lpi:C03400140000157000000",
    sourceLabel: "Chief Surveyor-General",
    erfNumber: 1570,
    portion: 0,
    lpi: "C03400140000157000000",
    parcelKey: "E108C034001400001570000000",
    municipality: "Kouga",
    province: "Eastern Cape",
    suburbOrArea: "Cape St Francis",
    knownFields: [],
    missingFields: [],
    rawProperties: {
      GEOM_AREA: 618.7,
      ERF_NO: 1570,
    },
    coordinates: { lng: 24.83, lat: -34.2 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

describe("strategy property-derived inputs", () => {
  it("prefills Erf 1570 area from canonical parcel state with official provenance", () => {
    const facts = buildStrategyPropertyInputFacts({ parcel: parcel() });
    const area = facts.find((item) => item.key === "erfAreaM2");
    const defaults = strategyDefaultsFromPropertyFacts(facts);

    expect(area).toMatchObject({
      value: 618.7,
      unit: "m²",
      source: "Chief Surveyor-General GEOM_AREA",
      state: "verified_property",
      editable: false,
      originalPropertyValue: 618.7,
    });
    expect(defaults.erfAreaM2).toBe("618.7");
  });

  it("keeps working coverage and footprint clearly marked as assumptions", () => {
    const facts = buildStrategyPropertyInputFacts({
      parcel: parcel(),
      resolvedSitePotentialInputs: resolveSitePotentialInputs({
        overrides: {
          boundaryConfirmed: false,
          streetEdgeIndex: null,
          streetName: null,
          ruleSource: "manual",
          zoneLabel: null,
          streetSetbackM: null,
          sideSetbackM: null,
          rearSetbackM: null,
          maxHeightM: null,
          dwellingUnits: null,
          additionalDwellingRule: null,
          additionalDwellingRequiresConsent: true,
          servitudeNotes: null,
          recordedAreaM2: null,
          maxCoveragePercent: 50,
        },
      }),
    });
    const coverage = facts.find((item) => item.key === "coveragePercent");
    const footprint = facts.find((item) => item.key === "theoreticalFootprintM2");
    const defaults = strategyDefaultsFromPropertyFacts(facts);

    expect(coverage).toMatchObject({
      value: 50,
      state: "working_assumption",
      source: "Entered by you. Treated as your own assumption, not an official rule.",
    });
    expect(coverage?.warning).toContain("not an approved building right");
    expect(footprint).toMatchObject({
      value: 309.35,
      state: "derived_from_working_assumption",
    });
    expect(footprint?.evidence).toContain("618.7 m² × 50% = 309.35 m²");
    expect(defaults.theoreticalFootprintM2).toBe("309.35");
    expect(defaults.buildAreaM2).toBeUndefined();
    expect(defaults.floorAreaM2).toBeUndefined();
  });

  it("does not treat a stale document rule source as verified planning evidence", () => {
    const facts = buildStrategyPropertyInputFacts({
      parcel: parcel(),
      resolvedSitePotentialInputs: resolveSitePotentialInputs({
        overrides: {
          boundaryConfirmed: false,
          streetEdgeIndex: null,
          streetName: null,
          ruleSource: "document",
          zoneLabel: null,
          streetSetbackM: null,
          sideSetbackM: null,
          rearSetbackM: null,
          maxHeightM: null,
          dwellingUnits: null,
          additionalDwellingRule: null,
          additionalDwellingRequiresConsent: true,
          servitudeNotes: null,
          recordedAreaM2: null,
          maxCoveragePercent: 50,
        },
      }),
    });
    const coverage = facts.find((item) => item.key === "coveragePercent");
    const footprint = facts.find((item) => item.key === "theoreticalFootprintM2");

    expect(coverage).toMatchObject({
      value: 50,
      state: "working_assumption",
    });
    expect(coverage?.source).not.toContain("document");
    expect(coverage?.evidence).toContain("not yet verified");
    expect(footprint).toMatchObject({
      value: 309.35,
      state: "derived_from_working_assumption",
    });
  });

  it("allows a Site Potential concept to prefill build area without claiming approval", () => {
    const facts = buildStrategyPropertyInputFacts({
      parcel: parcel(),
      sitePotentialDraft: {
        source: "site-potential",
        conceptTitle: "Compact courtyard duplex",
        buildableSqm: "280",
      },
    });
    const concept = facts.find((item) => item.key === "sitePotentialBuildAreaM2");
    const defaults = strategyDefaultsFromPropertyFacts(facts);

    expect(concept).toMatchObject({
      value: 280,
      state: "concept_assumption",
      editable: true,
    });
    expect(concept?.warning).toContain("do not override verified planning constraints");
    expect(defaults.buildAreaM2).toBe("280");
  });

  it("keeps user overrides separate from the original property-derived value", () => {
    const facts = buildStrategyPropertyInputFacts({ parcel: parcel() });
    const area = facts.find((item) => item.key === "erfAreaM2");
    const draftInputs = { ...strategyDefaultsFromPropertyFacts(facts), erfAreaM2: "620" };

    expect(draftInputs.erfAreaM2).toBe("620");
    expect(area?.originalPropertyValue).toBe(618.7);
    expect(area?.value).toBe(618.7);
  });
});
