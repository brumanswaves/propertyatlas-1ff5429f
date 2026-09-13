import { afterEach, describe, expect, it, vi } from "vitest";
import { listFounderInvestigators, inviteFounderInvestigator } from "../founderSupportClient";

afterEach(() => vi.unstubAllGlobals());

describe("Founder support canonical bearer", () => {
  it("uses the hydrated guard token without independently reading Auth", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, investigators: [] })));
    vi.stubGlobal("fetch", fetch);
    await expect(listFounderInvestigators("hydrated-founder-token")).resolves.toMatchObject({ success: true });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer hydrated-founder-token");
  });
  it("does not send a request without a session", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(listFounderInvestigators(null)).rejects.toThrow("session has ended");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("propagates actual server rejection for expired sessions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Session expired" }), { status: 401 })));
    await expect(listFounderInvestigators("expired-token")).rejects.toThrow("Session expired");
  });
  it("does not report delivery success when the invite endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Invitation delivery failed" }), { status: 502 })));
    await expect(inviteFounderInvestigator("valid", "Test", "test@example.invalid")).rejects.toThrow("Invitation delivery failed");
  });
});
