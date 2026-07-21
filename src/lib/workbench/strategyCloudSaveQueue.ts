import type { ErfStrategyWorkspace } from "./erfWorkspaceState";

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
  dispose(): void;
  getStatus(): StrategyCloudSaveSnapshot;
  subscribe(listener: (snapshot: StrategyCloudSaveSnapshot) => void): () => void;
}

interface StrategyCloudSaveQueueOptions {
  parcelId: string;
  userId: string | null;
  debounceMs?: number;
  now?: () => string;
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
  persist,
}: StrategyCloudSaveQueueOptions): StrategyCloudSaveQueue {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
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

  const drain = async (workspace: ErfStrategyWorkspace | null): Promise<void> => {
    if (!workspace || workspace.parcelId !== parcelId) return;
    const workspaceToSave = workspace;
    if (!userId) {
      emit({ status: "offline", error: null });
      return;
    }
    if (inFlight) {
      pendingWorkspace = workspace;
      emit({ status: "saving", error: null });
      return;
    }

    inFlight = true;
    if (pendingWorkspace === workspaceToSave) pendingWorkspace = null;
    emit({ status: "saving", error: null });
    try {
      await persist(workspaceToSave);
      inFlight = false;
      const pending = pendingWorkspace;
      if (isSameParcel(parcelId, pending)) {
        pendingWorkspace = null;
        await drain(pending);
        return;
      }
      emit({ status: "saved", lastSavedAt: now(), error: null });
    } catch (error) {
      inFlight = false;
      if (!isSameParcel(parcelId, pendingWorkspace)) pendingWorkspace = workspaceToSave;
      emit({ status: "failed", error: errorMessage(error) });
    }
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
        const pending = pendingWorkspace;
        if (pending) void drain(pending);
      }, debounceMs);
    },
    async flush() {
      if (disposed) return;
      clearTimer();
      const workspace = pendingWorkspace ?? latestWorkspace;
      await drain(workspace);
    },
    async retry() {
      if (disposed) return;
      clearTimer();
      const workspace = pendingWorkspace ?? latestWorkspace;
      await drain(workspace);
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
