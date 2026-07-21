import { describe, expect, it, vi } from "vitest";

import {
  preloadPrintableImageUrl,
  waitForRenderSettlement,
  type PrintableImageLoader,
} from "../printImageReadiness";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createControlledImage() {
  const image: PrintableImageLoader = {
    onload: null,
    onerror: null,
    src: "",
  };
  return image;
}

function renderSelectedSitePotentialPrintMarkup(
  readiness: Awaited<ReturnType<typeof preloadPrintableImageUrl>>,
) {
  if (readiness.status === "ready") {
    return `<img class="report-print-site-image" src="${readiness.url}" alt="Selected Site Potential concept" />`;
  }

  return "<p>Selected Site Potential image could not be loaded for this PDF.</p>";
}

describe("print image readiness", () => {
  it("marks a signed Site Potential image ready only after the image loads", async () => {
    const image = createControlledImage();
    const readiness = preloadPrintableImageUrl(
      () => Promise.resolve("https://example.com/concept.png"),
      () => image,
    );
    await Promise.resolve();

    expect(image.src).toBe("https://example.com/concept.png");
    image.onload?.(new Event("load"));

    await expect(readiness).resolves.toEqual({
      status: "ready",
      url: "https://example.com/concept.png",
    });
  });

  it("marks a signed URL as failed when the actual image request errors", async () => {
    const image = createControlledImage();
    const readiness = preloadPrintableImageUrl(
      () => Promise.resolve("https://example.com/broken.png"),
      () => image,
    );
    await Promise.resolve();
    image.onerror?.(new Event("error"));

    await expect(readiness).resolves.toEqual({ status: "failed", url: null });
  });

  it("does not treat a cached signed URL as printable until the image load settles", async () => {
    const image = createControlledImage();
    const readiness = preloadPrintableImageUrl(
      () => Promise.resolve("https://example.com/cached-but-broken.png"),
      () => image,
    );
    let settled = false;
    readiness.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(image.src).toBe("https://example.com/cached-but-broken.png");
    expect(settled).toBe(false);
    image.onerror?.(new Event("error"));

    const result = await readiness;
    expect(result).toEqual({ status: "failed", url: null });
    const printMarkup = renderSelectedSitePotentialPrintMarkup(result);
    expect(printMarkup).toContain("Selected Site Potential image could not be loaded for this PDF.");
    expect(printMarkup).not.toContain("<img");
    expect(settled).toBe(true);
  });

  it("marks the image failed when signed URL creation fails", async () => {
    await expect(
      preloadPrintableImageUrl(() => Promise.reject(new Error("signed URL failed"))),
    ).resolves.toEqual({ status: "failed", url: null });
  });

  it("remains pending while signed URL creation is pending", async () => {
    const signedUrl = deferred<string | null>();
    const image = createControlledImage();
    const readiness = preloadPrintableImageUrl(() => signedUrl.promise, () => image);
    let settled = false;
    readiness.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    signedUrl.resolve("https://example.com/concept.png");
    await Promise.resolve();
    expect(settled).toBe(false);
    image.onload?.(new Event("load"));

    await expect(readiness).resolves.toMatchObject({ status: "ready" });
  });

  it("waits for deterministic render settlement before print image queries", async () => {
    const callbacks: Array<FrameRequestCallback> = [];
    const win = {
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    } as unknown as Window;
    const settled = vi.fn();
    const promise = waitForRenderSettlement(win).then(settled);

    expect(settled).not.toHaveBeenCalled();
    callbacks.shift()?.(0);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    callbacks.shift()?.(16);
    await promise;

    expect(settled).toHaveBeenCalledTimes(1);
  });
});
