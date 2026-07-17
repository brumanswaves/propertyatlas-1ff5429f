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

function place(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    displayName: { text: name },
    formattedAddress: `${name} Street`,
    businessStatus: "OPERATIONAL",
    ...overrides,
  };
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
    expect(googleBody.pageSize).toBe(10);
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
            place("one", "One", { formattedAddress: "1 Main" }),
            { id: "one", displayName: { text: "One duplicate" }, businessStatus: "OPERATIONAL" },
            place("two-a", "Two", { formattedAddress: "2 Main" }),
            place("two-b", "Two", { formattedAddress: "2 Main" }),
            { id: "closed", displayName: { text: "Closed" }, businessStatus: "CLOSED_PERMANENTLY" },
            place("three", "Three"),
            place("four", "Four"),
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

  it("requests enough raw candidates and fills filtered slots without returning more than three", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            place("closed", "Closed", { businessStatus: "CLOSED_PERMANENTLY" }),
            { id: "missing-name", businessStatus: "OPERATIONAL" },
            place("irrelevant", "Route Result", { types: ["route"] }),
            place("one", "One"),
            place("one-duplicate", "One", { formattedAddress: "One Street" }),
            place("two", "Two"),
            place("three", "Three"),
            place("four", "Four"),
            place("five", "Five"),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-candidates",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    const payload = await response.json();
    const googleBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

    expect(googleBody.pageSize).toBe(10);
    expect(payload.providers).toHaveLength(3);
    expect(payload.providers.map((item: { placeId: string }) => item.placeId)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("enforces normal and wider search radii when Google returns coordinates", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const origin = { latitude: -34.1, longitude: 24.8 };
    const near20Km = { latitude: -33.92, longitude: 24.8 };
    const near40Km = { latitude: -33.74, longitude: 24.8 };
    const beyond50Km = { latitude: -33.55, longitude: 24.8 };
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            place("twenty", "Twenty Kilometres", { location: near20Km }),
            place("near", "Nearby Provider", { location: origin }),
            place("no-coordinates", "No Coordinates"),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const normal = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-radius-normal",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
        latitude: origin.latitude,
        longitude: origin.longitude,
      }),
    );
    const normalPayload = await normal.json();
    expect(normalPayload.radiusKm).toBe(15);
    expect(normalPayload.providers.map((item: { placeId: string }) => item.placeId)).toEqual([
      "near",
      "no-coordinates",
    ]);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            place("twenty", "Twenty Kilometres", { location: near20Km }),
            place("forty", "Forty Kilometres", { location: near40Km }),
            place("fifty-plus", "Fifty Plus Kilometres", { location: beyond50Km }),
            place("near", "Nearby Provider", { location: origin }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const wider = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-radius-wide",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
        latitude: origin.latitude,
        longitude: origin.longitude,
        widerArea: true,
      }),
    );
    const widerPayload = await wider.json();
    expect(widerPayload.radiusKm).toBe(35);
    expect(widerPayload.providers.map((item: { placeId: string }) => item.placeId)).toEqual([
      "twenty",
      "near",
    ]);
  });

  it("does not serve volatile provider details from the old seven-day cache", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            place("provider", "Provider", {
              rating: 4.1,
              userRatingCount: 9,
              nationalPhoneNumber: "+27 42 000 0001",
              websiteUri: "https://old.example",
              businessStatus: "OPERATIONAL",
              currentOpeningHours: { openNow: false },
            }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const first = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-live-refresh",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    const firstPayload = await first.json();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            place("provider", "Provider", {
              rating: 4.9,
              userRatingCount: 19,
              nationalPhoneNumber: "+27 42 000 0002",
              websiteUri: "https://new.example",
              businessStatus: "OPERATIONAL",
              currentOpeningHours: { openNow: true },
            }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const second = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-live-refresh",
        serviceCategory: "estate-agents",
        confirmedAddress: "8 Harbour Drive",
      }),
    );
    const secondPayload = await second.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstPayload.cached).toBe(false);
    expect(secondPayload.cached).toBe(false);
    expect(firstPayload.providers[0]).toMatchObject({
      rating: 4.1,
      userRatingCount: 9,
      phone: "+27 42 000 0001",
      website: "https://old.example",
      openNow: false,
      businessStatus: "OPERATIONAL",
    });
    expect(secondPayload.providers[0]).toMatchObject({
      rating: 4.9,
      userRatingCount: 19,
      phone: "+27 42 000 0002",
      website: "https://new.example",
      openNow: true,
      businessStatus: "OPERATIONAL",
    });
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
