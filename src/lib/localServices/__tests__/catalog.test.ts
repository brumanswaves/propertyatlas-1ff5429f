import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  buildGoogleMapsFallbackUrl,
  canShowEasyErfVerified,
  canShowSponsored,
  categoriesForGroup,
  inferLocalPropertyState,
  orderedLocalServiceGroups,
  type LocalProvider,
} from "@/lib/localServices/catalog";

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "csg:test",
    source: "csg",
    sourceLabel: "Chief Surveyor-General",
    layer: "csg-parcels",
    erfNumber: "224",
    portion: "0",
    lpi: "TEST-LPI",
    parcelKey: "TEST-KEY",
    objectId: 1,
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Sea Vista",
    town: "Humansdorp",
    coordinates: { lat: -34.1, lng: 24.8 },
    knownFields: [],
    missingFields: [],
    rawProperties: {},
    ...overrides,
  };
}

function provider(overrides: Partial<LocalProvider> = {}): LocalProvider {
  return {
    placeId: "place-1",
    name: "Provider",
    categoryId: "builders-contractors",
    address: null,
    coordinates: null,
    rating: null,
    reviewCount: null,
    phone: null,
    websiteUrl: null,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=provider",
    businessStatus: "OPERATIONAL",
    distanceKm: null,
    source: "google",
    isSponsored: false,
    sponsorshipLabel: null,
    isEasyErfVerified: false,
    verificationStatus: null,
    verificationDate: null,
    serviceAreas: [],
    categories: [],
    leadTrackingId: null,
    ...overrides,
  };
}

describe("Local Property Team catalog", () => {
  it("prioritizes Plan and Build for vacant land", () => {
    expect(orderedLocalServiceGroups("vacant_land")[0]?.id).toBe("plan-build");
    expect(categoriesForGroup("plan-build", "vacant_land").map((item) => item.id)).toContain(
      "land-surveyors",
    );
  });

  it("prioritizes Protect and Maintain for an existing home", () => {
    expect(orderedLocalServiceGroups("existing_home")[0]?.id).toBe("protect-maintain");
    expect(categoriesForGroup("protect-maintain", "existing_home").map((item) => item.id)).toContain(
      "property-inspectors",
    );
  });

  it("uses the saved Site Potential state before loose parcel text", () => {
    expect(inferLocalPropertyState(parcel(), "vacant_land")).toBe("vacant_land");
    expect(inferLocalPropertyState(parcel(), "renovation")).toBe("existing_home");
  });

  it("builds a working Google Maps fallback from the property area", () => {
    const category = categoriesForGroup("plan-build", "vacant_land")[0];
    const url = buildGoogleMapsFallbackUrl(category, parcel());
    expect(url).toContain("https://www.google.com/maps/search/");
    expect(decodeURIComponent(url)).toContain("Sea Vista");
    expect(decodeURIComponent(url)).toContain(category.searchQuery);
  });

  it("cannot show Sponsored or Easy Erf Verified without complete real data", () => {
    expect(canShowSponsored(provider())).toBe(false);
    expect(canShowSponsored(provider({ isSponsored: true, sponsorshipLabel: "Sponsored" }))).toBe(true);
    expect(canShowEasyErfVerified(provider({ isEasyErfVerified: true }))).toBe(false);
    expect(
      canShowEasyErfVerified(
        provider({
          isEasyErfVerified: true,
          verificationStatus: "verified",
          verificationDate: "2026-07-15",
        }),
      ),
    ).toBe(true);
  });
});
