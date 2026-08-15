import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveGoogleAuthTransport } from "../googleAuthTransport";

describe("Google auth transport", () => {
  it("keeps the current Lovable auth path as the default rollback behavior", () => {
    expect(resolveGoogleAuthTransport(undefined)).toBe("lovable");
    expect(resolveGoogleAuthTransport(false)).toBe("lovable");
    expect(resolveGoogleAuthTransport("false")).toBe("lovable");
  });

  it("switches to direct Supabase OAuth only when explicitly enabled", () => {
    expect(resolveGoogleAuthTransport(true)).toBe("supabase");
    expect(resolveGoogleAuthTransport("true")).toBe("supabase");
  });

  it("keeps both OAuth implementations available until the explicit production cutover", () => {
    const authRoute = readFileSync("src/routes/auth.tsx", "utf8");
    const envFile = readFileSync(".env", "utf8");

    expect(authRoute).toContain("resolveGoogleAuthTransport()");
    expect(authRoute).toContain('supabase.auth.signInWithOAuth({');
    expect(authRoute).toContain('provider: "google"');
    expect(authRoute).toContain('lovable.auth.signInWithOAuth("google"');
    expect(envFile).toContain("VITE_FOUNDER_SUPABASE_AUTH=false");
  });
});
