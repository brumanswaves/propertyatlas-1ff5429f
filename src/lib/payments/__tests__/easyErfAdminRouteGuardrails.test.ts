import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Easy Erf founder route accessibility", () => {
  it("keeps fulfillment and launch readiness outside the non-layout admin parent", () => {
    expect(existsSync(resolve(process.cwd(), "src/routes/admin.fulfillment.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/routes/admin.launch-readiness.tsx"))).toBe(
      false,
    );

    expect(source("src/routes/admin_.fulfillment.tsx")).toContain(
      'createFileRoute("/admin_/fulfillment")',
    );
    expect(source("src/routes/admin_.launch-readiness.tsx")).toContain(
      'createFileRoute("/admin_/launch-readiness")',
    );
  });

  it("does not require the Founder Operations page to act as a child-route layout", () => {
    const adminOverview = source("src/routes/admin.tsx");
    expect(adminOverview).not.toContain("<Outlet");
    expect(adminOverview).toContain('to="/admin/fulfillment"');
  });
});
