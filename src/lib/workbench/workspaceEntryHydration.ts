import { erfWorkspaceStateKey } from "./erfWorkspaceState";

type EntryStorage = Pick<Storage, "length" | "key" | "getItem">;
type EntryRead = {
  storage: EntryStorage;
  initial: string | null;
  automatic: string | null;
  writing: boolean;
};
const reads = new Map<string, EntryRead>();
const empty = "[]";
const scopeKey = (parcelId: string, userId: string) => JSON.stringify([userId, parcelId]);

// Compare all canonical stores in this account/parcel, including inputs and baselines.
// Existing or unreadable data never qualifies as a fresh automatic entry.
function snapshot(storage: EntryStorage, parcelId: string, userId: string) {
  try {
    const workspaceKey = erfWorkspaceStateKey(parcelId, userId);
    const suffix = `.${encodeURIComponent(parcelId)}`;
    const prefix = workspaceKey.slice(0, -`workspace${suffix}`.length);
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(prefix) && key.endsWith(suffix)) keys.push(key);
    }
    return JSON.stringify(
      keys.sort().map((key) => {
        const value = storage.getItem(key);
        if (value === null) throw new Error("Storage changed during snapshot");
        return [key, value];
      }),
    );
  } catch {
    return null;
  }
}

export function beginWorkspaceEntryRead(storage: EntryStorage, parcelId: string, userId: string) {
  const key = scopeKey(parcelId, userId);
  const read: EntryRead = {
    storage,
    initial: snapshot(storage, parcelId, userId),
    automatic: null,
    writing: false,
  };
  reads.set(key, read);
  return {
    automaticWriteInProgress() {
      return reads.get(key) === read && read.writing;
    },
    unchangedAutomaticEntry() {
      return (
        reads.get(key) === read &&
        read.initial === empty &&
        read.automatic !== null &&
        snapshot(storage, parcelId, userId) === read.automatic
      );
    },
    finish() {
      if (reads.get(key) === read) reads.delete(key);
    },
  };
}

// Only OfficialParcelPanel's automatic entry write uses this wrapper. It never
// marks confirmation/address/input changes as initialization.
export function recordAutomaticWorkspaceEntry<T>(
  storage: EntryStorage,
  parcelId: string,
  userId: string | null,
  write: () => T,
): T {
  const read = userId ? reads.get(scopeKey(parcelId, userId)) : undefined;
  const before = userId && read?.storage === storage ? snapshot(storage, parcelId, userId) : null;
  if (read) read.writing = true;
  let result: T;
  try {
    result = write();
  } finally {
    if (read) read.writing = false;
  }
  if (
    userId &&
    read &&
    reads.get(scopeKey(parcelId, userId)) === read &&
    read.initial === empty &&
    before === empty
  ) {
    const after = snapshot(storage, parcelId, userId);
    // The automatic path writes only its canonical workspace; no other draft is eligible.
    if (after !== null) {
      const entries: [string, string][] = JSON.parse(after);
      if (
        entries.length === 1 &&
        entries[0][0] === erfWorkspaceStateKey(parcelId, userId) &&
        entries[0][1] === JSON.stringify(result)
      )
        read.automatic = after;
    }
  }
  return result;
}
