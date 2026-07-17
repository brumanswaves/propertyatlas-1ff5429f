import type { LocalProvider } from "@/lib/localServices/catalog";

const STORAGE_PREFIX = "easyerf.local-property-team.saved";

export interface SavedLocalProvider {
  parcelId: string;
  placeId: string;
  serviceCategory: string;
  userNotes: string | null;
  savedAt: string;
}

function storageKey(parcelId: string) {
  return `${STORAGE_PREFIX}.${parcelId}`;
}

export function readSavedLocalProviders(parcelId: string): SavedLocalProvider[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(parcelId)) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const record = coerceSavedProvider(item, parcelId);
          return record ? [record] : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function writeSavedLocalProviders(parcelId: string, providers: SavedLocalProvider[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(parcelId),
      JSON.stringify(providers.filter((provider) => provider.parcelId === parcelId)),
    );
  } catch {
    // Local saving is optional. Provider search and outbound actions remain usable.
  }
}

export function toggleSavedLocalProvider(
  parcelId: string,
  provider: LocalProvider,
): SavedLocalProvider[] {
  const current = readSavedLocalProviders(parcelId);
  const exists = current.some((item) => item.placeId === provider.placeId);
  const next = exists
    ? current.filter((item) => item.placeId !== provider.placeId)
    : [
        ...current,
        {
          parcelId,
          placeId: provider.placeId,
          serviceCategory: provider.categoryId,
          userNotes: null,
          savedAt: new Date().toISOString(),
        },
      ];
  writeSavedLocalProviders(parcelId, next);
  return next;
}

function coerceSavedProvider(value: unknown, parcelId: string): SavedLocalProvider | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<SavedLocalProvider> & Partial<LocalProvider>;
  const placeId = typeof raw.placeId === "string" ? raw.placeId.trim().slice(0, 180) : "";
  if (!placeId) return null;
  const savedParcelId =
    typeof raw.parcelId === "string" && raw.parcelId.trim() ? raw.parcelId.trim() : parcelId;
  if (savedParcelId !== parcelId) return null;
  return {
    parcelId,
    placeId,
    serviceCategory:
      typeof raw.serviceCategory === "string" && raw.serviceCategory.trim()
        ? raw.serviceCategory.trim().slice(0, 80)
        : typeof raw.categoryId === "string"
          ? raw.categoryId.trim().slice(0, 80)
          : "unknown",
    userNotes: typeof raw.userNotes === "string" && raw.userNotes.trim()
      ? raw.userNotes.trim().slice(0, 500)
      : null,
    savedAt:
      typeof raw.savedAt === "string" && raw.savedAt.trim()
        ? raw.savedAt.trim().slice(0, 80)
        : new Date().toISOString(),
  };
}
