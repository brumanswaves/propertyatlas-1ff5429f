import { afterEach, describe, expect, it, vi } from "vitest";
import { createSitePotentialPackStatusPoller } from "../packStatusPolling";

describe("Site Potential pack status polling lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not overlap requests and polls only on the configured interval", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: { status: string }) => void) | null = null;
    const readStatus = vi.fn((signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      return new Promise<{ status: string }>((resolve) => {
        resolveFirst = resolve;
      });
    });
    const poller = createSitePotentialPackStatusPoller({
      intervalMs: 5000,
      readStatus,
      shouldContinue: () => true,
    });

    poller.start();
    expect(readStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4999);
    expect(readStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(readStatus).toHaveBeenCalledTimes(1);

    resolveFirst?.({ status: "generating" });
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(5000);
    expect(readStatus).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("clears timers and aborts the active request on unmount/change", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const readStatus = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ status: string }>(() => undefined);
    });
    const poller = createSitePotentialPackStatusPoller({
      intervalMs: 5000,
      readStatus,
      shouldContinue: () => true,
    });

    poller.start();
    expect(readStatus).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    poller.stop();
    expect(signals[0].aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(10000);
    expect(readStatus).toHaveBeenCalledTimes(1);
  });

  it("stops polling when the status becomes terminal", async () => {
    vi.useFakeTimers();
    const readStatus = vi
      .fn<[AbortSignal], Promise<{ status: string } | null>>()
      .mockResolvedValueOnce({ status: "generating" })
      .mockResolvedValueOnce({ status: "complete" });
    const poller = createSitePotentialPackStatusPoller({
      intervalMs: 5000,
      readStatus,
      shouldContinue: (status) => status?.status !== "complete",
    });

    poller.start();
    await Promise.resolve();
    expect(readStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
    expect(readStatus).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(10000);
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
});
