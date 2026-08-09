import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAddressSuggestionsRequest } from "../address.suggestions";

function request(body: unknown) {
  return new Request("https://easyerf.test/api/address/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("server-side address suggestions", () => {
  it("returns a visible, honest error when Google is not configured", async () => {
    const response = await handleAddressSuggestionsRequest(
      request({ action: "forward", query: "24 Padrone" }),
    );
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ success: false, code: "places_not_configured" });
    expect(payload.error).toContain("enter the working address manually");
  });

  it("keeps the Google key server-side and biases South African results near the parcel", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-only-key";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ "X-Goog-Api-Key": "server-only-key" });
      const body = JSON.parse(String(init?.body));
      expect(body.regionCode).toBe("ZA");
      expect(body.locationBias.circle.center).toEqual({ latitude: -34.17924, longitude: 24.84226 });
      return new Response(
        JSON.stringify({
          places: [
            {
              id: "place-1",
              formattedAddress: "24 Padrone Crescent, Sea Vista, South Africa",
              location: { latitude: -34.179, longitude: 24.842 },
              addressComponents: [
                { longText: "24", types: ["street_number"] },
                { longText: "Padrone Crescent", types: ["route"] },
                { longText: "Sea Vista", types: ["sublocality_level_1"] },
                { longText: "St Francis Bay", types: ["locality"] },
                { longText: "Eastern Cape", types: ["administrative_area_level_1"] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleAddressSuggestionsRequest(
      request({
        action: "forward",
        query: "24 Padrone",
        latitude: -34.17924,
        longitude: 24.84226,
      }),
    );
    const payload = await response.json();
    expect(payload.candidates[0]).toMatchObject({
      streetNumber: "24",
      streetName: "Padrone Crescent",
      suburb: "Sea Vista",
      town: "St Francis Bay",
      province: "Eastern Cape",
    });
    expect(JSON.stringify(payload)).not.toContain("server-only-key");
  });
});
