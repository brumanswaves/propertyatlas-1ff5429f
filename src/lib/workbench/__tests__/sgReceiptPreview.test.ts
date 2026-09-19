import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkSgPreviewPage,
  checkSgPreviewSamples,
  checkSgPreviewEncoding,
} from "../sgPreviewLimits";
import { renderLocalSgTiff, SG_PREVIEW_DEADLINE_MS } from "../sgLocalPreview";
import {
  requestSgReading,
  resolveSgReadingStatus,
  SG_READING_RESPONSE_DEADLINE_MS,
} from "../sgReadingRequest";
import { extractErfAsset, type ExtractErfAssetResult } from "../erfAssetExtraction";
import group3 from "../../../../scripts/fixtures/sg-group3-2d.json";
import UTIF from "utif2";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("deterministic SG preview boundaries", () => {
  it("renders known 2-D Group 3 pixels through the actual worker and pinned decoder", async () => {
    const bytes = Uint8Array.from(Buffer.from(group3.base64, "base64"));
    const ifd = UTIF.decode(bytes.buffer)[0];
    expect(ifd.t292).toEqual([1]);
    UTIF.decodeImage(bytes.buffer, ifd);
    const expected = group3.rows.flatMap((row) =>
      [...row].flatMap((bit) => (bit === "1" ? [0, 0, 0, 255] : [255, 255, 255, 255])),
    );
    expect(Array.from(UTIF.toRGBA8(ifd))).toEqual(expected);

    const postMessage = vi.fn();
    const scope = { postMessage, onmessage: null as unknown as (event: unknown) => Promise<void> };
    let rendered: number[] = [];
    vi.stubGlobal("self", scope);
    vi.stubGlobal(
      "ImageData",
      class {
        constructor(public data: Uint8ClampedArray) {}
      },
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return {
            putImageData(image: { data: Uint8ClampedArray }) {
              rendered = Array.from(image.data);
            },
            drawImage() {},
          };
        }
        async convertToBlob() {
          return new Blob(["synthetic canvas output"]);
        }
      },
    );
    await import("../sgPreview.worker");
    await scope.onmessage({ data: { file: new Blob([bytes]), page: 0 } });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ width: 8, height: 4 }));
    expect(rendered).toEqual(expected);
    // Change only the standard option in this known fixture. Unsupported
    // extension/reserved bits must never reach the pixel decoder.
    for (const option of [2, 3, 6, 7, 8, 0xffffffff]) {
      const invalid = bytes.slice();
      const view = new DataView(invalid.buffer);
      const directory = view.getUint32(4);
      for (let i = 0; i < view.getUint16(directory); i++) {
        const offset = directory + 2 + i * 12;
        if (view.getUint16(offset) === 292) view.setUint32(offset + 8, option);
      }
      const decode = vi.spyOn(UTIF, "decodeImage");
      await scope.onmessage({ data: { file: new Blob([invalid]), page: 0 } });
      expect(decode).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenLastCalledWith({
        error: expect.stringContaining("local safety limits"),
      });
      decode.mockRestore();
    }
  });

  it("bounds Group 3 options without silently stripping 2-D or fill-bit semantics", () => {
    for (const flag of [0, 1, 4, 5])
      expect(() => checkSgPreviewEncoding(3, 0, false, [flag])).not.toThrow();
    for (const flags of [[], [1, 0], ["1"], [1.5], [-1], [NaN], [2], [8], null])
      expect(() => checkSgPreviewEncoding(3, 0, false, flags)).toThrow();
  });

  it("accepts normal monochrome/RGBA sheets but bounds dimensions, pages and pixel allocations", () => {
    expect(() => checkSgPreviewPage(2000, 3000, 0, 1)).not.toThrow();
    expect(() => checkSgPreviewSamples(1, [1])).not.toThrow();
    expect(() => checkSgPreviewSamples(4, [8, 8, 8, 8])).not.toThrow();
    for (const args of [
      [20000, 20000, 0, 1],
      [0, 12, 0, 1],
      [10, 10, 2, 2],
      [10, 10, 0, 33],
      [10, 10, 0, NaN],
    ]) {
      expect(() => checkSgPreviewPage(...(args as [number, number, number, number]))).toThrow();
    }
    expect(() => checkSgPreviewSamples(64, [8])).toThrow();
    expect(() => checkSgPreviewSamples(1, [64])).toThrow();
    for (const compression of [1, 3, 4, 32773])
      expect(() => checkSgPreviewEncoding(compression, 1, false)).not.toThrow();
    for (const compression of [5, 6, 7, 8, 32946, 34316])
      expect(() => checkSgPreviewEncoding(compression, 1, false)).toThrow();
    expect(() => checkSgPreviewEncoding(1, 32803, false)).toThrow();
    expect(() => checkSgPreviewEncoding(1, 1, true)).toThrow();
  });

  it("terminates slow decoding after eight seconds without any provider fallback", async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    const postMessage = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        terminate = terminate;
        postMessage = postMessage;
      },
    );
    const result = renderLocalSgTiff(new Blob(["synthetic"]), 0, new AbortController().signal);
    const check = expect(result).rejects.toThrow("no interpretation has started");
    await vi.advanceTimersByTimeAsync(SG_PREVIEW_DEADLINE_MS);
    await check;
    expect(terminate).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledOnce();
  });

  it("terminates preview on navigation/unmount", async () => {
    const terminate = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        terminate = terminate;
        postMessage = vi.fn();
      },
    );
    const controller = new AbortController();
    const result = renderLocalSgTiff(new Blob(["synthetic"]), 0, controller.signal);
    const check = expect(result).rejects.toThrow("Preview closed");
    controller.abort();
    await check;
    expect(terminate).toHaveBeenCalledOnce();
  });
});

describe("SG reader acknowledgement and duplicate prevention", () => {
  const options = { expectedParcelId: "synthetic-parcel" };
  const processing: ExtractErfAssetResult = {
    success: true,
    extractionStatus: "processing",
    claimCount: 0,
    identityMatchStatus: "unverified",
    documentType: null,
    warning: null,
  };

  it.each([
    [503, { error: "Synthetic temporary reader failure" }],
    [546, { code: "WORKER_LIMIT", error: "Synthetic gateway failure" }],
    [502, "<html>Bad gateway</html>"],
    [200, {}],
    [408, { code: "TIMEOUT" }],
    [409, { success: false, code: "ALREADY_PROCESSING" }],
  ])(
    "keeps a real-client HTTP %s ambiguous start locked after unchanged refresh",
    async (status, body) => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
      );
      const extract = (id: string, opts: typeof options) =>
        extractErfAsset(id, opts, {
          fetchImpl,
          accessToken: "synthetic-token",
          functionsUrl: "https://fixture.invalid/reader",
        });
      const id = `real-transport-${status}`;
      expect(await requestSgReading("owner", id, options, extract, "old-failed")).toMatchObject({
        code: "REVIEW_STATUS_UNKNOWN",
      });
      expect(resolveSgReadingStatus("owner", id, options, "failed", "old-failed")).toBe(false);
      await requestSgReading("owner", id, options, extract, "old-failed");
      expect(fetchImpl).toHaveBeenCalledOnce();
      // A new authoritative result can release the guard, but cannot start a retry itself.
      expect(resolveSgReadingStatus("owner", id, options, "failed", "new-result")).toBe(true);
      expect(fetchImpl).toHaveBeenCalledOnce();
      await requestSgReading("owner", id, options, extract, "new-result");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    [400, { success: false, code: "INVALID_REQUEST" }],
    [401, { success: false, code: "AUTH_REQUIRED" }],
    [403, { success: false, code: "FORBIDDEN" }],
    [409, { success: false, code: "PARCEL_MISMATCH" }],
    [502, { success: false, code: "TIMEOUT", extractionStatus: "failed" }],
    [503, { success: false, code: "SERVER_UNAVAILABLE", extractionStatus: "failed" }],
    [415, { success: false, code: "UNSUPPORTED_FILE_TYPE", extractionStatus: "unsupported" }],
  ])("preserves definitive real-client failure %s/%j", async (status, body) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    const result = await requestSgReading(
      "owner",
      `definitive-${body.code}`,
      options,
      (id, opts) => extractErfAsset(id, opts, { fetchImpl, accessToken: "synthetic-token" }),
      "old",
    );
    expect(result).toMatchObject({ success: false, code: body.code });
    expect(
      resolveSgReadingStatus("owner", `definitive-${body.code}`, options, "failed", "old"),
    ).toBe(true);
  });

  it("keeps real-client known-job retrieval available after a gateway failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "WORKER_LIMIT" }), { status: 546 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(processing), { status: 200 }));
    const extract = (id: string, opts: typeof options) =>
      extractErfAsset(id, opts, { fetchImpl, accessToken: "synthetic" });
    expect(
      await requestSgReading("owner", "real-known", options, extract, "job", true),
    ).toMatchObject({ code: "WORKER_LIMIT" });
    expect(
      await requestSgReading("owner", "real-known", options, extract, "job", true),
    ).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps a late ambiguous real-client response locked after the UI deadline and unchanged refresh", async () => {
    vi.useFakeTimers();
    let release!: (response: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const extract = (id: string, opts: typeof options) =>
      extractErfAsset(id, opts, { fetchImpl, accessToken: "synthetic" });
    const pending = requestSgReading("owner", "late-client", options, extract, "old-failed");
    await vi.advanceTimersByTimeAsync(SG_READING_RESPONSE_DEADLINE_MS);
    expect(await pending).toMatchObject({ code: "REVIEW_STATUS_UNKNOWN" });
    release(
      new Response(JSON.stringify({ error: "Synthetic temporary reader failure" }), {
        status: 503,
      }),
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(resolveSgReadingStatus("owner", "late-client", options, "failed", "old-failed")).toBe(
      false,
    );
    expect(
      await requestSgReading("owner", "late-client", options, extract, "old-failed"),
    ).toMatchObject({ code: "REVIEW_STATUS_UNKNOWN" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(resolveSgReadingStatus("owner", "late-client", options, "partial", "new-result")).toBe(
      true,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("coalesces calls and never restarts a still-pending request after the UI deadline", async () => {
    vi.useFakeTimers();
    let finish!: (value: ExtractErfAssetResult) => void;
    const extract = vi.fn(
      () =>
        new Promise<ExtractErfAssetResult>((resolve) => {
          finish = resolve;
        }),
    );
    const a = requestSgReading("owner", "slow-fixture", options, extract);
    const b = requestSgReading("owner", "slow-fixture", options, extract);
    await vi.advanceTimersByTimeAsync(SG_READING_RESPONSE_DEADLINE_MS);
    expect(await a).toMatchObject({ code: "REVIEW_STATUS_UNKNOWN" });
    expect(await b).toMatchObject({ code: "REVIEW_STATUS_UNKNOWN" });
    const later = requestSgReading("owner", "slow-fixture", options, extract);
    expect(extract).toHaveBeenCalledOnce();
    finish(processing);
    expect(await later).toEqual(processing);
  });

  it("does not treat a stale failed snapshot as proof that an ambiguous retry is safe", async () => {
    const extract = vi.fn().mockResolvedValue({ success: false, code: "SERVER_UNAVAILABLE" });
    await requestSgReading("owner", "ambiguous-fixture", options, extract, "before");
    expect(resolveSgReadingStatus("owner", "ambiguous-fixture", options, "failed", "before")).toBe(
      false,
    );
    await requestSgReading("owner", "ambiguous-fixture", options, extract, "before");
    expect(extract).toHaveBeenCalledOnce();
    expect(
      resolveSgReadingStatus("owner", "ambiguous-fixture", options, "processing", "acknowledged"),
    ).toBe(true);
  });

  it("isolates coalescing by account, parcel and delegated order", async () => {
    const extract = vi.fn().mockResolvedValue(processing);
    await Promise.all([
      requestSgReading("a", "isolation-fixture", options, extract),
      requestSgReading("b", "isolation-fixture", options, extract),
      requestSgReading("a", "isolation-fixture", { expectedParcelId: "other" }, extract),
      requestSgReading(
        "a",
        "isolation-fixture",
        { ...options, investigationOrderId: "assigned" },
        extract,
      ),
    ]);
    expect(extract).toHaveBeenCalledTimes(4);
  });

  it("allows a later retrieval of an already acknowledged background job after a transient failure", async () => {
    const extract = vi
      .fn()
      .mockResolvedValueOnce({ success: false, code: "SERVER_UNAVAILABLE" })
      .mockResolvedValueOnce(processing);
    expect(await requestSgReading("owner", "known-job", options, extract, "", true)).toMatchObject({
      code: "SERVER_UNAVAILABLE",
    });
    expect(await requestSgReading("owner", "known-job", options, extract, "", true)).toEqual(
      processing,
    );
    expect(extract).toHaveBeenCalledTimes(2);
  });
});
