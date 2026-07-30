/**
 * Free-text ("custom") local service search.
 *
 * The preset catalog categories guide the user, but they must not limit what
 * the user can look for. A custom query is sanitised, turned into a synthetic
 * `LocalServiceCategory`, and searched against the property's saved Market
 * address exactly like a preset category.
 */
import type { LocalPropertyState, LocalServiceCategory } from "./catalog";

export const MAX_CUSTOM_SERVICE_QUERY_LENGTH = 80;
export const MIN_CUSTOM_SERVICE_QUERY_LENGTH = 2;
export const CUSTOM_SERVICE_CATEGORY_PREFIX = "custom:";
const MAX_RECENT_CUSTOM_SEARCHES = 6;

/**
 * Trims, collapses whitespace, removes control/markup characters and enforces
 * a length limit. Returns `null` for blank, whitespace-only or unusable input.
 */
export function sanitizeCustomServiceQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^\p{L}\p{N}\s&'/+.,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CUSTOM_SERVICE_QUERY_LENGTH)
    .trim();
  if (cleaned.length < MIN_CUSTOM_SERVICE_QUERY_LENGTH) return null;
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return null;
  return cleaned;
}

export function isCustomServiceCategoryId(categoryId: string | null | undefined): boolean {
  return typeof categoryId === "string" && categoryId.startsWith(CUSTOM_SERVICE_CATEGORY_PREFIX);
}

export function customServiceCategoryId(query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${CUSTOM_SERVICE_CATEGORY_PREFIX}${slug}`;
}

export function customServiceLabel(query: string): string {
  return query.charAt(0).toUpperCase() + query.slice(1);
}

function pluralizeWord(word: string): string {
  if (/s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** e.g. "security company" -> "Security companies near this property". */
export function customServiceResultsHeading(query: string): string {
  const words = query.trim().split(/\s+/);
  if (words.length === 0) return "Results near this property";
  words[words.length - 1] = pluralizeWord(words[words.length - 1]);
  const phrase = words.join(" ");
  return `${phrase.charAt(0).toUpperCase() + phrase.slice(1)} near this property`;
}

const ALL_STATES: LocalPropertyState[] = ["vacant_land", "existing_home", "unknown"];

/**
 * Builds a synthetic category for a free-text query. Returns `null` when the
 * query cannot be sanitised into something searchable.
 */
export function buildCustomServiceCategory(query: unknown): LocalServiceCategory | null {
  const sanitized = sanitizeCustomServiceQuery(query);
  if (!sanitized) return null;
  const reasonText = `You searched for "${sanitized}" near this property's confirmed address.`;
  return {
    id: customServiceCategoryId(sanitized),
    groupId: "buy-sell-manage",
    label: customServiceLabel(sanitized),
    searchQuery: sanitized,
    reason: {
      vacant_land: reasonText,
      existing_home: reasonText,
      unknown: reasonText,
    },
    appliesTo: ALL_STATES,
  };
}

/** Google Maps fallback URL — always anchored to the saved property address. */
export function customServiceGoogleMapsUrl(query: string, address: string): string | null {
  const sanitized = sanitizeCustomServiceQuery(query);
  const trimmedAddress = address?.trim() ?? "";
  if (!sanitized || !trimmedAddress) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${sanitized} near ${trimmedAddress}`,
  )}`;
}

/* ------------------------------------------------------------------ */
/* Recent custom searches (per property, local only)                    */
/* ------------------------------------------------------------------ */

const RECENT_STORAGE_PREFIX = "easyerf.local-services.recent-custom.v1:";

function storageKey(parcelId: string) {
  return `${RECENT_STORAGE_PREFIX}${parcelId}`;
}

export function readRecentCustomServiceSearches(parcelId: string): string[] {
  if (typeof window === "undefined" || !parcelId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(parcelId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeCustomServiceQuery(entry))
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, MAX_RECENT_CUSTOM_SEARCHES);
  } catch {
    return [];
  }
}

export function recordRecentCustomServiceSearch(parcelId: string, query: string): string[] {
  const sanitized = sanitizeCustomServiceQuery(query);
  if (!sanitized || !parcelId) return readRecentCustomServiceSearches(parcelId);
  const next = [
    sanitized,
    ...readRecentCustomServiceSearches(parcelId).filter(
      (entry) => entry.toLowerCase() !== sanitized.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT_CUSTOM_SEARCHES);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(parcelId), JSON.stringify(next));
    } catch {
      /* storage unavailable — recent chips are a convenience only */
    }
  }
  return next;
}
