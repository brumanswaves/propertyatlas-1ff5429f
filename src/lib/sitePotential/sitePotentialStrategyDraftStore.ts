import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
} from "@/lib/workbench/erfWorkspaceState";

export interface SitePotentialStrategyDraft {
  source?: string;
  projectId?: string;
  selectedDesignAssetId?: string | null;
  conceptTitle?: string | null;
  buildableSqm?: string;
  notes?: string[];
}

type DraftStorage = Pick<Storage, "getItem">;

export function sitePotentialStrategyDraftStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey("site-potential-strategy-draft", parcelId, userId);
}

export function readSitePotentialStrategyDraft(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: DraftStorage | undefined =
    typeof window === "undefined" ? undefined : window.localStorage,
): SitePotentialStrategyDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sitePotentialStrategyDraftStorageKey(parcelId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SitePotentialStrategyDraft;
    return parsed?.source === "site-potential" ? parsed : null;
  } catch {
    return null;
  }
}
