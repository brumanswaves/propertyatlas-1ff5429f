import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeReturnPath, staffNavigation } from "@/lib/navigation";
import { staffRoleFromRows } from "../StaffAccess";

describe("Canonical staff dashboard entry", () => {
  it("uses existing roles, not assignment count or metadata", () => {
    expect(staffRoleFromRows([])).toBe("customer");
    expect(staffRoleFromRows([{ role: "moderator" }])).toBe("investigator");
    expect(staffRoleFromRows([{ role: "moderator" }, { role: "admin" }])).toBe("founder");
    expect(staffRoleFromRows([{ role: "investigator" }])).toBe("customer");
    expect(staffNavigation("customer")).toEqual([]);
    expect(staffNavigation(null)).toEqual([]);
    expect(staffNavigation("investigator")).toEqual([{ to: "/investigator", label: "Investigator Dashboard" }]);
    expect(staffNavigation("founder").map(link => link.to)).toEqual(["/admin", "/investigator"]);
  });
  it("preserves explicit local order/property destinations without open redirects", () => {
    const path = "/admin/fulfillment#order-33333333-3333-4333-8333-333333333333";
    expect(safeReturnPath(path)).toBe(path);
    expect(safeReturnPath("/?parcel=example")).toBe("/?parcel=example");
    for (const input of [undefined, "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/auth", "/auth?redirect=/admin", "/\n/evil.invalid"]) {
      expect(safeReturnPath(input)).toBeNull();
    }
  });
  it("shares the existing exact-order work tools and keeps founder-only controls protected", () => {
    const read = (path: string) => readFileSync(path, "utf8");
    expect(read("src/routes/investigator.tsx")).toContain("FounderFulfillmentPage");
    const guard = read("src/components/admin/AdminGuard.tsx");
    expect(guard).not.toContain("list_assigned_investigation_queue");
    expect(guard).toContain("allowAssignedInvestigations && isInvestigator");
    expect(guard).toContain("Back to Investigator Dashboard");
    expect(read("src/routes/admin_.users.tsx")).toContain("<AdminGuard>");
    const access = read("src/lib/auth/StaffAccess.tsx");
    expect(access).toContain("supabase.auth.getUser(token)");
    expect(access).toContain('from("user_roles")');
    expect(access).toContain("request.abort()");
    expect(access).toContain("resolved?.token === token");
    expect(access).not.toContain("service_role");
  });
});
