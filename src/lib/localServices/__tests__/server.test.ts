import { afterEach, describe, expect, it, vi } from "vitest";
import { handleLocalServicesSearchRequest } from "@/routes/api/local-services.search";

const originalKey = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/local-services/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Local Property Team server search", () => {
  it("keeps the Places API key server-side and returns an honest configuration error", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive, St Francis Bay",
        latitude: -34.1,
        longitude: 24.8,
      }),
    );
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.code).toBe("places_not_configured");
    expect(JSON.stringify(payload)).not.toContain("GOOGLE_PLACES_API_KEY");
  });

  it("returns no more than three real providers and removes permanently closed businesses", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "closed",
              displayName: { text: "Closed Provider" },
              businessStatus: "CLOSED_PERMANENTLY",
            },
            {
              id: "one",
              displayName: { text: "One" },
              formattedAddress: "1 Main Road",
              location: { latitude: -34.11, longitude: 24.81 },
              rating: 4.7,
              userRatingCount: 21,
              nationalPhoneNumber: "+27 42 000 0001",
              websiteUri: "https://one.example",
              googleMapsUri: "https://maps.google.com/?cid=one",
              businessStatus: "OPERATIONAL",
            },
            {
              id: "two",
              displayName: { text: "Two" },
              businessStatus: "OPERATIONAL",
              currentOpeningHours: { openNow: true },
            },
            { id: "three", displayName: { text: "Three" }, businessStatus: "OPERATIONAL" },
            { id: "four", displayName: { text: "Four" }, businessStatus: "OPERATIONAL" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive, St Francis Bay, Eastern Cape",
        latitude: -34.1,
        longitude: 24.8,
      }),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.providers).toHaveLength(3);
    expect(payload.providers.map((item: { placeId: string }) => item.placeId)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(payload.providers[1].rating).toBeNull();
    expect(payload.providers[1].phone).toBeNull();
    expect(payload.providers[1].websiteUrl).toBeNull();
    expect(payload.providers[1].openNow).toBe(true);
    expect(payload.providers[1].source).toBe("google");
    expect(payload.providers.every((item: { isSponsored: boolean }) => !item.isSponsored)).toBe(true);
    expect(payload.attribution).toBe("Google");
    expect(payload.parcelId).toBe("parcel-1");
    expect(payload.confirmedAddress).toBe("8 Harbour Drive, St Francis Bay, Eastern Cape");

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.stringify(options)).not.toContain("VITE_");
    expect((options?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("server-secret");
    expect((options?.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain(
      "places.displayName",
    );
    const googleBody = JSON.parse(String(options?.body));
    expect(googleBody.pageSize).toBe(3);
    expect(googleBody.textQuery).toContain("near 8 Harbour Drive, St Francis Bay, Eastern Cape");
    expect(googleBody.textQuery).not.toContain("Kouga Local Municipality");
    expect(googleBody.textQuery).not.toContain("best");
    expect(googleBody.textQuery).not.toContain("trusted");
  });

  it("requires the saved Market address before provider search", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const response = await handleLocalServicesSearchRequest(
      request({ parcelId: "parcel-1", serviceCategory: "estate-agents", latitude: -34.1, longitude: 24.8 }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("address_required");
  });

  it("rejects unknown categories instead of becoming an open Google proxy", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const response = await handleLocalServicesSearchRequest(
      request({ parcelId: "parcel-1", serviceCategory: "anything-the-client-wants" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_category");
  });

  it("rejects arbitrary browser-provided Google queries", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive, St Francis Bay",
        query: "best trusted estate agent paid partner",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_query");
  });

  it("filters ineligible and duplicate Google places while preserving relevance order", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            { id: "missing-name", businessStatus: "OPERATIONAL" },
            { id: "one", displayName: { text: "One" }, formattedAddress: "1 Main", businessStatus: "OPERATIONAL" },
            { id: "one", displayName: { text: "One duplicate" }, businessStatus: "OPERATIONAL" },
            { id: "two-a", displayName: { text: "Two" }, formattedAddress: "2 Main", businessStatus: "OPERATIONAL" },
            { id: "two-b", displayName: { text: "Two" }, formattedAddress: "2 Main", businessStatus: "OPERATIONAL" },
            { id: "closed", displayName: { text: "Closed" }, businessStatus: "CLOSED_PERMANENTLY" },
            { id: "three", displayName: { text: "Three" }, businessStatus: "OPERATIONAL" },
            { id: "four", displayName: { text: "Four" }, businessStatus: "OPERATIONAL" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive, St Francis Bay",
      }),
    );
    const payload = await response.json();
    expect(payload.providers.map((item: { placeId: string }) => item.placeId)).toEqual([
      "one",
      "two-a",
      "three",
    ]);
  });

  it("returns honest fallbacks for quota, timeout, and malformed Google responses", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429 }),
    );
    const quota = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    expect((await quota.json()).code).toBe("places_quota");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"));
    const timeout = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    expect((await timeout.json()).code).toBe("places_timeout");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ unexpected: [] }), { status: 200 }),
    );
    const malformed = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    expect((await malformed.json()).code).toBe("places_malformed");
  });
});
