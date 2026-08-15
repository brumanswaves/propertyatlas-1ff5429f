import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function routeSource() {
  return readFileSync(join(process.cwd(), "src", "routes", "profile.tsx"), "utf8");
}

describe("Easy Erf Account coherence guardrails", () => {
  it("uses Account terminology while keeping the compatible profile route", () => {
    const source = routeSource();

    expect(source).toContain('createFileRoute("/profile")');
    expect(source).toContain("Your Easy Erf account");
    expect(source).toContain("Save account");
    expect(source).not.toContain("Save profile");
    expect(source).not.toContain(">Profile<");
  });

  it("does not invent subscription, credits, or payment history", () => {
    const source = routeSource();

    expect(source).toMatch(/does not currently sell a recurring subscription/i);
    expect(source).toMatch(/does not invent a balance or payment history/i);
    expect(source).not.toMatch(
      />\s*(credit balance|payment history|subscription status|cancel subscription)\s*</i,
    );
  });

  it("keeps editable preferences in auth metadata instead of property evidence", () => {
    const source = routeSource();

    expect(source).toContain("supabase.auth.updateUser");
    expect(source).toContain("profile_type: profileType");
    expect(source).toContain("default_market: defaultMarket.trim()");
    expect(source).toMatch(/do not alter property evidence or planning conclusions/i);
  });

  it("only surfaces Founder Operations after checking the existing admin role", () => {
    const source = routeSource();

    expect(source).toContain('from("user_roles")');
    expect(source).toContain('.eq("role", "admin")');
    expect(source).toContain("{isAdmin && (");
    expect(source).toContain('to="/admin"');
  });
});
