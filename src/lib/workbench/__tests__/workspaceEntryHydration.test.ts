import { describe, expect, it } from "vitest";
import { beginWorkspaceEntryRead, recordAutomaticWorkspaceEntry } from "../workspaceEntryHydration";
import { browserScopedParcelKey, erfWorkspaceStateKey } from "../erfWorkspaceState";

function storage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
const parcel = "csg:1570";
const user = "owner";
const key = erfWorkspaceStateKey(parcel, user);
describe("fresh automatic workspace entry provenance", () => {
  it("recognizes only a recorded unchanged automatic write in the active read", () => {
    const s = storage();
    const read = beginWorkspaceEntryRead(s, parcel, user);
    expect(read.unchangedAutomaticEntry()).toBe(false);
    recordAutomaticWorkspaceEntry(s, parcel, user, () => {
      expect(read.automaticWriteInProgress()).toBe(true);
      const entry = { startedAt: "entry" };
      s.setItem(key, JSON.stringify(entry));
      return entry;
    });
    expect(read.automaticWriteInProgress()).toBe(false);
    expect(read.unchangedAutomaticEntry()).toBe(true);
    read.finish();
    expect(read.unchangedAutomaticEntry()).toBe(false);
  });
  it.each([
    "workspace",
    "erfstoep.build-envelope.v1:",
    "identity-check",
    "investigation-sync-baseline",
    "strategy-workspace.v1",
  ])("retains pre-existing %s including malformed storage", (kind) => {
    const s = storage();
    s.setItem(browserScopedParcelKey(kind, parcel, user), "malformed");
    const read = beginWorkspaceEntryRead(s, parcel, user);
    recordAutomaticWorkspaceEntry(s, parcel, user, () => {
      s.setItem(key, JSON.stringify({ entry: true }));
      return { entry: true };
    });
    expect(read.unchangedAutomaticEntry()).toBe(false);
    read.finish();
  });
  it.each(["workspace", "erfstoep.build-envelope.v1:", "identity-check"])(
    "denies an edit to %s during the read",
    (kind) => {
      const s = storage();
      const read = beginWorkspaceEntryRead(s, parcel, user);
      recordAutomaticWorkspaceEntry(s, parcel, user, () => {
        s.setItem(key, JSON.stringify({ entry: true }));
        return { entry: true };
      });
      s.setItem(browserScopedParcelKey(kind, parcel, user), "user edit");
      expect(read.unchangedAutomaticEntry()).toBe(false);
      read.finish();
    },
  );
  it("does not accept untagged writes, other scopes or a superseded generation", () => {
    const s = storage();
    const old = beginWorkspaceEntryRead(s, parcel, user);
    recordAutomaticWorkspaceEntry(s, "other", user, () => {
      s.setItem(key, JSON.stringify({ entry: true }));
      return { entry: true };
    });
    expect(old.unchangedAutomaticEntry()).toBe(false);
    const current = beginWorkspaceEntryRead(s, parcel, user);
    old.finish();
    expect(old.unchangedAutomaticEntry()).toBe(false);
    expect(current.unchangedAutomaticEntry()).toBe(false);
    current.finish();
  });
  it("rejects a synchronous listener edit during the automatic write", () => {
    const s = storage();
    const read = beginWorkspaceEntryRead(s, parcel, user);
    recordAutomaticWorkspaceEntry(s, parcel, user, () => {
      s.setItem(key, JSON.stringify({ entry: true, edited: true }));
      return { entry: true };
    });
    expect(read.unchangedAutomaticEntry()).toBe(false);
    read.finish();
  });
  it("fails closed on inaccessible storage", () => {
    const s = {
      length: 1,
      key: () => {
        throw new Error("denied");
      },
      getItem: () => null,
    };
    const read = beginWorkspaceEntryRead(s, parcel, user);
    recordAutomaticWorkspaceEntry(s, parcel, user, () => undefined);
    expect(read.unchangedAutomaticEntry()).toBe(false);
    read.finish();
  });
});
