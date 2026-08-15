import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function routeSource() {
  return readFileSync(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
}

function guardSource() {
  return readFileSync(
    join(process.cwd(), "src", "components", "admin", "AdminGuard.tsx"),
    "utf8",
  );
}

describe("Easy Erf Founder Operations guardrails", () => {
  it("extends the existing protected admin architecture", () => {
    const source = routeSource();

    expect(source).toContain("<AdminGuard>");
    expect(source).toContain("Founder Operations");
    expect(guardSource()).toContain('.eq("role", "admin")');
  });

  it("uses real admin-readable operational records instead of demo KPIs", () => {
    const source = routeSource();

    expect(source).toContain('from("report_orders")');
    expect(source).toContain('from("provider_audit_log")');
    expect(source).toContain('from("provider_settings")');
    expect(source).not.toContain("PROPERTIES.length");
    expect(source).not.toContain("Properties indexed");
    expect(source).not.toContain("Parcels rendered");
  });

  it("keeps existing diagnostics available but separate from operations", () => {
    const source = routeSource();

    expect(source).toContain('to="/admin/readiness"');
    expect(source).toContain('to="/admin/public-data-debug"');
    expect(source).toContain("Developer and provider diagnostics");
  });

  it("does not invent unsafe support or financial actions", () => {
    const source = routeSource();

    expect(source).toMatch(/next operations tranche should add a narrowly authorized support boundary/i);
    expect(source).toMatch(/No refund, credit-grant, destructive repair or impersonation control/i);
    expect(source).not.toContain("service_role");
    expect(source).not.toMatch(/onClick=.*refund/i);
    expect(source).not.toMatch(/onClick=.*grant/i);
  });

  it("uses canonical Easy Erf operations terminology", () => {
    const source = `${routeSource()}\n${guardSource()}`;

    expect(source).toContain("Easy Erf Operations");
    expect(source).toContain("My Investigations");
    expect(source).toContain("Find a Property");
    expect(source).not.toContain("Platform control");
  });
});
