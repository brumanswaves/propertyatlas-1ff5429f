export type ParcelSource = "csg" | "kouga" | "demo" | "manual";

export interface OfficialParcelIdInput {
  source: ParcelSource;
  demoId?: string | null;
  layer?: string | null;
  objectId?: string | number | null;
  lpi?: string | null;
  parcelKey?: string | null;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  municipality?: string | null;
  province?: string | null;
  lng?: number | null;
  lat?: number | null;
  manualId?: string | null;
}

export interface NormalizedOfficialParcel {
  id: string;
  source: Exclude<ParcelSource, "demo">;
  sourceLabel: string;
  layer?: string;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  lpi?: string | null;
  parcelKey?: string | null;
  objectId?: string | number | null;
  municipality?: string | null;
  province?: string | null;
  suburbOrArea?: string | null;
  town?: string | null;
  coordinates?: { lng: number; lat: number } | null;
  knownFields: Array<{ label: string; value: string; source: string }>;
  missingFields: string[];
  rawProperties?: Record<string, unknown>;
}

export function normalizeParcelIdPart(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || null;
}

function normalizeCoordinate(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toFixed(6);
}

function requireParts(parts: Array<string | null>): string[] | null {
  return parts.every(Boolean) ? (parts as string[]) : null;
}

export function isDemoParcelId(id: string | null | undefined): boolean {
  return typeof id === "string" && /^parcel-\d+$/i.test(id.trim());
}

export function isOfficialParcelId(id: string | null | undefined): boolean {
  if (!id || isDemoParcelId(id)) return false;
  return /^(csg|kouga|manual|official):/.test(id.trim().toLowerCase());
}

export interface SavedOfficialParcelSearchHints {
  title?: string | null;
  erf?: string | number | null;
  portion?: string | number | null;
  municipality?: string | null;
  province?: string | null;
  lng?: string | number | null;
  lat?: string | number | null;
  zoom?: string | number | null;
}

export interface OfficialParcelReopenRequest {
  id: string;
  title?: string;
  erf?: string;
  portion?: string;
  municipality?: string;
  province?: string;
  lng?: number;
  lat?: number;
  zoom?: number;
}

export interface SavedParcelMapSearch {
  parcel?: string;
  officialParcel?: string;
  title?: string;
  erf?: string;
  portion?: string;
  municipality?: string;
  province?: string;
  lng?: string;
  lat?: string;
  zoom?: string;
}

function cleanSearchText(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function parseBoundedNumber(
  value: string | number | null | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export function buildSavedParcelMapSearch(
  parcelId: string | null | undefined,
  hints: SavedOfficialParcelSearchHints = {},
): SavedParcelMapSearch {
  if (isDemoParcelId(parcelId)) return { parcel: parcelId.trim() };
  if (isOfficialParcelId(parcelId)) {
    const search: SavedParcelMapSearch = {
      officialParcel: parcelId.trim(),
    };
    const lng = parseBoundedNumber(hints.lng, -180, 180);
    const lat = parseBoundedNumber(hints.lat, -90, 90);
    if (lng !== undefined && lat !== undefined) {
      search.lng = String(lng);
      search.lat = String(lat);
      search.zoom = String(parseBoundedNumber(hints.zoom, 1, 22) ?? 17);
    }
    const title = cleanSearchText(hints.title);
    const erf = cleanSearchText(hints.erf);
    const portion = cleanSearchText(hints.portion);
    const municipality = cleanSearchText(hints.municipality);
    const province = cleanSearchText(hints.province);
    if (title) search.title = title;
    if (erf) search.erf = erf;
    if (portion) search.portion = portion;
    if (municipality) search.municipality = municipality;
    if (province) search.province = province;
    return search;
  }
  return {};
}

export function parseOfficialParcelSearch(search: string): string | null {
  return parseOfficialParcelReopenSearch(search)?.id ?? null;
}

export function parseOfficialParcelReopenSearch(
  search: string,
): OfficialParcelReopenRequest | null {
  const params = new URLSearchParams(search);
  const officialParcel = params.get("officialParcel");
  if (!isOfficialParcelId(officialParcel)) return null;

  return {
    id: officialParcel,
    title: cleanSearchText(params.get("title")),
    erf: cleanSearchText(params.get("erf")),
    portion: cleanSearchText(params.get("portion")),
    municipality: cleanSearchText(params.get("municipality")),
    province: cleanSearchText(params.get("province")),
    lng: parseBoundedNumber(params.get("lng"), -180, 180),
    lat: parseBoundedNumber(params.get("lat"), -90, 90),
    zoom: parseBoundedNumber(params.get("zoom"), 1, 22),
  };
}

export function shouldShowOfficialParcelReopenFallback(
  search: string,
  hasSelectedOfficial: boolean,
): boolean {
  return Boolean(parseOfficialParcelSearch(search) && !hasSelectedOfficial);
}

export function buildOfficialParcelId(input: OfficialParcelIdInput): string {
  if (input.source === "demo") {
    if (input.demoId && isDemoParcelId(input.demoId)) return input.demoId;
    const normalizedDemo = normalizeParcelIdPart(input.demoId);
    return normalizedDemo ? `demo:${normalizedDemo}` : "demo:unknown";
  }

  if (input.source === "csg") {
    const lpi = normalizeParcelIdPart(input.lpi);
    if (lpi) return `csg:lpi:${lpi}`;

    const parcelKey = normalizeParcelIdPart(input.parcelKey);
    if (parcelKey) return `csg:parcel-key:${parcelKey}`;

    const erfParts = requireParts([
      normalizeParcelIdPart(input.province),
      normalizeParcelIdPart(input.municipality),
      normalizeParcelIdPart(input.erfNumber),
      normalizeParcelIdPart(input.portion ?? 0),
    ]);
    if (erfParts) return `csg:erf:${erfParts.join(":")}`;
  }

  if (input.source === "kouga") {
    const kougaParts = requireParts([
      normalizeParcelIdPart(input.layer),
      normalizeParcelIdPart(input.objectId),
    ]);
    if (kougaParts) return `kouga:${kougaParts.join(":")}`;
  }

  if (input.source === "manual") {
    const manualId = normalizeParcelIdPart(input.manualId);
    if (manualId) return `manual:${manualId}`;
  }

  const coordinateParts = requireParts([
    normalizeCoordinate(input.lng),
    normalizeCoordinate(input.lat),
  ]);
  if (coordinateParts) return `official:point:${coordinateParts.join(":")}`;

  return `${input.source}:unknown`;
}
