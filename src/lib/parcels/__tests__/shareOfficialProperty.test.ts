import { describe, expect, it, vi } from "vitest";
import { buildSavedParcelMapHref, parseOfficialParcelReopenSearch } from "../officialParcelId";
import {
  buildOfficialPropertyGmailUrl,
  buildOfficialPropertySharePayload,
  shareOfficialPropertyLink,
} from "../shareOfficialProperty";

describe("official property sharing", () => {
  const canonicalUrl =
    "https://easyerf.example/?officialParcel=csg%3Alpi%3Ac03400140000157000000&fromSaved=1";
  const payload = buildOfficialPropertySharePayload({
    title: "Erf 3845 - 1 Jack Nicklaus Drive",
    senderName: "Brandon Foster",
    url: canonicalUrl,
    erfNumber: 3845,
    address: "1 Jack Nicklaus Drive",
    area: "St Francis Links",
    locality: "St Francis Bay, 6312",
  });

  it("builds a natural subject from the sender, erf, and area", () => {
    expect(payload).toMatchObject({
      title: "Erf 3845 - 1 Jack Nicklaus Drive",
      sender: "Brandon",
      subject: "Brandon shared Erf 3845, St Francis Links with you",
      propertyLines: ["Erf 3845", "1 Jack Nicklaus Drive", "St Francis Links, St Francis Bay, 6312"],
    });
  });

  it("uses deterministic subject fallbacks without awkward sender language", () => {
    expect(
      buildOfficialPropertySharePayload({
        title: "Erf 3845",
        senderName: "Brandon Foster",
        url: canonicalUrl,
        erfNumber: 3845,
      }).subject,
    ).toBe("Brandon shared Erf 3845 with you");
    expect(
      buildOfficialPropertySharePayload({
        title: "1 Jack Nicklaus Drive",
        senderName: "Brandon Foster",
        url: canonicalUrl,
        address: "1 Jack Nicklaus Drive",
      }).subject,
    ).toBe("Brandon shared 1 Jack Nicklaus Drive with you");
    expect(
      buildOfficialPropertySharePayload({ title: "Property", senderName: "Brandon Foster", url: canonicalUrl })
        .subject,
    ).toBe("Brandon shared a property with you");
    expect(
      buildOfficialPropertySharePayload({ title: "Erf 3845", url: canonicalUrl, erfNumber: 3845 }).subject,
    ).toBe("A property was shared with you on Easy Erf");
  });

  it("builds a structured Gmail draft with the canonical clickable property URL", () => {
    const gmailUrl = new URL(buildOfficialPropertyGmailUrl(payload));
    const subject = gmailUrl.searchParams.get("su");
    const body = gmailUrl.searchParams.get("body");

    expect(gmailUrl.origin).toBe("https://mail.google.com");
    expect(subject).toBe("Brandon shared Erf 3845, St Francis Links with you");
    expect(body).toContain("Hi,");
    expect(body).toContain("I thought you might want to take a look at this property:");
    expect(body).toContain("Erf 3845\n1 Jack Nicklaus Drive\nSt Francis Links, St Francis Bay, 6312");
    expect(body).toContain("VIEW PROPERTY ON EASY ERF ->");
    expect(body).toContain("Property and investment numbers");
    expect(body).toContain("Brandon\n\nEasy Erf\nProperty intelligence made simple.");
    expect(body).toContain(canonicalUrl);
    expect(body).not.toContain("Brandon is sending you this property");
    expect(gmailUrl.searchParams.get("body")).toContain(payload.url);
  });

  it("omits unavailable or duplicated property fields from the Gmail body", () => {
    const deduplicatedPayload = buildOfficialPropertySharePayload({
      title: "Erf 3845 - 1 Jack Nicklaus Drive",
      senderName: "Brandon Foster",
      url: canonicalUrl,
      erfNumber: 3845,
      address: "1 Jack Nicklaus Drive, St Francis Links",
      area: "St Francis Links",
      locality: "St Francis Bay",
    });
    const body = new URL(buildOfficialPropertyGmailUrl(deduplicatedPayload)).searchParams.get("body") ?? "";

    expect(deduplicatedPayload.propertyLines).toEqual([
      "Erf 3845",
      "1 Jack Nicklaus Drive, St Francis Links",
      "St Francis Bay",
    ]);
    expect(body).not.toContain("Erf 3845 - 1 Jack Nicklaus Drive");
    expect(body.match(/St Francis Links/g)).toHaveLength(1);
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
