import { afterEach, describe, expect, it, vi } from "vitest";

import { createStrategyCloudSaveQueue, waitForStrategyWrites } from "../strategyCloudSaveQueue";
import type { ErfStrategyWorkspace } from "../erfWorkspaceState";

function workspace(parcelId: string, label: string): ErfStrategyWorkspace {
  return {
    schemaVersion: 1,
    parcelId,
    activeStrategy: label,
    draftInputs: { label },
    draftUpdatedAt: `2026-07-20T12:00:0${label.length}.000Z`,
    scenarios: [],
    chosenScenarioId: null,
    chosenScenarioUpdatedAt: null,
    migratedFromLegacy: false,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("strategy cloud save queue", () => {
  it("keeps a scoped in-flight barrier across navigation without blocking another account", async () => {
    const write = deferred<void>();
    const queue = createStrategyCloudSaveQueue({ parcelId: "parcel", userId: "A", persist: () => write.promise });
    queue.schedule(workspace("parcel", "draft"));
    const saving = queue.flush();
    let settled = false;
    const wait = waitForStrategyWrites("parcel", "A").then(() => { settled = true; });
    await waitForStrategyWrites("parcel", "B");
    expect(settled).toBe(false);
    expect(queue.discardPending()).toBe(false);
    queue.dispose();
    write.resolve();
    await saving;
    await wait;
    expect(settled).toBe(true);
  });
  it("flush waits for both the in-flight write and the newest queued draft", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const persist = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const queue = createStrategyCloudSaveQueue({ parcelId: "parcel-a", userId: "user-a", persist });
    queue.schedule(workspace("parcel-a", "old"));
    const initial = queue.flush();
    await Promise.resolve();
    queue.schedule(workspace("parcel-a", "new"));
    let settled = false;
    const latest = queue.flush().then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    second.resolve();
    await Promise.all([initial, latest]);
    expect(persist).toHaveBeenLastCalledWith(workspace("parcel-a", "new"));
    expect(queue.getStatus().status).toBe("saved");
    queue.dispose();
  });

  it("explicit flush rejects a failed save and retains the draft for retry", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const queue = createStrategyCloudSaveQueue({ parcelId: "parcel-a", userId: "user-a", persist });
    const draft = workspace("parcel-a", "retained");
    queue.schedule(draft);
    await expect(queue.flush()).rejects.toThrow("offline");
    await queue.retry();
    expect(persist).toHaveBeenLastCalledWith(draft);
    expect(queue.getStatus().status).toBe("saved");
    queue.dispose();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("debounces cloud saves while local callers can persist immediately", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-1",
      persist,
    });

    queue.schedule(workspace("parcel-a", "a"));
    await vi.advanceTimersByTimeAsync(749);
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ parcelId: "parcel-a" }));
  });

  it("never saves a workspace for another parcel through the old parcel queue", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-1",
      persist,
    });

    queue.schedule(workspace("parcel-b", "b"));
    await vi.advanceTimersByTimeAsync(1000);
    await queue.flush();

    expect(persist).not.toHaveBeenCalled();
  });

  it("does not notify React subscribers after dispose", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-1",
      persist,
    });
    const listener = vi.fn();
    queue.subscribe(listener);
    listener.mockClear();

    queue.schedule(workspace("parcel-a", "a"));
    listener.mockClear();
    queue.dispose();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("retries the newest pending workspace when an older in-flight save fails", async () => {
    vi.useFakeTimers();
    const first = deferred<void>();
    const persist = vi.fn(() => first.promise);
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-1",
      persist,
    });
    const older = workspace("parcel-a", "old");
    const newer = workspace("parcel-a", "newer");

    queue.schedule(older);
    await vi.advanceTimersByTimeAsync(750);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenLastCalledWith(older);

    queue.schedule(newer);
    persist.mockImplementation(() => Promise.resolve());
    first.reject(new Error("network"));
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.getStatus()).toMatchObject({ status: "failed" });
    await queue.retry();

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith(newer);
  });

  it("keeps signed-out Strategy drafts offline without network side effects", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: null,
      persist,
    });

    queue.schedule(workspace("parcel-a", "draft"));
    await vi.advanceTimersByTimeAsync(1000);
    await queue.flush();

    expect(queue.getStatus()).toMatchObject({ status: "offline" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not persist user A's pending draft after the active session changes to user B", async () => {
    vi.useFakeTimers();
    let activeUserId: string | null = "user-a";
    const userAPersist = vi.fn(() => Promise.resolve());
    const userBPersist = vi.fn(() => Promise.resolve());
    const userAQueue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-a",
      canPersist: () => activeUserId === "user-a",
      persist: userAPersist,
    });

    userAQueue.schedule(workspace("parcel-a", "user-a-draft"));
    activeUserId = "user-b";
    await vi.advanceTimersByTimeAsync(750);

    expect(userAPersist).not.toHaveBeenCalled();
    expect(userAQueue.getStatus()).toMatchObject({ status: "offline" });

    const userBQueue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-b",
      canPersist: () => activeUserId === "user-b",
      persist: userBPersist,
    });
    userBQueue.schedule(workspace("parcel-a", "user-b-draft"));
    await vi.advanceTimersByTimeAsync(750);

    expect(userBPersist).toHaveBeenCalledTimes(1);
    expect(userBPersist).toHaveBeenLastCalledWith(
      expect.objectContaining({ draftInputs: { label: "user-b-draft" } }),
    );
  });

  it("does not start a cloud request when logout happens before cleanup flush", async () => {
    vi.useFakeTimers();
    let activeUserId: string | null = "user-a";
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-a",
      canPersist: () => activeUserId === "user-a",
      persist,
    });

    queue.schedule(workspace("parcel-a", "draft"));
    activeUserId = null;
    await queue.flush();

    expect(persist).not.toHaveBeenCalled();
    expect(queue.getStatus()).toMatchObject({ status: "offline" });
  });

  it("flushes the correct parcel when the same user switches parcels", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const queue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-a",
      canPersist: () => true,
      persist,
    });

    queue.schedule(workspace("parcel-a", "parcel-a-draft"));
    await queue.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ parcelId: "parcel-a" }));
  });

  it("disposing an old queue does not affect the new user queue", async () => {
    vi.useFakeTimers();
    const oldPersist = vi.fn(() => Promise.resolve());
    const newPersist = vi.fn(() => Promise.resolve());
    const oldQueue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-a",
      persist: oldPersist,
    });
    const newQueue = createStrategyCloudSaveQueue({
      parcelId: "parcel-a",
      userId: "user-b",
      persist: newPersist,
    });

    oldQueue.schedule(workspace("parcel-a", "old"));
    oldQueue.dispose();
    newQueue.schedule(workspace("parcel-a", "new"));
    await vi.advanceTimersByTimeAsync(750);

    expect(oldPersist).not.toHaveBeenCalled();
    expect(newPersist).toHaveBeenCalledTimes(1);
  });
});
