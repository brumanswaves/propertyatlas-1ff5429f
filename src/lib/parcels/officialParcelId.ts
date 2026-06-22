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
  fromSaved: boolean;
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
  fromSaved?: string;
  title?: string;
  erf?: string;
  portion?: string;
  municipality?: string;
  province?: string;
  lng?: string;
  lat?: string;
  zoom?: string;
}

export function stripWrappingQuotes(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  let text = String(value).trim();
  while (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text || undefined;
}

export const SAVED_OFFICIAL_REOPEN_SEARCH_KEYS = [
  "officialParcel",
  "fromSaved",
  "lat",
  "lng",
  "zoom",
  "title",
  "erf",
  "portion",
  "municipality",
  "province",
];

function cleanSearchText(value: string | number | null | undefined): string | undefined {
  return stripWrappingQuotes(value);
}

function parseBoundedNumber(
  value: string | number | null | undefined,
  min: number,
  max: number,
): number | undefined {
  const text = cleanSearchText(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export function buildSavedParcelMapSearch(
  parcelId: string | null | undefined,
  hints: SavedOfficialParcelSearchHints = {},
): SavedParcelMapSearch {
  const cleanedParcelId = cleanSearchText(parcelId);
  if (isDemoParcelId(cleanedParcelId)) return { parcel: cleanedParcelId };
  if (isOfficialParcelId(cleanedParcelId)) {
    const search: SavedParcelMapSearch = {
      officialParcel: cleanedParcelId,
      fromSaved: "1",
    };
    const lng = parseBoundedNumber(hints.lng, -180, 180);
    const lat = parseBoundedNumber(hints.lat, -90, 90);
    if (lng !== undefined && lat !== undefined) {
      search.lng = String(lng);
      search.lat = String(lat);
      search.zoom = String(parseBoundedNumber(hints.zoom, 1, 22) ?? 18);
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

export function buildOfficialParcelSearchParams(
  parcelId: string | null | undefined,
  hints: SavedOfficialParcelSearchHints = {},
): string {
  const search = buildSavedParcelMapSearch(parcelId, hints);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  return params.toString();
}

export function buildSavedParcelMapHref(
  parcelId: string | null | undefined,
  hints: SavedOfficialParcelSearchHints = {},
): string {
  const params = buildOfficialParcelSearchParams(parcelId, hints);
  return params ? `/?${params}` : "/";
}

export function parseOfficialParcelSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const officialParcel = cleanSearchText(params.get("officialParcel"));
  return officialParcel && isOfficialParcelId(officialParcel) ? officialParcel : null;
}

export function parseOfficialParcelReopenSearch(
  search: string,
): OfficialParcelReopenRequest | null {
  const params = new URLSearchParams(search);
  const fromSaved = cleanSearchText(params.get("fromSaved")) === "1";
  const officialParcel = cleanSearchText(params.get("officialParcel"));
  if (!fromSaved || !officialParcel || !isOfficialParcelId(officialParcel)) return null;

  return {
    id: officialParcel,
    fromSaved,
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

export function clearSavedOfficialReopenSearch(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of SAVED_OFFICIAL_REOPEN_SEARCH_KEYS) params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function shouldShowOfficialParcelReopenFallback(
  search: string,
  hasSelectedOfficial: boolean,
): boolean {
  return Boolean(parseOfficialParcelReopenSearch(search) && !hasSelectedOfficial);
}

export type OfficialFeatureLayer = "csg-parcels" | "kouga-zoning";

const CSG_LPI_KEYS = ["ID", "LPI", "LPI_CODE", "TWENTYONE_DIGIT", "TWENTYONE_DIGIT_CODE"];
const CSG_PARCEL_KEY_KEYS = ["PRCL_KEY", "PARCEL_KEY", "PRCLKEY"];
const CSG_ERF_KEYS = ["PARCEL_NO", "TAG_VALUE", "ERF_NO", "ERF", "ERF_NUMBER"];
const CSG_PORTION_KEYS = ["PORTION", "PORTION_NO", "PTN", "PTN_NO"];
const CSG_CONTEXT_KEYS = [
  "PROVINCE",
  "PROV_NAME",
  "MAJ_REGION",
  "MAJOR_REGION",
  "MIN_REGION",
  "MINOR_REGION",
  "MUNICIPALITY",
  "MUNIC_NAME",
  "propertyatlas_source",
];
const KOUGA_OBJECT_ID_KEYS = ["OBJECTID", "ObjectID", "objectid", "FID", "fid", "ID", "id"];

export interface OfficialFeatureIdentity {
  layer: OfficialFeatureLayer;
  lpi?: string | null;
  parcelKey?: string | null;
  erfNumber?: string | null;
  portion?: string | null;
  municipality?: string | null;
  province?: string | null;
  objectId?: string | null;
}

function firstPropertyValue(
  properties: Record<string, unknown> | null | undefined,
  keys: string[],
): string | number | null {
  if (!properties) return null;
  for (const key of keys) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value as string | number;
    }
  }
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(properties)) {
    if (
      normalizedKeys.has(key.toLowerCase()) &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value as string | number;
    }
  }
  return null;
}

function normalizedPropertyValue(
  properties: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  return normalizeParcelIdPart(firstPropertyValue(properties, keys));
}

function normalizedTail(id: string, prefix: string): string | null {
  const normalized = id.trim().toLowerCase();
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : null;
}

function contextMatchesRequestedPlace(
  properties: Record<string, unknown> | null | undefined,
  requestedProvince: string,
  requestedMunicipality: string,
): boolean {
  if (!properties) return false;
  const contextParts = CSG_CONTEXT_KEYS.flatMap((key) => {
    const value = firstPropertyValue(properties, [key]);
    return value === null || value === undefined ? [] : [String(value)];
  });
  const context = contextParts
    .map((part) => normalizeParcelIdPart(part))
    .filter(Boolean)
    .join(" ");

  if (!context) return false;

  const provinceOk = context.includes(requestedProvince);
  const municipalityOk =
    context.includes(requestedMunicipality) ||
    (requestedMunicipality.includes("kouga") && context.includes("kouga"));

  return provinceOk && municipalityOk;
}

export function extractOfficialFeatureIdentity(
  layer: OfficialFeatureLayer,
  properties: Record<string, unknown> | null | undefined,
): OfficialFeatureIdentity {
  return {
    layer,
    lpi: normalizedPropertyValue(properties, CSG_LPI_KEYS),
    parcelKey: normalizedPropertyValue(properties, CSG_PARCEL_KEY_KEYS),
    erfNumber: normalizedPropertyValue(properties, CSG_ERF_KEYS),
    portion: normalizedPropertyValue(properties, CSG_PORTION_KEYS),
    municipality: normalizedPropertyValue(properties, ["MUNICIPALITY", "MUNIC_NAME", "MAJ_REGION"]),
    province: normalizedPropertyValue(properties, ["PROVINCE", "PROV_NAME"]),
    objectId: normalizedPropertyValue(properties, KOUGA_OBJECT_ID_KEYS),
  };
}

export function officialFeatureMatchesSavedParcelId(
  officialParcelId: string | null | undefined,
  layer: OfficialFeatureLayer,
  properties: Record<string, unknown> | null | undefined,
): boolean {
  if (!officialParcelId || !isOfficialParcelId(officialParcelId)) return false;
  const normalizedId = officialParcelId.trim().toLowerCase();
  const identity = extractOfficialFeatureIdentity(layer, properties);

  if (layer === "csg-parcels") {
    const lpiTail = normalizedTail(normalizedId, "csg:lpi:");
    if (lpiTail) return identity.lpi === lpiTail;

    const parcelKeyTail = normalizedTail(normalizedId, "csg:parcel-key:");
    if (parcelKeyTail) return identity.parcelKey === parcelKeyTail;

    if (normalizedId.startsWith("csg:erf:")) {
      const [, , requestedProvince, requestedMunicipality, requestedErf, requestedPortion] =
        normalizedId.split(":");
      if (!requestedProvince || !requestedMunicipality || !requestedErf || !requestedPortion) {
        return false;
      }
      return (
        identity.erfNumber === requestedErf &&
        (identity.portion ?? "0") === requestedPortion &&
        contextMatchesRequestedPlace(properties, requestedProvince, requestedMunicipality)
      );
    }
  }

  if (layer === "kouga-zoning" && normalizedId.startsWith("kouga:")) {
    const [, requestedLayer, requestedObjectId] = normalizedId.split(":");
    if (!requestedLayer || !requestedObjectId) return false;
    const layerOk = normalizeParcelIdPart(layer) === requestedLayer;
    return layerOk && identity.objectId === requestedObjectId;
  }

  return false;
}

export function isOfficialPointParcelId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim().toLowerCase().startsWith("official:point:");
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
