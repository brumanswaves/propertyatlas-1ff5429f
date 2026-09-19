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
import type { ExtractErfAssetResult } from "../erfAssetExtraction";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("deterministic SG preview boundaries", () => {
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
