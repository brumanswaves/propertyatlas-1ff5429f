import { createFileRoute } from "@tanstack/react-router";

const MAX_REQUEST_BYTES = 2048;
const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

type AddressAction = "autocomplete" | "details" | "forward" | "reverse";

interface AddressRequestBody {
  action?: unknown;
  query?: unknown;
  placeId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  limit?: unknown;
}

export const Route = createFileRoute("/api/address/suggestions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => handleAddressSuggestionsRequest(request),
    },
  },
});

export async function handleAddressSuggestionsRequest(request: Request) {
  const rawBody = await request.text().catch(() => "");
  if (!rawBody || rawBody.length > MAX_REQUEST_BYTES) {
    return json({ success: false, code: "invalid_request", error: "Invalid address request." }, 400);
  }

  let body: AddressRequestBody;
  try {
    body = JSON.parse(rawBody) as AddressRequestBody;
  } catch {
    return json({ success: false, code: "invalid_request", error: "Invalid JSON request." }, 400);
  }

  const action = cleanAction(body.action);
  if (!action) {
    return json({ success: false, code: "invalid_action", error: "Unknown address request." }, 400);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return json({
      success: false,
      code: "places_not_configured",
      error: "Address suggestions are not configured yet. You can still enter the working address manually.",
    }, 503);
  }

  if (action === "details") return fetchPlaceDetails(body, apiKey);
  if (action === "reverse") return fetchReverseAddress(body, apiKey);
  if (action === "autocomplete") return fetchAutocomplete(body, apiKey);
  return fetchForwardAddresses(body, apiKey);
}

async function fetchAutocomplete(body: AddressRequestBody, apiKey: string) {
  const query = cleanText(body.query, 180);
  if (!query || query.length < 3) return json({ success: true, suggestions: [] });
  const response = await googleFetch(PLACES_AUTOCOMPLETE_URL, apiKey, {
    input: query,
    includedRegionCodes: ["za"],
    languageCode: "en",
    ...locationBias(body),
  }, "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat");
  if (!response.ok) return googleFailure(response);
  const payload = await response.json() as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }> };
  const suggestions = (payload.suggestions ?? []).flatMap((item) => {
    const prediction = item.placePrediction;
    const label = prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text;
    if (!prediction?.placeId || !label) return [];
    return [{ id: prediction.placeId, placeId: prediction.placeId, label, subtitle: prediction.structuredFormat?.secondaryText?.text ?? "South Africa", source: "google" }];
  });
  return json({ success: true, suggestions });
}

async function fetchPlaceDetails(body: AddressRequestBody, apiKey: string) {
  const placeId = cleanText(body.placeId, 240);
  if (!placeId || !/^[A-Za-z0-9_-]+$/.test(placeId)) {
    return json({ success: false, code: "invalid_place", error: "Invalid address selection." }, 400);
  }
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "formattedAddress,location,addressComponents" },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!response?.ok) return googleFailure(response);
  const place = await response.json();
  return json({ success: true, place: normalizePlace(place, placeId) });
}

async function fetchForwardAddresses(body: AddressRequestBody, apiKey: string) {
  const query = cleanText(body.query, 180);
  if (!query || query.length < 3) return json({ success: true, candidates: [] });
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 5);
  const response = await googleFetch(PLACES_TEXT_SEARCH_URL, apiKey, {
    textQuery: query,
    pageSize: limit,
    languageCode: "en",
    regionCode: "ZA",
    ...locationBias(body),
  }, "places.id,places.formattedAddress,places.location,places.addressComponents");
  if (!response.ok) return googleFailure(response);
  const payload = await response.json() as { places?: unknown[] };
  return json({ success: true, candidates: (payload.places ?? []).map((place, index) => normalizePlace(place, `forward-${index}`)) });
}

async function fetchReverseAddress(body: AddressRequestBody, apiKey: string) {
  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);
  if (!validCoordinates(latitude, longitude)) {
    return json({ success: false, code: "invalid_coordinates", error: "Parcel coordinates are unavailable." }, 400);
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!response?.ok) return googleFailure(response);
  const payload = await response.json() as { results?: unknown[] };
  return json({ success: true, candidates: (payload.results ?? []).slice(0, 3).map((place, index) => normalizeLegacyGeocode(place, latitude!, longitude!, index)) });
}

async function googleFetch(url: string, apiKey: string, body: Record<string, unknown>, fieldMask: string) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  }).catch(() => new Response(null, { status: 502 }));
}

function locationBias(body: AddressRequestBody) {
  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);
  if (!validCoordinates(latitude, longitude)) return {};
  return { locationBias: { circle: { center: { latitude, longitude }, radius: 35000 } } };
}

function normalizePlace(value: unknown, fallbackId: string) {
  const place = asRecord(value) ? value : {};
  const parts = Array.isArray(place.addressComponents)
    ? place.addressComponents.filter(asRecord)
    : [];
  const component = (...types: string[]) => {
    const match = parts.find(
      (part) =>
        Array.isArray(part.types) &&
        types.some((type) => (part.types as unknown[]).includes(type)),
    );
    return typeof match?.longText === "string" ? match.longText : null;
  };
  const location = asRecord(place.location) ? place.location : {};
  return {
    id: String(place.id ?? fallbackId),
    formattedAddress: String(place.formattedAddress ?? ""),
    streetNumber: component("street_number"),
    streetName: component("route"),
    suburb: component("sublocality_level_1", "sublocality", "neighborhood"),
    town: component("locality", "postal_town"),
    municipality: component("administrative_area_level_2"),
    province: component("administrative_area_level_1"),
    postalCode: component("postal_code"),
    lat: Number.isFinite(location.latitude) ? Number(location.latitude) : null,
    lng: Number.isFinite(location.longitude) ? Number(location.longitude) : null,
  };
}

function normalizeLegacyGeocode(value: unknown, lat: number, lng: number, index: number) {
  const place = asRecord(value) ? value : {};
  const addressComponents = Array.isArray(place.address_components)
    ? place.address_components.filter(asRecord).map((part) => ({
        longText: part.long_name,
        types: part.types,
      }))
    : [];
  return normalizePlace(
    {
      id: place.place_id ?? `reverse-${index}`,
      formattedAddress: place.formatted_address,
      location: { latitude: lat, longitude: lng },
      addressComponents,
    },
    `reverse-${index}`,
  );
}

function asRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanAction(value: unknown): AddressAction | null {
  return value === "autocomplete" || value === "details" || value === "forward" || value === "reverse" ? value : null;
}
function cleanText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function finiteNumber(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function validCoordinates(lat: number | null, lng: number | null) { return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180; }
function googleFailure(response: Response | null) { return json({ success: false, code: response?.status === 429 ? "places_quota" : "places_unavailable", error: "Address suggestions are temporarily unavailable. You can still enter the working address manually." }, response?.status === 429 ? 429 : 502); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
