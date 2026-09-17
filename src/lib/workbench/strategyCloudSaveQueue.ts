import type { ErfStrategyWorkspace } from "./erfWorkspaceState";

const pendingWrites = new Map<string, Promise<void>>();
const scopeKey = (parcelId: string, userId: string | null) => JSON.stringify([userId, parcelId]);
export function waitForStrategyWrites(parcelId: string, userId: string | null) {
  return (pendingWrites.get(scopeKey(parcelId, userId)) ?? Promise.resolve()).catch(() => {});
}

export type StrategyCloudSaveStatus = "idle" | "saving" | "saved" | "failed" | "offline";

export interface StrategyCloudSaveSnapshot {
  parcelId: string;
  status: StrategyCloudSaveStatus;
  lastSavedAt: string | null;
  error: string | null;
}

export interface StrategyCloudSaveQueue {
  schedule(workspace: ErfStrategyWorkspace): void;
  flush(): Promise<void>;
  retry(): Promise<void>;
  discardPending(): boolean;
  dispose(): void;
  getStatus(): StrategyCloudSaveSnapshot;
  subscribe(listener: (snapshot: StrategyCloudSaveSnapshot) => void): () => void;
}

interface StrategyCloudSaveQueueOptions {
  parcelId: string;
  userId: string | null;
  debounceMs?: number;
  now?: () => string;
  canPersist?: () => boolean | Promise<boolean>;
  persist: (workspace: ErfStrategyWorkspace) => Promise<void>;
}

function isSameParcel(parcelId: string, workspace: ErfStrategyWorkspace | null | undefined) {
  return Boolean(workspace && workspace.parcelId === parcelId);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Cloud save failed";
}

export function createStrategyCloudSaveQueue({
  parcelId,
  userId,
  debounceMs = 750,
  now = () => new Date().toISOString(),
  canPersist = () => true,
  persist,
}: StrategyCloudSaveQueueOptions): StrategyCloudSaveQueue {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let pendingWorkspace: ErfStrategyWorkspace | null = null;
  let latestWorkspace: ErfStrategyWorkspace | null = null;
  let snapshot: StrategyCloudSaveSnapshot = {
    parcelId,
    status: userId ? "idle" : "offline",
    lastSavedAt: null,
    error: null,
  };
  const listeners = new Set<(next: StrategyCloudSaveSnapshot) => void>();

  const emit = (patch: Partial<StrategyCloudSaveSnapshot>) => {
    snapshot = { ...snapshot, ...patch, parcelId };
    if (disposed) return;
    const next = { ...snapshot };
    listeners.forEach((listener) => listener(next));
  };

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const drain = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (!pendingWorkspace) return Promise.resolve();
    if (!userId) {
      emit({ status: "offline", error: null });
      return Promise.resolve();
    }
    // All flush callers join one drain, including edits queued during a write.
    inFlight = (async () => {
      while (pendingWorkspace) {
        const workspaceToSave = pendingWorkspace;
        pendingWorkspace = null;
        emit({ status: "saving", error: null });
        try {
          if (!(await canPersist())) {
            pendingWorkspace ??= workspaceToSave;
            emit({ status: "offline", error: null });
            return;
          }
          await persist(workspaceToSave);
        } catch (error) {
          pendingWorkspace ??= workspaceToSave;
          clearTimer();
          emit({ status: "failed", error: errorMessage(error) });
          throw error;
        }
      }
      emit({ status: "saved", lastSavedAt: now(), error: null });
    })().finally(() => {
      if (pendingWrites.get(scopeKey(parcelId, userId)) === inFlight) pendingWrites.delete(scopeKey(parcelId, userId));
      inFlight = null;
    });
    pendingWrites.set(scopeKey(parcelId, userId), inFlight);
    return inFlight;
  };

  return {
    schedule(workspace) {
      if (disposed || !isSameParcel(parcelId, workspace)) return;
      latestWorkspace = workspace;
      if (!userId) {
        emit({ status: "offline", error: null });
        return;
      }
      pendingWorkspace = workspace;
      emit({ status: "saving", error: null });
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void drain().catch(() => {});
      }, debounceMs);
    },
    async flush() {
      if (disposed) return;
      clearTimer();
      await drain();
    },
    async retry() {
      if (disposed) return;
      clearTimer();
      pendingWorkspace ??= latestWorkspace;
      await drain();
    },
    discardPending() {
      if (inFlight) return false;
      clearTimer();
      pendingWorkspace = null;
      latestWorkspace = null;
      emit({ status: "idle", error: null });
      return true;
    },
    dispose() {
      disposed = true;
      clearTimer();
      listeners.clear();
    },
    getStatus() {
      return { ...snapshot };
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      listener({ ...snapshot });
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
