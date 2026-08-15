import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("Founder Operations trusted support guardrails", () => {
  const server = read("src", "lib", "admin", "founderSupportServer.ts");
  const client = read("src", "lib", "admin", "founderSupportClient.ts");
  const api = read("src", "routes", "api", "admin.support.ts");
  const page = read("src", "routes", "admin_.users.tsx");
  const guard = read("src", "components", "admin", "AdminGuard.tsx");

  it("authenticates the request and verifies the existing admin role before privileged reads", () => {
    expect(server).toContain("authenticateApiRequest(request)");
    expect(server).toContain('from("user_roles")');
    expect(server).toContain('.eq("user_id", user.id)');
    expect(server).toContain('.eq("role", "admin")');
    expect(server).toContain("createServiceRoleSupabaseClient()");
    expect(
      server.indexOf("const { user } = await authenticateApiRequest(request);"),
    ).toBeLessThan(server.indexOf("const serviceSupabase = createServiceRoleSupabaseClient();"));
  });

  it("keeps the service role behind the trusted server boundary", () => {
    expect(client).not.toContain("SERVICE_ROLE");
    expect(page).not.toContain("SERVICE_ROLE");
    expect(api).not.toContain("SERVICE_ROLE");
    expect(client).toContain("data.session.access_token");
    expect(client).toContain("Authorization: `Bearer ${data.session.access_token}`");
    expect(client).toContain('credentials: "same-origin"');
  });

  it("returns bounded support metadata rather than file storage paths or raw asset metadata", () => {
    expect(server).toContain("original_file_name");
    expect(server).toContain("asset_category");
    expect(server).not.toContain("storage_path");
    expect(server).not.toContain("storage_bucket");
    expect(server).not.toMatch(/select\([^)]*metadata/);
  });

  it("is read-only and does not expose support mutations yet", () => {
    expect(api).toContain("GET:");
    expect(api).not.toContain("POST:");
    expect(api).not.toContain("PATCH:");
    expect(api).not.toContain("DELETE:");
    expect(page).toMatch(/This screen is read-only/i);
    expect(page).not.toMatch(/grant credits/i);
    expect(page).not.toMatch(/refund payment/i);
    expect(page).not.toMatch(/impersonate/i);
  });

  it("uses one shared Founder Operations navigation across protected admin screens", () => {
    expect(guard).toContain('aria-label="Founder Operations"');
    expect(guard).toContain('href="/admin"');
    expect(guard).toContain('href="/admin/users"');
    expect(guard).toContain('href="/admin/readiness"');
    expect(guard).toContain('href="/admin/public-data-debug"');
  });

  it("reuses the durable saved investigation projection for support state", () => {
    expect(server).toContain("readSavedInvestigationProjection(row.user_data)");
    expect(page).toContain("GUIDED_INVESTIGATION_STEPS");
    expect(page).not.toContain("progressScore");
  });
});
