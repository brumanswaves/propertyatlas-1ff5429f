import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Easy Erf commercial entry visibility", () => {
  it("keeps the R999 human-reviewed offer visible from the home map", () => {
    const source = read("src/routes/index.tsx");
    expect(source).toContain("R999 · Human-reviewed");
    expect(source).toContain("See the R999 review");
    expect(source).toContain('to="/pricing"');
  });

  it("keeps paid reports discoverable from My Investigations", () => {
    const source = read("src/routes/dashboard.tsx");
    expect(source).toContain('to="/orders"');
    expect(source).toContain("My Reports");
  });

  it("keeps human-review fulfillment discoverable from Founder Operations", () => {
    const source = read("src/routes/admin.tsx");
    expect(source).toContain('to="/admin/fulfillment"');
    expect(source).toContain("Human-review fulfillment");
  });
});
