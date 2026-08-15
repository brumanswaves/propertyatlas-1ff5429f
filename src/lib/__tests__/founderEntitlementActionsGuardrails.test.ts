import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("Founder Operations entitlement action guardrails", () => {
  const action = read("src", "lib", "admin", "founderSupportActions.ts");
  const client = read("src", "lib", "admin", "founderSupportActionsClient.ts");
  const api = read("src", "routes", "api", "admin.support.ts");
  const page = read("src", "routes", "admin_.entitlements.tsx");
  const guard = read("src", "components", "admin", "AdminGuard.tsx");

  it("reuses canonical Founder Operations authorization and the existing entitlement store", () => {
    expect(action).toContain("authenticateFounderSupportRequest(input.request)");
    expect(action).toContain("grantBetaCredits({");
    expect(action).toContain("grantedBy: actor.id");
    expect(action).toContain("reason,");
    expect(action).not.toContain("createServiceRoleSupabaseClient");
  });

  it("limits the support action to one complimentary generation", () => {
    expect(action).toContain("credits: 1");
    expect(action).toContain("creditsGranted: 1");
    expect(page).toMatch(/Grant 1 complimentary generation/i);
    expect(page).toMatch(/Grant 1 generation/i);
    expect(page).not.toMatch(/credits to grant/i);
  });

  it("requires a meaningful support reason before the mutation", () => {
    expect(action).toContain("MIN_REASON_LENGTH = 8");
    expect(action.indexOf("reason.length < MIN_REASON_LENGTH")).toBeLessThan(
      action.indexOf("grantBetaCredits({"),
    );
    expect(page).toContain("reason.trim().length < 8");
    expect(page).toMatch(/reason is required for the audit record/i);
  });

  it("sends the current session token to a same-origin POST route without privileged browser credentials", () => {
    expect(client).toContain("data.session.access_token");
    expect(client).toContain('method: "POST"');
    expect(client).toContain('credentials: "same-origin"');
    expect(client).not.toContain("SERVICE_ROLE");
    expect(page).not.toContain("SERVICE_ROLE");
  });

  it("does not trigger generation, refunds, revoke, destructive repair or impersonation", () => {
    const mutationSurface = `${action}\n${api}\n${page}`;
    expect(mutationSurface).not.toContain("redeem_site_potential_pack_v2");
    expect(mutationSurface).not.toContain("generateSitePotential");
    expect(mutationSurface).not.toMatch(/refund payment/i);
    expect(mutationSurface).not.toMatch(/impersonate user/i);
    expect(mutationSurface).not.toMatch(/delete user/i);
    expect(page).toMatch(/does not expose revoke, refund or destructive repair controls/i);
  });

  it("adds Entitlements to the shared Easy Erf Operations navigation", () => {
    expect(guard).toContain('href="/admin/entitlements"');
    expect(guard).toContain("Entitlements");
    expect(page).toContain("Easy Erf Operations");
  });
});
