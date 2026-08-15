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
});
