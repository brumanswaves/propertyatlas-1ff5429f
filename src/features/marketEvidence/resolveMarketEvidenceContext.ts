import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { MarketEvidenceCategory, MarketEvidenceContext } from "./types";

function field(parcel: NormalizedOfficialParcel, pattern: RegExp): string | undefined {
  const match = parcel.knownFields.find((item) => pattern.test(`${item.label} ${item.source}`));
  return match?.value?.trim() || undefined;
}

function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function detectPropertyCategory(parcel: NormalizedOfficialParcel): MarketEvidenceCategory {
  const text = [
    parcel.suburbOrArea,
    parcel.town,
    parcel.municipality,
    field(parcel, /zoning|description|property type|scheme|estate|farm/i),
    JSON.stringify(parcel.rawProperties ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(text, [/farm/, /smallholding/, /agricultural/, /portion.*farm/])) {
    return "farm_smallholding";
  }
  if (includesAny(text, [/sectional/, /scheme/, /unit\s*\d+/, /ss\s+/])) {
    return "sectional_title";
  }
  if (
    includesAny(text, [
      /estate/,
      /golf estate/,
      /beach estate/,
      /marina/,
      /village/,
      /links/,
      /river estate/,
      /wine estate/,
      /complex/,
    ])
  ) {
    return "estate_complex";
  }
  if (includesAny(text, [/vacant/, /undeveloped/, /land only/, /plot/, /stand/])) {
    return "vacant_land";
  }
  return "residential";
}

export function resolveMarketEvidenceContext(
  parcel: NormalizedOfficialParcel,
): MarketEvidenceContext {
  const address =
    field(parcel, /address|display title|street number/i) ?? field(parcel, /nearest road/i);
  const streetName = field(parcel, /street|road/i);
  const landSizeM2 =
    toNumber(field(parcel, /land size|erf size|geometry area|shape area|area/i)) ?? undefined;
  const suburb = parcel.suburbOrArea ?? field(parcel, /suburb|minor region|area/i);
  const town = parcel.town ?? field(parcel, /town|major region/i);
  const municipality = parcel.municipality ?? field(parcel, /municipality/i);
  const province = parcel.province ?? field(parcel, /province/i);
  const schemeOrEstate = field(parcel, /scheme|estate|complex|village|links/i);
  const farmNumber = field(parcel, /farm number|farm/i);
  const district = field(parcel, /district|municipality|major region/i);
  const warnings: string[] = [];

  if (!province)
    warnings.push("Province missing; market results may include duplicate place names.");
  if (!suburb && !town && !municipality) {
    warnings.push("No area context; use manual portal actions and verify results carefully.");
  } else if (!suburb) {
    warnings.push("Suburb missing; using town or municipality for broader searches.");
  }

  return {
    parcel,
    parcelId: parcel.id,
    erfNumber: parcel.erfNumber != null ? String(parcel.erfNumber) : undefined,
    portion: parcel.portion != null ? String(parcel.portion) : undefined,
    address,
    streetName,
    suburb: suburb ?? undefined,
    town: town ?? undefined,
    municipality: municipality ?? undefined,
    province: province ?? undefined,
    landSizeM2,
    lpi: parcel.lpi ?? undefined,
    parcelKey: parcel.parcelKey ?? undefined,
    coordinates: parcel.coordinates ?? undefined,
    officialSourceLabel: parcel.sourceLabel,
    marketArea: field(parcel, /market area|marketing suburb/i),
    schemeOrEstate,
    farmNumber,
    district,
    warnings,
    category: detectPropertyCategory(parcel),
  };
}

export function isKougaOrStFrancisContext(ctx: MarketEvidenceContext): boolean {
  const text = [ctx.suburb, ctx.town, ctx.municipality, ctx.province, ctx.address, ctx.streetName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /cape st francis|st francis bay|st francis|santareme|port st francis|st francis links|st francis on sea|sea vista|humansdorp|jeffreys bay|kouga/.test(
    text,
  );
}
