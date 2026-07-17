import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalProvider } from "@/lib/localServices/catalog";
import {
  readSavedLocalProviders,
  toggleSavedLocalProvider,
  writeSavedLocalProviders,
} from "@/lib/localServices/savedProviders";

function provider(overrides: Partial<LocalProvider> = {}): LocalProvider {
  return {
    placeId: "google-place-1",
    name: "Live Provider",
    categoryId: "estate-agents",
    address: "8 Harbour Road",
    coordinates: { lat: -34.1, lng: 24.8 },
    rating: 4.8,
    reviewCount: 44,
    userRatingCount: 44,
    phone: "+27 42 000 0000",
    websiteUrl: "https://provider.example",
    website: "https://provider.example",
    googleMapsUrl: "https://www.google.com/maps/place/provider",
    businessStatus: "OPERATIONAL",
    openNow: true,
    distanceKm: 1.2,
    source: "google",
    isSponsored: false,
    sponsorshipLabel: null,
    isEasyErfVerified: false,
    verificationStatus: null,
    verificationDate: null,
    serviceAreas: [],
    categories: ["estate-agents"],
    leadTrackingId: null,
    ...overrides,
  };
}

function stubStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
  vi.stubGlobal("window", { localStorage });
  return { store, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved Local Property Team providers", () => {
  it("saves only stable provider identifiers for the current parcel", () => {
    const { store } = stubStorage();

    const saved = toggleSavedLocalProvider("parcel-a", provider());

    expect(saved).toEqual([
      expect.objectContaining({
        parcelId: "parcel-a",
        placeId: "google-place-1",
        serviceCategory: "estate-agents",
        userNotes: null,
      }),
    ]);

    const raw = store.get("easyerf.local-property-team.saved.parcel-a");
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw ?? "[]") as Array<Record<string, unknown>>;
    expect(persisted[0]).not.toHaveProperty("rating");
    expect(persisted[0]).not.toHaveProperty("openNow");
    expect(persisted[0]).not.toHaveProperty("reviewCount");
    expect(persisted[0]).not.toHaveProperty("phone");
    expect(persisted[0]).not.toHaveProperty("businessStatus");
  });

  it("keeps saved providers isolated by parcel", () => {
    stubStorage();

    toggleSavedLocalProvider("parcel-a", provider({ placeId: "place-a" }));
    toggleSavedLocalProvider("parcel-b", provider({ placeId: "place-b" }));

    expect(readSavedLocalProviders("parcel-a").map((item) => item.placeId)).toEqual(["place-a"]);
    expect(readSavedLocalProviders("parcel-b").map((item) => item.placeId)).toEqual(["place-b"]);
  });

  it("rejects cross-parcel records and migrates legacy category IDs safely", () => {
    const { store } = stubStorage();
    store.set(
      "easyerf.local-property-team.saved.parcel-a",
      JSON.stringify([
        {
          parcelId: "parcel-a",
          placeId: "stable-place",
          categoryId: "estate-agents",
          userNotes: "",
          savedAt: "2026-07-17T10:00:00.000Z",
          rating: 4.8,
        },
        {
          parcelId: "parcel-b",
          placeId: "wrong-parcel",
          serviceCategory: "builders-contractors",
          userNotes: null,
          savedAt: "2026-07-17T10:00:00.000Z",
        },
      ]),
    );

    const saved = readSavedLocalProviders("parcel-a");

    expect(saved).toEqual([
      {
        parcelId: "parcel-a",
        placeId: "stable-place",
        serviceCategory: "estate-agents",
        userNotes: null,
        savedAt: "2026-07-17T10:00:00.000Z",
      },
    ]);
  });
});
