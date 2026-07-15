import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { SitePotentialProject } from "./types";

export interface SitePotentialParcelContext {
  parcelId: string;
  sourceLabel: string;
  erfNumber: string | number | null;
  portion: string | number | null;
  lpi: string | null;
  parcelKey: string | null;
  municipality: string | null;
  province: string | null;
  suburbOrArea: string | null;
  town: string | null;
  coordinates: { lng: number; lat: number } | null;
  knownFields: Array<{ label: string; value: string; source: string }>;
  sourceAttributes: Record<string, string | number | boolean | null>;
  capturedAt: string;
}

function primitiveSourceAttributes(raw: Record<string, unknown> | undefined) {
  const entries = Object.entries(raw ?? {})
    .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 60);
  return Object.fromEntries(entries) as Record<string, string | number | boolean | null>;
}

export function buildSitePotentialParcelContext(
  parcel: NormalizedOfficialParcel,
): SitePotentialParcelContext {
  return {
    parcelId: parcel.id,
    sourceLabel: parcel.sourceLabel,
    erfNumber: parcel.erfNumber ?? null,
    portion: parcel.portion ?? null,
    lpi: parcel.lpi ?? null,
    parcelKey: parcel.parcelKey ?? null,
    municipality: parcel.municipality ?? null,
    province: parcel.province ?? null,
    suburbOrArea: parcel.suburbOrArea ?? null,
    town: parcel.town ?? null,
    coordinates: parcel.coordinates ?? null,
    knownFields: parcel.knownFields.slice(0, 40),
    sourceAttributes: primitiveSourceAttributes(parcel.rawProperties),
    capturedAt: new Date().toISOString(),
  };
}

export function sitePotentialParcelContextFromProject(
  project: Pick<SitePotentialProject, "parcel_id" | "metadata">,
): SitePotentialParcelContext | null {
  const value = project.metadata?.parcelContext;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const coordinates = row.coordinates as Record<string, unknown> | null | undefined;
  const lng = Number(coordinates?.lng);
  const lat = Number(coordinates?.lat);
  return {
    parcelId: typeof row.parcelId === "string" ? row.parcelId : project.parcel_id,
    sourceLabel: typeof row.sourceLabel === "string" ? row.sourceLabel : "Official parcel source",
    erfNumber:
      typeof row.erfNumber === "string" || typeof row.erfNumber === "number" ? row.erfNumber : null,
    portion:
      typeof row.portion === "string" || typeof row.portion === "number" ? row.portion : null,
    lpi: typeof row.lpi === "string" ? row.lpi : null,
    parcelKey: typeof row.parcelKey === "string" ? row.parcelKey : null,
    municipality: typeof row.municipality === "string" ? row.municipality : null,
    province: typeof row.province === "string" ? row.province : null,
    suburbOrArea: typeof row.suburbOrArea === "string" ? row.suburbOrArea : null,
    town: typeof row.town === "string" ? row.town : null,
    coordinates: Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null,
    knownFields: Array.isArray(row.knownFields)
      ? row.knownFields
          .filter((item) => item && typeof item === "object")
          .slice(0, 40)
          .map((item) => {
            const field = item as Record<string, unknown>;
            return {
              label: String(field.label ?? "Field"),
              value: String(field.value ?? ""),
              source: String(field.source ?? "Official source"),
            };
          })
      : [],
    sourceAttributes:
      row.sourceAttributes &&
      typeof row.sourceAttributes === "object" &&
      !Array.isArray(row.sourceAttributes)
        ? (row.sourceAttributes as Record<string, string | number | boolean | null>)
        : {},
    capturedAt: typeof row.capturedAt === "string" ? row.capturedAt : new Date(0).toISOString(),
  };
}

export function describeSitePotentialParcelContext(context: SitePotentialParcelContext | null) {
  if (!context) return "The exact site context is not available; avoid claiming exact placement.";
  const parts = [
    context.erfNumber != null ? `Erf ${context.erfNumber}` : null,
    context.portion != null ? `portion ${context.portion}` : null,
    context.suburbOrArea,
    context.town,
    context.municipality,
    context.province,
    context.coordinates
      ? `coordinates ${context.coordinates.lat.toFixed(6)}, ${context.coordinates.lng.toFixed(6)}`
      : null,
  ].filter(Boolean);
  const importantFields = context.knownFields
    .filter((field) =>
      /(area|size|zoning|height|coverage|bulk|setback|street|address|region|slope|contour)/i.test(
        field.label,
      ),
    )
    .slice(0, 12)
    .map((field) => `${field.label}: ${field.value} (${field.source})`);
  return [parts.join(", "), ...importantFields].filter(Boolean).join(". ");
}
