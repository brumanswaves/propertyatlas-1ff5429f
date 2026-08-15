import { describe, expect, it } from "vitest";
import { buildSitePotentialApiRequest } from "../sitePotentialApiClient";

const TOKEN = "signed-user-token";

function headerValue(init: RequestInit, name: string) {
  return new Headers(init.headers).get(name);
}

describe("Site Potential API client transport", () => {
  it("keeps the existing Lovable server routes as the default rollback path", () => {
    const request = buildSitePotentialApiRequest(
      {
        route: "pack-status",
        token: TOKEN,
        searchParams: new URLSearchParams({ parcelId: "parcel-1", siteProjectId: "project-1" }),
      },
      { edgeEnabled: false, supabaseUrl: "", publishableKey: "" },
    );

    expect(request.transport).toBe("legacy");
    expect(request.url).toBe(
      "/api/site-potential/pack-status?parcelId=parcel-1&siteProjectId=project-1",
    );
    expect(headerValue(request.init, "Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headerValue(request.init, "apikey")).toBeNull();
  });

  it("targets the founder-owned Supabase Edge API only when explicitly enabled", () => {
    const request = buildSitePotentialApiRequest(
      {
        route: "beta-redeem",
        token: TOKEN,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcelId: "parcel-1" }),
        },
      },
      {
        edgeEnabled: true,
        supabaseUrl: "https://founder-project.supabase.co/",
        publishableKey: "public-key",
      },
    );

    expect(request.transport).toBe("edge");
    expect(request.url).toBe(
      "https://founder-project.supabase.co/functions/v1/site-potential-api/beta-redeem",
    );
    expect(headerValue(request.init, "Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headerValue(request.init, "apikey")).toBe("public-key");
    expect(headerValue(request.init, "Content-Type")).toBe("application/json");
  });

  it("fails closed instead of silently falling back when the Edge flag is misconfigured", () => {
    expect(() =>
      buildSitePotentialApiRequest(
        { route: "beta-status", token: TOKEN },
        { edgeEnabled: true, supabaseUrl: "", publishableKey: "" },
      ),
    ).toThrow("Founder-owned Site Potential API is not configured for this deployment.");
  });
});
