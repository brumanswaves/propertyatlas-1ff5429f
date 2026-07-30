import { createFileRoute } from "@tanstack/react-router";
import {
  includePureServiceAreaBusinesses,
  LOCAL_SERVICE_CATEGORIES,
  localServiceSearchQueries,
  type LocalProvider,
  type LocalProviderAttribution,
  type LocalServiceCategory,
} from "@/lib/localServices/catalog";
import {
  buildCustomServiceCategory,
  isCustomServiceCategoryId,
} from "@/lib/localServices/customServiceSearch";


const DEFAULT_RADIUS_KM = 15;
const WIDE_RADIUS_KM = 35;
const MAX_RADIUS_KM = 50;
const MAX_REQUEST_BYTES = 4096;
const MAX_PROVIDERS = 3;
const GOOGLE_CANDIDATE_PAGE_SIZE = 10;
const MAX_QUERY_VARIANTS = 3;
const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours.openNow",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.types",
  "places.attributions",
].join(",");

interface SearchRequestBody {
  categoryId?: unknown;
  serviceCategory?: unknown;
  parcelId?: unknown;
  address?: unknown;
  confirmedAddress?: unknown;
  query?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  widerArea?: unknown;
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string } | string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  types?: string[];
  attributions?: unknown;
  htmlAttributions?: unknown;
}

export const Route = createFileRoute("/api/local-services/search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => handleLocalServicesSearchRequest(request),
    },
  },
});

export async function handleLocalServicesSearchRequest(request: Request) {
  const rawBody = await request.text().catch(() => "");
  if (!rawBody || rawBody.length > MAX_REQUEST_BYTES) {
    return json(
      { success: false, code: "invalid_request", error: "Invalid provider search request." },
      400,
    );
  }
  let body: SearchRequestBody;
  try {
    body = JSON.parse(rawBody) as SearchRequestBody;
  } catch {
    return json({ success: false, code: "invalid_request", error: "Invalid JSON request." }, 400);
  }

  const parcelId = cleanText(body.parcelId, 160);
  if (!parcelId) {
    return json({ success: false, code: "invalid_parcel", error: "A current parcel is required." }, 400);
  }

  const categoryId = cleanText(body.serviceCategory ?? body.categoryId, 80);
  const rawCustomQuery = cleanText(body.customQuery, 160);
  const isCustomSearch = Boolean(rawCustomQuery) || isCustomServiceCategoryId(categoryId);
  let category: LocalServiceCategory | undefined;
  if (isCustomSearch) {
    category = buildCustomServiceCategory(rawCustomQuery) ?? undefined;
    if (!category) {
      return json(
        {
          success: false,
          code: "invalid_query",
          error: "Enter the service you are looking for.",
        },
        400,
      );
    }
  } else {
    category = LOCAL_SERVICE_CATEGORIES.find((item) => item.id === categoryId);
  }
  if (!category) {
    return json({ success: false, code: "invalid_category", error: "Unknown service category." }, 400);
  }


  const address = cleanText(body.confirmedAddress ?? body.address, 240);
  if (!address) {
    return json(
      {
        success: false,
        code: "address_required",
        error: "Add the property address first.",
      },
      400,
    );
  }

  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);
  const hasCoordinates = latitude != null && longitude != null;
  const radiusKm = Math.min(body.widerArea === true ? WIDE_RADIUS_KM : DEFAULT_RADIUS_KM, MAX_RADIUS_KM);
  const serverQueries = localServiceSearchQueries(category)
    .slice(0, MAX_QUERY_VARIANTS)
    .map((query) => buildServiceQuery(query, address, hasCoordinates));
  const clientQuery = cleanText(body.query, 280);
  if (
    clientQuery &&
    !serverQueries.some((allowedQuery) => normalizeQuery(allowedQuery) === normalizeQuery(clientQuery))
  ) {
    return json(
      {
        success: false,
        code: "invalid_query",
        error: "Provider search queries must match an allowed service and the confirmed property address.",
      },
      400,
    );
  }

  if ((latitude == null) !== (longitude == null)) {
    return json(
      { success: false, code: "invalid_coordinates", error: "Both latitude and longitude are required." },
      400,
    );
  }
  if (latitude != null && (latitude < -90 || latitude > 90)) {
    return json({ success: false, code: "invalid_coordinates", error: "Latitude is invalid." }, 400);
  }
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    return json({ success: false, code: "invalid_coordinates", error: "Longitude is invalid." }, 400);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return json(
      {
        success: false,
        code: "places_not_configured",
        error: "Live Google provider results are not configured yet.",
      },
      503,
    );
  }

  const providers: LocalProvider[] = [];
  const seenPlaceIds = new Set<string>();
  const seenBusinessKeys = new Set<string>();
  let queriesAttempted = 0;
  const includeServiceAreaBusinesses = includePureServiceAreaBusinesses(category);
  const origin = hasCoordinates ? { lat: latitude, lng: longitude } : null;

  for (const textQuery of serverQueries) {
    if (providers.length >= MAX_PROVIDERS) break;
    queriesAttempted += 1;
    const result = await fetchGooglePlaces({
      apiKey,
      textQuery,
      latitude,
      longitude,
      radiusKm,
      includeServiceAreaBusinesses,
    });
    if (!result.success) return result.response;
    const nextProviders = normalizeProviders({
      places: result.places,
      categoryId: category.id,
      origin,
      radiusKm,
      fallbackQuery: textQuery,
      seenPlaceIds,
      seenBusinessKeys,
      remainingSlots: MAX_PROVIDERS - providers.length,
    });
    providers.push(...nextProviders);
  }

  return json({
    success: true,
    providers,
    attribution: "Google Maps",
    categoryId: category.id,
    parcelId,
    confirmedAddress: address,
    radiusKm,
    queriesAttempted,
    includePureServiceAreaBusinesses: includeServiceAreaBusinesses,
    cached: false,
  });
}

async function fetchGooglePlaces(input: {
  apiKey: string;
  textQuery: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  includeServiceAreaBusinesses: boolean;
}): Promise<{ success: true; places: GooglePlace[] } | { success: false; response: Response }> {
  const payload: Record<string, unknown> = {
    textQuery: input.textQuery,
    pageSize: GOOGLE_CANDIDATE_PAGE_SIZE,
    languageCode: "en",
    regionCode: "ZA",
    includePureServiceAreaBusinesses: input.includeServiceAreaBusinesses,
  };
  if (input.latitude != null && input.longitude != null) {
    payload.locationBias = {
      circle: {
        center: { latitude: input.latitude, longitude: input.longitude },
        radius: input.radiusKm * 1000,
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(GOOGLE_PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return {
      success: false,
      response: json(
        {
          success: false,
          code: timeout ? "places_timeout" : "places_unavailable",
          error: timeout
            ? "Google place results took too long to respond."
            : "Google place results are temporarily unavailable.",
        },
        502,
      ),
    };
  }

  const upstream = (await response.json().catch(() => null)) as
    | {
        places?: unknown;
        error?: { status?: string; message?: string };
      }
    | null;
  if (!response.ok) {
    const quota = upstream?.error?.status === "RESOURCE_EXHAUSTED" || response.status === 429;
    return {
      success: false,
      response: json(
        {
          success: false,
          code: quota ? "places_quota" : "places_error",
          error: quota
            ? "Google place search quota is temporarily unavailable."
            : "Google place results could not be loaded.",
        },
        response.status === 429 ? 429 : 502,
      ),
    };
  }
  if (!upstream || typeof upstream !== "object") {
    return {
      success: false,
      response: json(
        {
          success: false,
          code: "places_malformed",
          error: "Google place results could not be read.",
        },
        502,
      ),
    };
  }
  if (upstream.places == null) return { success: true, places: [] };
  if (!Array.isArray(upstream.places)) {
    return {
      success: false,
      response: json(
        {
          success: false,
          code: "places_malformed",
          error: "Google place results could not be read.",
        },
        502,
      ),
    };
  }
  return { success: true, places: upstream.places as GooglePlace[] };
}

function normalizeProviders(input: {
  places: GooglePlace[];
  categoryId: string;
  origin: { lat: number; lng: number } | null;
  radiusKm: number;
  fallbackQuery: string;
  seenPlaceIds?: Set<string>;
  seenBusinessKeys?: Set<string>;
  remainingSlots?: number;
}) {
  const seenPlaceIds = input.seenPlaceIds ?? new Set<string>();
  const seenBusinessKeys = input.seenBusinessKeys ?? new Set<string>();
  const remainingSlots = input.remainingSlots ?? MAX_PROVIDERS;
  const providers: LocalProvider[] = [];
  for (const place of input.places) {
    if (providers.length >= remainingSlots) break;
    const provider = normalizeProvider({ ...input, place });
    if (!provider) continue;
    if (seenPlaceIds.has(provider.placeId)) continue;
    const businessKey = normalizeBusinessKey(provider.name, provider.address);
    if (seenBusinessKeys.has(businessKey)) continue;
    seenPlaceIds.add(provider.placeId);
    seenBusinessKeys.add(businessKey);
    providers.push(provider);
  }
  return providers;
}

function normalizeProvider(input: {
  place: GooglePlace;
  categoryId: string;
  origin: { lat: number; lng: number } | null;
  radiusKm: number;
  fallbackQuery: string;
}): LocalProvider | null {
  const { place, categoryId, origin, radiusKm, fallbackQuery } = input;
  if (place.businessStatus === "CLOSED_PERMANENTLY") return null;
  const placeId = cleanText(place.id, 180);
  if (!placeId) return null;
  const name =
    typeof place.displayName === "string"
      ? cleanText(place.displayName, 180)
      : cleanText(place.displayName?.text, 180);
  if (!name) return null;
  if (!isRelevantPlaceType(place.types)) return null;
  const coordinates =
    typeof place.location?.latitude === "number" &&
    typeof place.location?.longitude === "number"
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null;
  const distanceKm = origin && coordinates ? haversineKm(origin, coordinates) : null;
  if (distanceKm != null && distanceKm > Math.min(radiusKm, MAX_RADIUS_KM)) return null;
  const mapsQuery = [name, place.formattedAddress, fallbackQuery].filter(Boolean).join(" ");
  return {
    placeId,
    name,
    categoryId,
    address: place.formattedAddress?.trim() || null,
    coordinates,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    phone: place.nationalPhoneNumber?.trim() || null,
    websiteUrl: place.websiteUri?.trim() || null,
    website: place.websiteUri?.trim() || null,
    googleMapsUrl:
      place.googleMapsUri?.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
    businessStatus: place.businessStatus?.trim() || null,
    openNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    distanceKm,
    source: "google",
    isSponsored: false,
    sponsorshipLabel: null,
    isEasyErfVerified: false,
    verificationStatus: null,
    verificationDate: null,
    serviceAreas: [],
    categories: [categoryId],
    attributions: normalizePlaceAttributions(place),
    leadTrackingId: null,
  };
}

function buildServiceQuery(searchQuery: string, address: string, hasCoordinates: boolean) {
  return hasCoordinates ? searchQuery : `${searchQuery} near ${localitySearchContext(address)}`;
}

function localitySearchContext(address: string) {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return address;
  const [first, ...rest] = parts;
  const firstLooksLikeStreetAddress =
    /\d/.test(first) ||
    /\b(street|road|drive|avenue|lane|close|way|crescent|harbour)\b/i.test(first);
  const localityParts = firstLooksLikeStreetAddress ? rest : parts;
  return localityParts.slice(0, 3).join(", ") || address;
}

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function normalizeQuery(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeBusinessKey(name: string, address: string | null) {
  return `${name}|${address ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isRelevantPlaceType(types: string[] | undefined) {
  if (!Array.isArray(types) || types.length === 0) return true;
  const irrelevant = new Set([
    "locality",
    "political",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "country",
    "postal_code",
    "route",
    "street_address",
  ]);
  return !types.every((type) => irrelevant.has(type));
}

function normalizePlaceAttributions(place: GooglePlace): LocalProviderAttribution[] {
  const raw = [place.attributions, place.htmlAttributions].flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : [],
  );
  const attributions: LocalProviderAttribution[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const attribution = normalizePlaceAttribution(value);
    if (!attribution) continue;
    const key = `${attribution.provider.toLowerCase()}|${attribution.providerUri ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    attributions.push(attribution);
  }
  return attributions;
}

function normalizePlaceAttribution(value: unknown): LocalProviderAttribution | null {
  if (typeof value === "string") {
    const provider = cleanText(stripHtml(value), 160);
    const providerUri = safeHttpsUrl(htmlHref(value));
    return provider ? { provider, providerUri } : null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const provider = cleanText(row.provider ?? row.displayName ?? row.authorName, 160);
  const providerUri = safeHttpsUrl(row.providerUri);
  return provider ? { provider, providerUri } : null;
}

function htmlHref(value: string) {
  return /href\s*=\s*["']([^"']+)["']/i.exec(value)?.[1] ?? null;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
