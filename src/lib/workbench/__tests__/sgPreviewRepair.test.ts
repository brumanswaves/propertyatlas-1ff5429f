import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { repairSgPreview } from "../sgPreviewRepair";

describe("SG preview repair", () => {
  it("calls the deterministic preview function with the signed-in parcel binding", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, previewAvailable: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await repairSgPreview(
      "53f6eb6f-f2de-4794-b178-0545642fc183",
      "csg:lpi:c03400140000157000000",
      {
        fetchImpl: fetchImpl as typeof fetch,
        url: "https://example.test/functions/v1/render-sg-preview",
        apiKey: "public-test-key",
        accessToken: "signed-in-test-token",
      },
    );

    expect(result).toEqual({ success: true, previewAvailable: true, code: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.test/functions/v1/render-sg-preview");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer signed-in-test-token",
      apikey: "public-test-key",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      assetId: "53f6eb6f-f2de-4794-b178-0545642fc183",
      expectedParcelId: "csg:lpi:c03400140000157000000",
    });
  });

  it("fails closed when preview generation is unavailable", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, code: "PREVIEW_UNSUPPORTED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      repairSgPreview("asset-id", "parcel-id", {
        fetchImpl: fetchImpl as typeof fetch,
        url: "https://example.test/functions/v1/render-sg-preview",
        apiKey: "public-test-key",
        accessToken: "signed-in-test-token",
      }),
    ).resolves.toEqual({
      success: false,
      previewAvailable: false,
      code: "PREVIEW_UNSUPPORTED",
    });
  });

  it("keeps deterministic preview generation separate from extraction and AI", () => {
    const source = readFileSync(
      new URL("../../../../supabase/functions/render-sg-preview/index.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("const MAX_PREVIEW_EDGE = 1_200");
    expect(source).toContain('identity === "mismatch"');
    expect(source).toContain('metadata.identityBinding === "user_confirmed"');
    expect(source).toContain('sgPreviewProvider: "easy_erf_deterministic_tiff"');
    expect(source).not.toContain("OPENAI_API_KEY");
    expect(source).not.toContain("api.openai.com");
    expect(source).not.toContain("extractedClaims:");
    expect(source).not.toContain("extractionStatus:");
  });
});
