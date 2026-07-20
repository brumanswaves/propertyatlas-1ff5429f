import { describe, expect, it } from "vitest";
import { createReportPrintLifecycleController } from "../reportPrintLifecycle";

type Listener = EventListenerOrEventListenerObject;

function createTarget() {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
      );
    },
    emit(type: string, event?: { matches?: boolean }) {
      for (const listener of listeners.get(type) ?? []) {
        if (typeof listener === "function") listener(event as Event);
        else listener.handleEvent(event as Event);
      }
    },
    count(type: string) {
      return listeners.get(type)?.length ?? 0;
    },
  };
}

function createPrintMedia() {
  const target = createTarget();
  return {
    matches: false,
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    emit(matches: boolean) {
      this.matches = matches;
      target.emit("change", { matches });
    },
    count: target.count,
  };
}

function createHarness() {
  let now = 0;
  let timeout: Listener | null = null;
  const frame = createTarget();
  const parent = createTarget();
  const media = createPrintMedia();
  let cleanupCount = 0;
  const controller = createReportPrintLifecycleController({
    frameWindow: {
      ...frame,
      matchMedia: () => media as never,
      setTimeout: (handler: TimerHandler) => {
        timeout = handler as Listener;
        return 1;
      },
      clearTimeout: () => {
        timeout = null;
      },
    } as never,
    parentWindow: parent as never,
    emergencyCleanupMs: 120_000,
    focusMinimumHoldMs: 30_000,
    now: () => now,
    onFinish: () => {
      cleanupCount += 1;
      controller.dispose();
    },
  });

  return {
    controller,
    frame,
    parent,
    media,
    get cleanupCount() {
      return cleanupCount;
    },
    setNow(value: number) {
      now = value;
    },
    fireTimeout() {
      if (typeof timeout === "function") timeout({} as Event);
      else timeout?.handleEvent({} as Event);
    },
  };
}

describe("report print lifecycle controller", () => {
  it("registers iframe afterprint and print-media listeners", () => {
    const harness = createHarness();
    harness.controller.register();

    expect(harness.frame.count("afterprint")).toBe(1);
    expect(harness.parent.count("focus")).toBe(1);
    expect(harness.media.count("change")).toBe(1);
  });

  it("does not clean up solely from an early parent focus event", () => {
    const harness = createHarness();
    harness.controller.register();
    harness.controller.markPrintStarted();
    harness.setNow(600);
    harness.parent.emit("focus");

    expect(harness.cleanupCount).toBe(0);
    expect(harness.frame.count("afterprint")).toBe(1);
  });

  it("keeps the iframe mounted while print media is active and removes it after print media exits", () => {
    const harness = createHarness();
    harness.controller.register();
    harness.controller.markPrintStarted();

    harness.media.emit(true);
    expect(harness.controller.hasEnteredPrintMedia()).toBe(true);
    expect(harness.cleanupCount).toBe(0);

    harness.media.emit(false);
    expect(harness.cleanupCount).toBe(1);
    expect(harness.frame.count("afterprint")).toBe(0);
  });

  it("cleans up after iframe afterprint and emergency timeout", () => {
    const afterPrint = createHarness();
    afterPrint.controller.register();
    afterPrint.frame.emit("afterprint");
    expect(afterPrint.cleanupCount).toBe(1);

    const emergency = createHarness();
    emergency.controller.register();
    emergency.fireTimeout();
    expect(emergency.cleanupCount).toBe(1);
  });

  it("removes listeners on component unmount without firing cleanup", () => {
    const harness = createHarness();
    harness.controller.register();
    harness.controller.dispose();

    expect(harness.cleanupCount).toBe(0);
    expect(harness.frame.count("afterprint")).toBe(0);
    expect(harness.parent.count("focus")).toBe(0);
    expect(harness.media.count("change")).toBe(0);
  });
});
