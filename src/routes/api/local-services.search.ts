import { createFileRoute } from "@tanstack/react-router";
import {
  LOCAL_SERVICE_CATEGORIES,
  type LocalProvider,
} from "@/lib/localServices/catalog";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RADIUS_KM = 15;
const WIDE_RADIUS_KM = 35;
const MAX_RADIUS_KM = 50;
const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
].join(",");

interface SearchRequestBody {
  categoryId?: unknown;
  parcelId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  suburb?: unknown;
  town?: unknown;
  municipality?: unknown;
  province?: unknown;
  widerArea?: unknown;
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string } | string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

interface CacheEntry {
  expiresAt: number;
  providers: LocalProvider[];
}

const globalCache = globalThis as typeof globalThis & {
  __easyErfLocalServicesCache?: Map<string, CacheEntry>;
};
const cache =
  globalCache.__easyErfLocalServicesCache ??
  (globalCache.__easyErfLocalServicesCache = new Map<string, CacheEntry>());

export const Route = createFileRoute("/api/local-services/search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => handleLocalServicesSearchRequest(request),
    },
  },
});

export async function handleLocalServicesSearchRequest(request: Request) {
  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return json({ success: false, code: "invalid_request", error: "Invalid JSON request." }, 400);
  }

  const categoryId = cleanText(body.categoryId);
  const category = LOCAL_SERVICE_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) {
    return json({ success: false, code: "invalid_category", error: "Unknown service category." }, 400);
  }

  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);
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
        error: "Live Google place results are not configured yet.",
      },
      503,
    );
  }

  const widerArea = body.widerArea === true;
  const radiusKm = Math.min(widerArea ? WIDE_RADIUS_KM : DEFAULT_RADIUS_KM, MAX_RADIUS_KM);
  const location = uniqueLocation([
    cleanText(body.suburb),
    cleanText(body.town),
    cleanText(body.municipality),
    cleanText(body.province),
    "South Africa",
  ]);
  const textQuery = [category.searchQuery, location ? `near ${location}` : null]
    .filter(Boolean)
    .join(" ");
  const cacheKey = [
    category.id,
    latitude == null ? "no-lat" : latitude.toFixed(3),
    longitude == null ? "no-lng" : longitude.toFixed(3),
    location.toLowerCase(),
    radiusKm,
  ].join("|");

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return json({
      success: true,
      providers: cached.providers,
      categoryId: category.id,
      radiusKm,
      cached: true,
    });
  }
  if (cached) cache.delete(cacheKey);

  const payload: Record<string, unknown> = {
    textQuery,
    pageSize: 3,
    languageCode: "en",
    regionCode: "ZA",
  };
  if (latitude != null && longitude != null) {
    payload.locationBias = {
      circle: {
        center: { latitude, longitude },
        radius: radiusKm * 1000,
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(GOOGLE_PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return json(
      {
        success: false,
        code: timeout ? "places_timeout" : "places_unavailable",
        error: timeout
          ? "Google place results took too long to respond."
          : "Google place results are temporarily unavailable.",
      },
      502,
    );
  }

  const upstream = (await response.json().catch(() => null)) as
    | { places?: GooglePlace[]; error?: { status?: string; message?: string } }
    | null;
  if (!response.ok) {
    const quota = upstream?.error?.status === "RESOURCE_EXHAUSTED" || response.status === 429;
    return json(
      {
        success: false,
        code: quota ? "places_quota" : "places_error",
        error: quota
          ? "Google place search quota is temporarily unavailable."
          : "Google place results could not be loaded.",
      },
      response.status === 429 ? 429 : 502,
    );
  }

  const providers = (upstream?.places ?? [])
    .filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY")
    .slice(0, 3)
    .map((place, index) =>
      normalizeProvider({
        place,
        categoryId: category.id,
        index,
        origin:
          latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null,
        fallbackQuery: textQuery,
      }),
    );

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, providers });
  return json({
    success: true,
    providers,
    categoryId: category.id,
    radiusKm,
    cached: false,
  });
}

function normalizeProvider(input: {
  place: GooglePlace;
  categoryId: string;
  index: number;
  origin: { lat: number; lng: number } | null;
  fallbackQuery: string;
}): LocalProvider {
  const { place, categoryId, index, origin, fallbackQuery } = input;
  const coordinates =
    typeof place.location?.latitude === "number" &&
    typeof place.location?.longitude === "number"
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null;
  const name =
    typeof place.displayName === "string"
      ? place.displayName
      : place.displayName?.text?.trim() || "Google place result";
  const mapsQuery = [name, place.formattedAddress, fallbackQuery].filter(Boolean).join(" ");
  return {
    placeId: place.id?.trim() || `${categoryId}-${index}-${name}`,
    name,
    categoryId,
    address: place.formattedAddress?.trim() || null,
    coordinates,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    phone: place.nationalPhoneNumber?.trim() || null,
    websiteUrl: place.websiteUri?.trim() || null,
    googleMapsUrl:
      place.googleMapsUri?.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
    businessStatus: place.businessStatus?.trim() || null,
    distanceKm: origin && coordinates ? haversineKm(origin, coordinates) : null,
    source: "google",
    isSponsored: false,
    sponsorshipLabel: null,
    isEasyErfVerified: false,
    verificationStatus: null,
    verificationDate: null,
    serviceAreas: [],
    categories: [categoryId],
    leadTrackingId: null,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueLocation(parts: string[]) {
  return parts.filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", ");
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
