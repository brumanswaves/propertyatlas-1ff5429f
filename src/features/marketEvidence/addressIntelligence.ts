import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { AddressCandidate, MarketAddressIntelligence } from "./types";

function asRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const parsed = String(value).trim();
  return parsed || null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function googleMapsPointUrl(
  coordinates?: { lat: number; lng: number } | null,
): string | null {
  if (!coordinates) return null;
  return `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`;
}

export function parseMarketAddressIntelligence(value: unknown): MarketAddressIntelligence | null {
  if (!asRecord(value)) return null;
  const candidates = Array.isArray(value.candidates)
    ? value.candidates.filter(asRecord).map(
        (item): AddressCandidate => ({
          id: String(item.id ?? crypto.randomUUID()),
          formattedAddress: String(item.formattedAddress ?? ""),
          streetNumber: str(item.streetNumber),
          streetName: str(item.streetName),
          suburb: str(item.suburb),
          town: str(item.town),
          municipality: str(item.municipality),
          province: str(item.province),
          postalCode: str(item.postalCode),
          country: str(item.country),
          lat: num(item.lat),
          lng: num(item.lng),
          source:
            item.source === "official_parcel" ||
            item.source === "municipal_record" ||
            item.source === "google_reverse_geocode" ||
            item.source === "google_forward_geocode" ||
            item.source === "manual_google_maps_whats_here" ||
            item.source === "user_entered"
              ? item.source
              : "unknown",
          confidence:
            item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
              ? item.confidence
              : "unverified",
          reason: String(item.reason ?? "User-managed market address candidate"),
          createdAt: String(item.createdAt ?? new Date().toISOString()),
          updatedAt: str(item.updatedAt),
        }),
      )
    : [];
  return {
    selectedAddressId: str(value.selectedAddressId),
    candidates: candidates.filter((candidate) => candidate.formattedAddress),
    userConfirmedAddress: asRecord(value.userConfirmedAddress)
      ? (parseMarketAddressIntelligence({ candidates: [value.userConfirmedAddress] })
          ?.candidates[0] ?? null)
      : null,
    lastResolvedAt: str(value.lastResolvedAt),
    notes: str(value.notes),
  };
}

export function selectedMarketAddress(
  intelligence?: MarketAddressIntelligence | null,
): AddressCandidate | null {
  if (!intelligence) return null;
  if (intelligence.userConfirmedAddress) return intelligence.userConfirmedAddress;
  if (!intelligence.selectedAddressId) return null;
  return (
    intelligence.candidates.find((candidate) => candidate.id === intelligence.selectedAddressId) ??
    null
  );
}

export function marketAddressToPropertyIdentityOverride(candidate: AddressCandidate | null) {
  if (!candidate) return null;
  return {
    address: candidate.formattedAddress,
    streetName: candidate.streetName ?? null,
    marketSuburb: candidate.suburb ?? candidate.town ?? null,
    note: "Market address is used for portal matching. It does not replace official parcel data.",
    confirmedAt:
      candidate.confidence === "high" ? (candidate.updatedAt ?? candidate.createdAt) : null,
  };
}

export function buildAddressCandidate(input: {
  formattedAddress: string;
  streetNumber?: string | null;
  streetName?: string | null;
  suburb?: string | null;
  town?: string | null;
  municipality?: string | null;
  province?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: AddressCandidate["source"];
  confidence?: AddressCandidate["confidence"];
  reason?: string;
  id?: string;
}): AddressCandidate {
  const now = new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    formattedAddress: input.formattedAddress.trim(),
    streetNumber: input.streetNumber?.trim() || null,
    streetName: input.streetName?.trim() || null,
    suburb: input.suburb?.trim() || null,
    town: input.town?.trim() || null,
    municipality: input.municipality?.trim() || null,
    province: input.province?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    country: "South Africa",
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    source: input.source ?? "user_entered",
    confidence: input.confidence ?? "unverified",
    reason:
      input.reason ?? "User-entered market address for portal matching; not official parcel data.",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildInitialAddressCandidate(
  parcel: NormalizedOfficialParcel,
): AddressCandidate | null {
  const address = parcel.knownFields.find((field) =>
    /address|display title/i.test(field.label),
  )?.value;
  if (!address) return null;
  const now = new Date().toISOString();
  return {
    id: "official-parcel-address",
    formattedAddress: address,
    streetNumber: null,
    streetName: parcel.knownFields.find((field) => /street|road/i.test(field.label))?.value ?? null,
    suburb: parcel.suburbOrArea ?? null,
    town: parcel.town ?? null,
    municipality: parcel.municipality ?? null,
    province: parcel.province ?? null,
    postalCode: null,
    country: "South Africa",
    lat: parcel.coordinates?.lat ?? null,
    lng: parcel.coordinates?.lng ?? null,
    source: "official_parcel",
    confidence: "medium",
    reason: "Address-like field found on the official parcel record. Verify before relying on it.",
    createdAt: now,
  };
}

export async function reverseGeocodeAddressCandidates(
  lat: number,
  lng: number,
): Promise<AddressCandidate[]> {
  return requestAddressCandidates({ action: "reverse", latitude: lat, longitude: lng }, "google_reverse_geocode");
}

export const ADDRESS_SUGGESTION_MIN_QUERY_LENGTH = 3;

export async function forwardGeocodeAddressCandidates(
  query: string,
  options: {
    near?: { lat: number; lng: number } | null;
    signal?: AbortSignal;
    limit?: number;
  } = {},
): Promise<AddressCandidate[]> {
  const text = query.trim();
  if (text.length < ADDRESS_SUGGESTION_MIN_QUERY_LENGTH) return [];
  return requestAddressCandidates({ action: "forward", query: text, latitude: options.near?.lat, longitude: options.near?.lng, limit: options.limit }, "google_forward_geocode", options.signal);
}

interface ServerAddressCandidate {
  id: string;
  formattedAddress: string;
  streetNumber?: string | null;
  streetName?: string | null;
  suburb?: string | null;
  town?: string | null;
  municipality?: string | null;
  province?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

async function requestAddressCandidates(body: Record<string, unknown>, source: "google_forward_geocode" | "google_reverse_geocode", signal?: AbortSignal): Promise<AddressCandidate[]> {
  const response = await fetch("/api/address/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; candidates?: ServerAddressCandidate[]; error?: string } | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.error ?? "Address suggestions are temporarily unavailable.");
  return (payload.candidates ?? []).filter((candidate) => candidate.formattedAddress).map((candidate) => buildAddressCandidate({ ...candidate, source, confidence: "medium", reason: source === "google_reverse_geocode" ? "Google map suggestion from parcel coordinates. Check it before saving; it is not official parcel data." : "Google address suggestion for what you typed. Check it before saving; it is not official parcel data." }));
}
