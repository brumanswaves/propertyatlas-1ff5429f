import type { LocalProvider } from "@/lib/localServices/catalog";

const STORAGE_PREFIX = "easyerf.local-property-team.saved";

function storageKey(parcelId: string) {
  return `${STORAGE_PREFIX}.${parcelId}`;
}

export function readSavedLocalProviders(parcelId: string): LocalProvider[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(parcelId)) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is LocalProvider =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as LocalProvider).placeId === "string" &&
            typeof (item as LocalProvider).name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function writeSavedLocalProviders(parcelId: string, providers: LocalProvider[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(parcelId), JSON.stringify(providers));
  } catch {
    // Local saving is optional. Provider search and outbound actions remain usable.
  }
}

export function toggleSavedLocalProvider(
  parcelId: string,
  provider: LocalProvider,
): LocalProvider[] {
  const current = readSavedLocalProviders(parcelId);
  const exists = current.some((item) => item.placeId === provider.placeId);
  const next = exists
    ? current.filter((item) => item.placeId !== provider.placeId)
    : [...current, provider];
  writeSavedLocalProviders(parcelId, next);
  return next;
}
