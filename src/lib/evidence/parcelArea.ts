/**
 * Canonical parcel-area normalisation.
 *
 * One shared helper for the Property Evidence Pack and the report view model so
 * the two never drift into separate allowlists again.
 *
 * Precedence (highest first):
 *   a. verified registered extent extracted from a deed / SG diagram / paid report
 *   b. CSG `GEOM_AREA` — already square metres
 *   c. other explicit trustworthy square-metre attributes
 *   d. `Shape__Area` (ArcGIS Online shape area) only as an *approximate* fallback,
 *      because it is projected (Web-Mercator inflated) rather than ground truth
 *   e. otherwise null
 *
 * A listing land size is never an official parcel extent and is deliberately
 * absent from every tier below.
 */

export type ParcelAreaSourceKind =
  | "verified_extent"
  | "csg_geom_area"
  | "explicit_m2"
  | "shape_area_approximate";

export interface ResolvedParcelArea {
  /** Raw numeric square metres, unrounded. */
  areaM2: number;
  /** True when the value is projected/derived rather than a stated ground extent. */
  approximate: boolean;
  /** Attribute key (or claim path) the value came from. */
  sourceKey: string;
  sourceKind: ParcelAreaSourceKind;
  /** Human-readable caveat, present only for approximate values. */
  warning: string | null;
  confidence: "high" | "medium" | "low";
}

export interface VerifiedExtentInput {
  areaM2: number;
  /** Locator for the verified value, e.g. `asset:<id>#page3`. */
  sourceKey: string;
}

/** CSG cadastral ground area, already in m². */
export const CSG_GEOM_AREA_KEYS = ["GEOM_AREA", "geom_area"] as const;

/** Other explicitly-square-metre attributes published by official parcel sources. */
export const EXPLICIT_M2_KEYS = [
  "AREA_M2",
  "AREAM2",
  "area_m2",
  "SHAPE_Area",
  "shape_area",
  "AREA",
  "area",
] as const;

/** Projected shape area — approximate only. */
export const SHAPE_AREA_KEYS = ["Shape__Area", "Shape_Area", "SHAPE__AREA"] as const;

export const SHAPE_AREA_WARNING =
  "Approximate: derived from projected map geometry (Shape__Area), which can be inflated. Confirm the registered extent against the SG diagram or a deeds report.";

export const AREA_UNAVAILABLE_LABEL = "Area not available";

/** Every attribute key the canonical resolver reads, in precedence order. */
export const CANONICAL_AREA_KEYS: readonly string[] = [
  ...CSG_GEOM_AREA_KEYS,
  ...EXPLICIT_M2_KEYS,
  ...SHAPE_AREA_KEYS,
];

/**
 * Coerce a raw attribute to a usable square-metre number.
 * Non-finite, negative and zero values are never valid areas.
 */
export function toValidAreaM2(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[\s,]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function pick(
  raw: Record<string, unknown>,
  keys: readonly string[],
): { key: string; value: number } | null {
  for (const key of keys) {
    const value = toValidAreaM2(raw[key]);
    if (value != null) return { key, value };
  }
  return null;
}

/**
 * Resolve the canonical parcel extent from raw official-parcel attributes.
 * Returns null when no trustworthy area exists — callers must render
 * `AREA_UNAVAILABLE_LABEL` (never `0 m²`).
 */
export function resolveParcelArea(
  rawProperties: Record<string, unknown> | null | undefined,
  options: { verifiedExtent?: VerifiedExtentInput | null } = {},
): ResolvedParcelArea | null {
  const verified = options.verifiedExtent;
  if (verified) {
    const value = toValidAreaM2(verified.areaM2);
    if (value != null) {
      return {
        areaM2: value,
        approximate: false,
        sourceKey: verified.sourceKey,
        sourceKind: "verified_extent",
        warning: null,
        confidence: "high",
      };
    }
  }

  const raw = (rawProperties ?? {}) as Record<string, unknown>;

  const geom = pick(raw, CSG_GEOM_AREA_KEYS);
  if (geom) {
    return {
      areaM2: geom.value,
      approximate: false,
      sourceKey: geom.key,
      sourceKind: "csg_geom_area",
      warning: null,
      confidence: "high",
    };
  }

  const explicit = pick(raw, EXPLICIT_M2_KEYS);
  if (explicit) {
    return {
      areaM2: explicit.value,
      approximate: false,
      sourceKey: explicit.key,
      sourceKind: "explicit_m2",
      warning: null,
      confidence: "high",
    };
  }

  const shape = pick(raw, SHAPE_AREA_KEYS);
  if (shape) {
    return {
      areaM2: shape.value,
      approximate: true,
      sourceKey: shape.key,
      sourceKind: "shape_area_approximate",
      warning: SHAPE_AREA_WARNING,
      confidence: "low",
    };
  }

  return null;
}

/** Canonical numeric area (unrounded) or null. */
export function canonicalAreaM2(
  rawProperties: Record<string, unknown> | null | undefined,
  options: { verifiedExtent?: VerifiedExtentInput | null } = {},
): number | null {
  return resolveParcelArea(rawProperties, options)?.areaM2 ?? null;
}

/**
 * Display formatting: preserves meaningful cadastral precision up to one decimal
 * place and never emits `0`. Integer areas remain integers.
 * Returns null when there is nothing trustworthy to show.
 */
export function formatAreaM2Value(area: number | null | undefined): string | null {
  const value = toValidAreaM2(area);
  if (value == null) return null;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** Same as {@link formatAreaM2Value} but with the `m²` unit appended. */
export function formatAreaM2WithUnit(area: number | null | undefined): string | null {
  const formatted = formatAreaM2Value(area);
  return formatted ? `${formatted} m²` : null;
}

/**
 * All *stated* square-metre aliases present on the raw record (projected
 * Shape__Area excluded). Used to surface genuine disagreement between official
 * aliases without ever letting a lower-precedence alias override the canonical value.
 */
export function statedAreaAliases(
  rawProperties: Record<string, unknown> | null | undefined,
): Array<{ key: string; value: number }> {
  const raw = (rawProperties ?? {}) as Record<string, unknown>;
  const out: Array<{ key: string; value: number }> = [];
  for (const key of [...CSG_GEOM_AREA_KEYS, ...EXPLICIT_M2_KEYS]) {
    const value = toValidAreaM2(raw[key]);
    if (value != null) out.push({ key, value });
  }
  return out;
}
