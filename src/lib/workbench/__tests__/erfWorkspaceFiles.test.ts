import { describe, expect, it } from "vitest";
import {
  isPdfAttachment,
  isPreviewableImageAttachment,
  isTiffAttachment,
  SG_DIAGRAM_MAX_BYTES,
  sgDiagramAttachmentKey,
  validateSgDiagramFile,
} from "../erfWorkspaceFiles";

function file(name: string, type: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("erfWorkspaceFiles", () => {
  it("keys SG diagram attachments by parcel id", () => {
    expect(sgDiagramAttachmentKey("csg:lpi:abc")).toBe("csg:lpi:abc:sg-diagram");
  });

  it("accepts SG diagram file types without adding scraping or parsing", () => {
    expect(validateSgDiagramFile(file("diagram.pdf", "application/pdf"))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.png", "image/png"))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.jpg", "image/jpeg"))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.jpeg", "image/jpeg"))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.tif", ""))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.tiff", "image/tiff"))).toEqual({ ok: true });
    expect(validateSgDiagramFile(file("diagram.exe", "application/x-msdownload"))).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects files above the local browser storage limit", () => {
    expect(
      validateSgDiagramFile(file("diagram.pdf", "application/pdf", SG_DIAGRAM_MAX_BYTES + 1)),
    ).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("classifies browser preview support honestly", () => {
    expect(isPdfAttachment("diagram.pdf", "application/pdf")).toBe(true);
    expect(isPreviewableImageAttachment("diagram.png", "image/png")).toBe(true);
    expect(isPreviewableImageAttachment("diagram.jpeg", "image/jpeg")).toBe(true);
    expect(isTiffAttachment("diagram.tiff", "image/tiff")).toBe(true);
    expect(isPreviewableImageAttachment("diagram.tiff", "image/tiff")).toBe(false);
  });
});
