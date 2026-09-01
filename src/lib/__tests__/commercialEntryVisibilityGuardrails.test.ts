import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Easy Erf commercial entry visibility", () => {
  it("keeps the two-path investigation choice visible on the home map", () => {
    const source = read("src/routes/index.tsx");
    expect(source).toContain("Investigate it myself");
    expect(source).toContain("Do it for me · R999");
    expect(source).toContain("let Easy Erf do the investigation for you");
    expect(source).toContain('new Event("easy-erf:start-self-review")');
    expect(source).toContain('to="/pricing"');
    expect(source).not.toContain("Get Human Review · R999");
  });

  it("keeps Done for You available globally during self-service and deep review", () => {
    const navigation = read("src/lib/navigation.ts");
    expect(navigation).toContain('{ to: "/pricing", label: "Done for You" }');
    expect(navigation).toContain('{ to: "/pricing", label: "Done-for-You Investigation" }');
    expect(navigation).not.toContain('label: "R999 Review"');
  });

  it("keeps paid reports discoverable from My Investigations", () => {
    const source = read("src/routes/dashboard.tsx");
    expect(source).toContain('to="/orders"');
    expect(source).toContain("My Reports");
  });

  it("keeps paid investigation fulfillment discoverable from Founder Operations", () => {
    const source = read("src/routes/admin.tsx");
    expect(source).toContain('to="/admin/fulfillment"');
    expect(source).toContain("Open / change review");
    const fulfillment = read("src/routes/admin.fulfillment.tsx");
    expect(fulfillment).toContain("Done-for-You Operations");
    expect(fulfillment).toContain("Property investigation work queue");
    expect(fulfillment).toContain("reopen_review");
    expect(fulfillment).toContain("Reopen / replace report");
  });
});
