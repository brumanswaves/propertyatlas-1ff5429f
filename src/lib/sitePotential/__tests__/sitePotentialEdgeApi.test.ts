import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  handleSitePotentialEdgeApiRequest,
  SITE_POTENTIAL_EDGE_API_CORS_HEADERS,
} from "../edgeApiRequest";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("founder-owned Site Potential API", () => {
  it("routes only the signed-in MVP Site Potential control surface", async () => {
    const unknown = await handleSitePotentialEdgeApiRequest(
      new Request("https://example.test/functions/v1/site-potential-api/not-a-route"),
    );
    expect(unknown.status).toBe(404);

    const options = await handleSitePotentialEdgeApiRequest(
      new Request("https://example.test/functions/v1/site-potential-api/beta-status", {
        method: "OPTIONS",
      }),
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe(
      SITE_POTENTIAL_EDGE_API_CORS_HEADERS["Access-Control-Allow-Origin"],
    );
  });

  it("keeps the Edge wrapper secret-safe and founder-owned", () => {
    const edge = read("supabase/functions/site-potential-api/index.ts");
    const handler = read("src/lib/sitePotential/edgeApiRequest.ts");
    const bundle = read("supabase/functions/site-potential-api/handler.bundle.mjs");

    expect(edge).toContain("vault.decrypted_secrets");
    expect(edge).toContain("easy_erf_site_potential_beta_enabled");
    expect(edge).toContain("easy_erf_site_potential_worker_secret");
    expect(edge).toContain("handler.bundle.mjs");
    expect(edge).toContain("66640ce499f5be9bab1385e2edb8fb6c29b5b083");
    expect(edge).not.toContain("erfstoep.lovable.app");
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(edge).not.toContain("SITE_POTENTIAL_WORKER_SECRET=");

    expect(handler).toContain('case "beta-status"');
    expect(handler).toContain('case "beta-redeem"');
    expect(handler).toContain('case "pack-status"');
    expect(handler).toContain('case "retry-pack"');
    expect(handler).not.toContain("process.env");

    expect(bundle).toContain("GENERATED from src/lib/sitePotential/edgeApiRequest.ts");
    expect(bundle).toContain("handleSitePotentialEdgeApiRequest");
    expect(bundle).not.toContain("erfstoep.lovable.app");
  });
});
