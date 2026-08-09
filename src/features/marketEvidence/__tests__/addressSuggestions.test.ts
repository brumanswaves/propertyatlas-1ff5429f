import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADDRESS_SUGGESTION_MIN_QUERY_LENGTH,
  forwardGeocodeAddressCandidates,
} from "@/features/marketEvidence/addressIntelligence";

const serverCandidate = {
  id: "place-1",
  formattedAddress: "8 Esmaralda Road, Sea Vista, St Francis Bay, 6312, South Africa",
  streetNumber: "8",
  streetName: "Esmaralda Road",
  suburb: "Sea Vista",
  town: "St Francis Bay",
  province: "Eastern Cape",
  postalCode: "6312",
  lat: -34.154,
  lng: 24.826,
};

describe("working address suggestions", () => {
  afterEach(() => {
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
      json: async () => ({ success: true, candidates: [serverCandidate] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await forwardGeocodeAddressCandidates("8 Esmaralda Road", {
      near: { lat: -34.154, lng: 24.826 },
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/address/suggestions");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody).toMatchObject({
      action: "forward",
      query: "8 Esmaralda Road",
      latitude: -34.154,
      longitude: 24.826,
    });
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain("GOOGLE");
    expect(candidates).toHaveLength(1);
  });

  it("parses structured address fields without changing official parcel identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, candidates: [serverCandidate] }),
      }),
    );

    const [candidate] = await forwardGeocodeAddressCandidates("8 Esmaralda Road");

    expect(candidate).toMatchObject({
      formattedAddress: serverCandidate.formattedAddress,
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

  it("surfaces server configuration failures and accepts an honest empty result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "Address suggestions are not configured yet. You can still enter the working address manually.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(forwardGeocodeAddressCandidates("8 Esmaralda Road")).rejects.toThrow(
      "Address suggestions are not configured yet",
    );

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, candidates: [] }) });
    await expect(forwardGeocodeAddressCandidates("8 Esmaralda Road")).resolves.toEqual([]);
  });
});
