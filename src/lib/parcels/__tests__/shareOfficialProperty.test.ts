import { describe, expect, it, vi } from "vitest";
import { buildSavedParcelMapHref, parseOfficialParcelReopenSearch } from "../officialParcelId";
import {
  buildOfficialPropertyGmailUrl,
  buildOfficialPropertySharePayload,
  shareOfficialPropertyLink,
} from "../shareOfficialProperty";

describe("official property sharing", () => {
  const payload = buildOfficialPropertySharePayload({
    title: "Erf 1570",
    senderName: "Amina Patel",
    url: "https://easyerf.example/?officialParcel=csg%3Alpi%3Ac03400140000157000000&fromSaved=1",
  });

  it("uses the sender first name for clean share copy", () => {
    expect(payload).toMatchObject({
      title: "Erf 1570",
      text: "Amina sent you this property to check out on Easy Erf.",
      sender: "Amina",
    });
    expect(
      buildOfficialPropertySharePayload({ title: "Erf 1570", url: payload.url }).text,
    ).toBe("Someone sent you this property to check out on Easy Erf.");
  });

  it("builds a personalized Gmail compose draft with the canonical clickable property URL", () => {
    const gmailUrl = new URL(buildOfficialPropertyGmailUrl(payload));

    expect(gmailUrl.origin).toBe("https://mail.google.com");
    expect(gmailUrl.searchParams.get("su")).toBe("Amina sent you a property on Easy Erf");
    expect(gmailUrl.searchParams.get("body")).toContain(
      "Amina is sending you this property to check out on Easy Erf.",
    );
    expect(gmailUrl.searchParams.get("body")).toContain("VIEW PROPERTY ON EASY ERF");
    expect(gmailUrl.searchParams.get("body")).toContain(payload.url);
  });

  it("opens the personalized Gmail draft before falling back to native sharing", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = { writeText: vi.fn() };
    const popup = { opener: "source-window" as unknown };
    const open = vi.fn().mockReturnValue(popup);

    await expect(
      shareOfficialPropertyLink({ share, clipboard }, payload, { open }),
    ).resolves.toBe("shared");
    expect(open).toHaveBeenCalledWith(buildOfficialPropertyGmailUrl(payload), "_blank");
    expect(popup.opener).toBeNull();
    expect(share).not.toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("uses native sharing when a Gmail popup is unavailable", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = { writeText: vi.fn() };

    await expect(
      shareOfficialPropertyLink({ share, clipboard }, payload, { open: () => null }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("copies the canonical property URL when Gmail and native sharing are unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareOfficialPropertyLink(
        { clipboard: { writeText } },
        payload,
        { open: () => null },
      ),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("does not report success when sharing fails", async () => {
    await expect(
      shareOfficialPropertyLink(
        { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } },
        payload,
        { open: () => null },
      ),
    ).rejects.toThrow("blocked");
  });

  it("builds a canonical official-property reopen URL without session data", () => {
    const href = buildSavedParcelMapHref("csg:lpi:c03400140000157000000", {
      title: "Erf 1570",
      erf: 1570,
      portion: 0,
      municipality: "Kouga Local Municipality",
      province: "Eastern Cape",
      lng: 24.82,
      lat: -34.16,
      zoom: 18,
    });

    expect(parseOfficialParcelReopenSearch(new URL(href, "https://easyerf.example").search)).toMatchObject({
      id: "csg:lpi:c03400140000157000000",
      fromSaved: true,
      erf: "1570",
      portion: "0",
    });
    expect(href).not.toMatch(/access_token|refresh_token|#/i);
  });
});
