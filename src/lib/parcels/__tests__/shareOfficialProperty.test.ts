import { describe, expect, it, vi } from "vitest";
import { buildSavedParcelMapHref, parseOfficialParcelReopenSearch } from "../officialParcelId";
import { buildOfficialPropertySharePayload, shareOfficialPropertyLink } from "../shareOfficialProperty";

describe("official property sharing", () => {
  const payload = buildOfficialPropertySharePayload({
    title: "Erf 1570",
    senderName: "Amina",
    url: "https://easyerf.example/?officialParcel=csg%3Alpi%3Ac03400140000157000000&fromSaved=1",
  });

  it("uses safe display metadata for clean share copy", () => {
    expect(payload).toMatchObject({
      title: "Erf 1570",
      text: "Amina sent you this property to check out on Easy Erf.",
    });
    expect(
      buildOfficialPropertySharePayload({ title: "Erf 1570", url: payload.url }).text,
    ).toBe("Someone sent you this property to check out on Easy Erf.");
  });

  it("uses native sharing when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = { writeText: vi.fn() };

    await expect(shareOfficialPropertyLink({ share, clipboard }, payload)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(payload);
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("copies the canonical property URL when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareOfficialPropertyLink({ clipboard: { writeText } }, payload),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("does not report success when sharing fails", async () => {
    await expect(
      shareOfficialPropertyLink(
        { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } },
        payload,
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
