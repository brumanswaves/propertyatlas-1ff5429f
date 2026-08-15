import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { googleAuthTransportFromFlag } from "../googleAuthTransport";

describe("Google auth transport", () => {
  it("keeps Lovable auth unless founder Supabase auth is explicitly enabled", () => {
    expect(googleAuthTransportFromFlag(undefined)).toBe("lovable");
    expect(googleAuthTransportFromFlag(false)).toBe("lovable");
    expect(googleAuthTransportFromFlag("false")).toBe("lovable");
  });

  it("switches to direct Supabase OAuth only when explicitly enabled", () => {
    expect(googleAuthTransportFromFlag(true)).toBe("supabase");
    expect(googleAuthTransportFromFlag("true")).toBe("supabase");
  });

  it("keeps both OAuth implementations available for cutover and rollback", () => {
    const authRoute = readFileSync("src/routes/auth.tsx", "utf8");

    expect(authRoute).toContain("resolveGoogleAuthTransport()");
    expect(authRoute).toContain('supabase.auth.signInWithOAuth({');
    expect(authRoute).toContain('provider: "google"');
    expect(authRoute).toContain('lovable.auth.signInWithOAuth("google"');
  });
});
