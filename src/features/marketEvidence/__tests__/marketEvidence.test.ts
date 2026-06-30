import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  evidenceFromCandidate,
  runActiveListingRadar,
  scoreListingCandidate,
} from "../activeListingRadar";
import {
  buildAddressCandidate,
  googleMapsPointUrl,
  marketAddressToPropertyIdentityOverride,
  parseMarketAddressIntelligence,
} from "../addressIntelligence";
import {
  filterCandidatesByArea,
  filterCandidatesByPropertyType,
  filterCandidatesBySource,
  runAreaListingRadar,
} from "../areaRadar";
import { calculateMarketEvidenceSummary } from "../calculateMarketEvidenceSummary";
import { generateMarketEvidenceActions } from "../generateMarketEvidenceActions";
import { buildSimpleListingSearches, resolvePropertyIdentity } from "../propertyIdentity";
import type { AreaRadarOptions, ListingCandidate, SavedMarketEvidence } from "../types";

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

describe("property identity and simple listing searches", () => {
  it("resolves full addresses with high or medium confidence", () => {
    const identity = resolvePropertyIdentity(parcel());

    expect(identity.bestAddress).toBe("8 Harbour Drive");
    expect(["high", "medium"]).toContain(identity.confidence);
    expect(identity.canSearchExactAddress).toBe(true);
  });

  it("preserves the Erf 962 Harbour Road showcase identity", () => {
    const identity = resolvePropertyIdentity(
      parcel({
        knownFields: [],
        suburbOrArea: "Sea Vista",
        town: "St Francis Bay",
      }),
    );

    expect(identity.bestAddress).toBe("8 Harbour Road");
    expect(identity.addressSource).toBe("seeded_showcase");
    expect(identity.marketSuburb).toBe("Santareme");
  });

  it("allows street search but not exact search for street-only parcels", () => {
    const identity = resolvePropertyIdentity(
      parcel({
        erfNumber: "123",
        lpi: "OTHER",
        parcelKey: "OTHER",
        knownFields: [{ label: "Street", value: "Harbour Drive", source: "CSG" }],
      }),
    );

    expect(identity.bestAddress).toBeUndefined();
    expect(identity.canSearchExactAddress).toBe(false);
    expect(identity.canSearchStreet).toBe(true);
  });

  it("allows nearby search for suburb-only parcels", () => {
    const identity = resolvePropertyIdentity(
      parcel({
        erfNumber: "123",
        lpi: "OTHER",
        parcelKey: "OTHER",
        knownFields: [],
        suburbOrArea: "Cape St Francis",
      }),
    );

    expect(identity.addressSource).toBe("area_only");
    expect(identity.canSearchNearby).toBe(true);
  });

  it("warns when province is missing", () => {
    const identity = resolvePropertyIdentity(parcel({ province: null }));

    expect(identity.warnings.some((warning) => warning.includes("Province missing"))).toBe(true);
  });

  it("marks missing address and area as needing confirmation", () => {
    const identity = resolvePropertyIdentity(
      parcel({
        erfNumber: "123",
        lpi: "OTHER",
        parcelKey: "OTHER",
        knownFields: [],
        suburbOrArea: null,
        town: null,
        municipality: null,
        province: null,
      }),
    );

    expect(identity.confidence).toBe("needs_confirmation");
    expect(identity.canSearchNearby).toBe(false);
  });

  it("builds limited simple searches from address, street and area context", () => {
    const identity = resolvePropertyIdentity(parcel());
    const searches = buildSimpleListingSearches(identity);
    const labels = searches.map((search) => search.label);

    expect(labels).toContain("Search exact address");
    expect(labels).toContain("Search same street");
    expect(labels).toContain("Search nearby comps");
    expect(searches.length).toBeLessThanOrEqual(5);
    expect(searches[0].phrase).toContain("8 Harbour");
  });

  it("does not make Google a primary simple search portal", () => {
    const searches = buildSimpleListingSearches(resolvePropertyIdentity(parcel()));
    const portals = searches.flatMap((search) =>
      search.primaryPortalUrls.map((portal) => portal.portal),
    );

    expect(portals).toContain("Property24");
    expect(portals).toContain("Private Property");
    expect(portals.some((portal) => /Google/i.test(portal))).toBe(false);
  });
});

describe("address intelligence and area radar", () => {
  const options = (overrides: Partial<AreaRadarOptions> = {}): AreaRadarOptions => ({
    scope: "10km",
    source: "all",
    propertyType: "all",
    sort: "best_match",
    ...overrides,
  });
  const listing = (overrides: Partial<ListingCandidate> = {}): ListingCandidate => ({
    id: "area-candidate",
    sourceType: "manual_import",
    sourcePortal: "Property24",
    sourceUrl: "https://www.property24.com/listing/area",
    title: "Cape St Francis vacant land",
    askingPrice: 1_500_000,
    propertyType: "Vacant land",
    locationText: "Cape St Francis",
    microMarket: "Cape St Francis",
    suburb: "Cape St Francis",
    town: "St Francis Bay",
    municipality: "Kouga",
    province: "Eastern Cape",
    streetName: "Harbour Drive",
    descriptionText: "Vacant stand in Cape St Francis",
    beds: null,
    baths: null,
    landSizeM2: 900,
    buildingSizeM2: null,
    agencyName: null,
    imageUrl: null,
    listingStatus: "active",
    fetchedAt: null,
    lastSeenAt: "2026-06-01T00:00:00.000Z",
    importedAt: "2026-06-01T00:00:00.000Z",
    rawSourceArea: "Cape St Francis",
    lat: -34.1001,
    lng: 24.8001,
    ...overrides,
  });

  it("builds a Google Maps parcel point URL without requiring an API key", () => {
    expect(googleMapsPointUrl({ lat: -34.1, lng: 24.8 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=-34.1,24.8",
    );
  });

  it("stores user-entered address intelligence without overwriting official parcel address", () => {
    const candidate = buildAddressCandidate({
      formattedAddress: "10 Harbour Drive, Cape St Francis",
      streetNumber: "10",
      streetName: "Harbour Drive",
      suburb: "Cape St Francis",
      source: "user_entered",
    });
    const parsed = parseMarketAddressIntelligence({
      selectedAddressId: candidate.id,
      candidates: [candidate],
      userConfirmedAddress: candidate,
    });
    const override = marketAddressToPropertyIdentityOverride(candidate);
    const official = resolvePropertyIdentity(parcel());
    const market = resolvePropertyIdentity(parcel(), override);

    expect(parsed?.userConfirmedAddress?.formattedAddress).toBe(
      "10 Harbour Drive, Cape St Francis",
    );
    expect(official.bestAddress).toBe("8 Harbour Drive");
    expect(market.bestAddress).toBe("10 Harbour Drive, Cape St Francis");
  });

  it("uses selected market address for radar scoring", () => {
    const marketAddress = buildAddressCandidate({
      formattedAddress: "10 Harbour Drive, Cape St Francis",
      streetName: "Harbour Drive",
      suburb: "Cape St Francis",
    });
    const match = scoreListingCandidate(
      parcel({ knownFields: [] }),
      listing({
        title: "10 Harbour Drive Cape St Francis",
        locationText: "10 Harbour Drive, Cape St Francis",
      }),
      marketAddress,
    );

    expect(match.matchedSignals).toContain("exact_address_match");
  });

  it("filters 10km coordinate candidates and keeps text-only area matches", () => {
    const candidates = [
      listing({ id: "near", lat: -34.101, lng: 24.801 }),
      listing({ id: "text-only", lat: null, lng: null, suburb: "Cape St Francis" }),
      listing({
        id: "far",
        title: "Sandton townhouse",
        locationText: "Sandton",
        microMarket: null,
        rawSourceArea: "Sandton",
        descriptionText: "Urban townhouse",
        lat: -26.2,
        lng: 28.0,
        suburb: "Sandton",
        town: "Johannesburg",
      }),
    ];
    const filtered = filterCandidatesByArea(parcel(), candidates, options({ scope: "10km" }));

    expect(filtered.map((item) => item.id)).toContain("near");
    expect(filtered.map((item) => item.id)).toContain("text-only");
    expect(filtered.map((item) => item.id)).not.toContain("far");
  });

  it("filters by source and property type", () => {
    const candidates = [
      listing({ id: "p24-land", sourcePortal: "Property24", propertyType: "Vacant land" }),
      listing({
        id: "seeff-house",
        sourcePortal: "Seeff",
        propertyType: "House",
        title: "Family house",
        descriptionText: "Residential house",
      }),
    ];

    expect(filterCandidatesBySource(candidates, "Property24").map((item) => item.id)).toEqual([
      "p24-land",
    ]);
    expect(
      filterCandidatesByPropertyType(candidates, "vacant_land").map((item) => item.id),
    ).toEqual(["p24-land"]);
  });

  it("runs area radar with candidate area reasons and never claims live portal scan", () => {
    const results = runAreaListingRadar(
      parcel(),
      [listing()],
      options({ source: "Property24", propertyType: "vacant_land" }),
    );

    expect(results[0].areaReasons).toContain("within 10km");
    expect(results[0].areaReasons).toContain("source matches Property24");
    expect(results[0].areaReasons).toContain("property type matches selected filter");
  });
});

describe("active listing radar", () => {
  const candidate = (overrides: Partial<ListingCandidate> = {}): ListingCandidate => ({
    id: "candidate-one",
    sourceType: "manual_import",
    sourcePortal: "Property24",
    sourceUrl: "https://www.property24.com/listing/one",
    title: "8 Harbour Drive Cape St Francis",
    askingPrice: 2_750_000,
    propertyType: "Vacant land",
    locationText: "8 Harbour Drive, Cape St Francis",
    microMarket: "Cape St Francis",
    suburb: "Cape St Francis",
    town: "St Francis Bay",
    municipality: "Kouga",
    province: "Eastern Cape",
    streetName: "Harbour Drive",
    descriptionText: "Erf 962 vacant stand near the harbour.",
    beds: null,
    baths: null,
    landSizeM2: 912,
    buildingSizeM2: null,
    agencyName: "Source-backed agency",
    imageUrl: null,
    listingStatus: "active",
    fetchedAt: null,
    lastSeenAt: null,
    importedAt: "2026-06-01T00:00:00.000Z",
    rawSourceArea: "Cape St Francis",
    lat: -34.1001,
    lng: 24.8001,
    ...overrides,
  });

  it("sorts radar candidates by score and hides candidates below threshold", () => {
    const results = runActiveListingRadar(parcel(), [
      candidate({ id: "weak", title: "Eastern Cape property", descriptionText: "" }),
      candidate({ id: "strong" }),
      candidate({
        id: "hidden",
        title: "Johannesburg townhouse",
        locationText: "Sandton",
        microMarket: null,
        suburb: "Sandton",
        town: "Johannesburg",
        municipality: "City of Johannesburg",
        province: "Gauteng",
        streetName: "Other Road",
        descriptionText: "Urban townhouse",
        rawSourceArea: "Sandton",
        landSizeM2: 111,
        lat: null,
        lng: null,
      }),
    ]);

    expect(results[0].candidate.id).toBe("strong");
    expect(results.some((result) => result.candidate.id === "hidden")).toBe(false);
  });

  it("scores exact address, erf mention and land-size matches high without confirmed labels", () => {
    const match = scoreListingCandidate(parcel(), candidate());

    expect(match.score).toBeGreaterThanOrEqual(85);
    expect(match.classification).toBe("possible_target_property");
    expect(match.matchedSignals).toContain("exact_address_match");
    expect(match.matchedSignals).toContain("erf_number_mentioned");
    expect(match.matchedSignals).toContain("land_size_exact");
    expect(match.classification).not.toContain("confirmed");
  });

  it("scores street plus micro-market as a comparable", () => {
    const match = scoreListingCandidate(
      parcel(),
      candidate({
        title: "Harbour Drive coastal plot",
        locationText: "Harbour Drive",
        descriptionText: "Vacant stand in Cape St Francis",
        landSizeM2: 730,
        lat: null,
        lng: null,
      }),
    );

    expect(match.score).toBeGreaterThanOrEqual(50);
    expect(["same_street_comp", "same_node_comp"]).toContain(match.classification);
  });

  it("does not treat same suburb only as a possible target", () => {
    const match = scoreListingCandidate(
      parcel(),
      candidate({
        title: "Cape St Francis home",
        locationText: "Cape St Francis",
        descriptionText: "",
        streetName: null,
        landSizeM2: null,
        lat: null,
        lng: null,
      }),
    );

    expect(match.classification).not.toBe("possible_target_property");
  });

  it("adds vacant-land signal for vacant-land subject and handles missing coordinates or size", () => {
    const vacantParcel = parcel({
      knownFields: [
        { label: "Zoning description", value: "Vacant undeveloped stand", source: "Kouga" },
      ],
    });
    const match = scoreListingCandidate(
      vacantParcel,
      candidate({ landSizeM2: null, lat: null, lng: null }),
    );

    expect(match.matchedSignals).toContain("vacant_land_match");
    expect(match.score).toBeGreaterThan(0);
  });

  it("converts classified candidates to saved evidence without mixing unverified candidates", () => {
    const match = scoreListingCandidate(parcel(), candidate());
    const evidence = evidenceFromCandidate(candidate(), match, "same_street_comp");
    const excluded = evidenceFromCandidate(candidate(), match, "not_related");

    expect(evidence.sourceUrl).toBe("https://www.property24.com/listing/one");
    expect(evidence.includeInSummary).toBe(true);
    expect(evidence.notes).toContain("Added from Active Listing Radar");
    expect(excluded.confidence).toBe("excluded");
    expect(excluded.includeInSummary).toBe(false);
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
