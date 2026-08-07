import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADDRESS_SUGGESTION_MIN_QUERY_LENGTH,
  forwardGeocodeAddressCandidates,
} from "@/features/marketEvidence/addressIntelligence";

const googleResult = {
  formatted_address: "8 Esmaralda Road, Sea Vista, St Francis Bay, 6312, South Africa",
  address_components: [
    { long_name: "8", types: ["street_number"] },
    { long_name: "Esmaralda Road", types: ["route"] },
    { long_name: "Sea Vista", types: ["sublocality_level_1"] },
    { long_name: "St Francis Bay", types: ["locality"] },
    { long_name: "Eastern Cape", types: ["administrative_area_level_1"] },
    { long_name: "6312", types: ["postal_code"] },
  ],
  geometry: { location: { lat: -34.154, lng: 24.826 } },
};

describe("working address suggestions", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-google-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not query Google before the minimum useful input length", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      forwardGeocodeAddressCandidates("x".repeat(ADDRESS_SUGGESTION_MIN_QUERY_LENGTH - 1)),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("biases the query to South Africa and the selected parcel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [googleResult] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await forwardGeocodeAddressCandidates("8 Esmaralda Road", {
      near: { lat: -34.154, lng: 24.826 },
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("address")).toBe("8 Esmaralda Road");
    expect(requestedUrl.searchParams.get("components")).toBe("country:ZA");
    expect(requestedUrl.searchParams.get("bounds")).toContain("-34.404");
    expect(requestedUrl.searchParams.get("key")).toBe("test-google-key");
    expect(candidates).toHaveLength(1);
  });

  it("parses structured address fields without changing official parcel identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [googleResult] }) }),
    );

    const [candidate] = await forwardGeocodeAddressCandidates("8 Esmaralda Road");

    expect(candidate).toMatchObject({
      formattedAddress: googleResult.formatted_address,
      streetNumber: "8",
      streetName: "Esmaralda Road",
      suburb: "Sea Vista",
      town: "St Francis Bay",
      province: "Eastern Cape",
      postalCode: "6312",
      lat: -34.154,
      lng: 24.826,
      source: "google_forward_geocode",
      confidence: "medium",
    });
    expect(candidate.reason).toMatch(/not official parcel data/i);
  });

  it("returns no suggestions when the key is absent or Google returns no results", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(forwardGeocodeAddressCandidates("8 Esmaralda Road")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-google-key");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    await expect(forwardGeocodeAddressCandidates("8 Esmaralda Road")).resolves.toEqual([]);
  });
});
