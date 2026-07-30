/**
 * Site / Environmental risk, Municipal services & ownership costs, and
 * Location & lifestyle report section models.
 *
 * Every fact is read from the canonical evidence pack. Rules that must never
 * be broken here:
 *  - opening or reviewing a portal is not a finding
 *  - unknown stays unknown, and is never rendered as a clearance
 *  - no distance, travel time, service charge or amount is ever invented
 *  - a zero or negative money amount is treated as unknown, never shown as R0
 */
import type {
  EvidenceClaim,
  EvidenceDomain,
  PropertyEvidencePack,
} from "@/lib/evidence/propertyEvidenceTypes";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";

export type ContextFactSource = "official" | "document" | "listing" | "user_confirmed" | "unknown";

export const CONTEXT_SOURCE_LABEL: Record<ContextFactSource, string> = {
  official: "Official / map-derived",
  document: "Read from a matched document",
  listing: "Listing-derived",
  user_confirmed: "User supplied",
  unknown: "Not established",
};

export interface ContextFact {
  id: string;
  label: string;
  /** Null means unknown. It is never replaced by a default or a clearance. */
  value: string | null;
  source: ContextFactSource;
  provenance: string;
  caveat?: string | null;
}

export interface ContextMissingCheck {
  id: string;
  label: string;
  action: string;
}

export interface ContextSectionModel {
  facts: ContextFact[];
  supportedCount: number;
  headline: string;
  headlineDetail: string;
  missingChecks: ContextMissingCheck[];
  note: string;
  nextStep: string | null;
  nextStepTab: string | null;
}

export interface MunicipalSectionModel extends ContextSectionModel {
  /** Only present when actual monthly inputs were read from evidence. */
  monthlyEstimate: { value: string; basis: string } | null;
}

/* ------------------------------------------------------------------ helpers */

function supportedClaims(
  pack: PropertyEvidencePack | null,
  domain: EvidenceDomain,
  keys: string[],
): EvidenceClaim[] {
  if (!pack) return [];
  return pack.claims.filter(
    (claim) =>
      claim.domain === domain &&
      keys.includes(claim.key) &&
      !claim.excluded &&
      claim.status !== "missing" &&
      claim.status !== "excluded" &&
      claim.value != null &&
      String(claim.value).trim() !== "",
  );
}

function firstClaim(
  pack: PropertyEvidencePack | null,
  domains: EvidenceDomain[],
  keys: string[],
): EvidenceClaim | null {
  for (const domain of domains) {
    const [claim] = supportedClaims(pack, domain, keys);
    if (claim) return claim;
  }
  return null;
}

function provenanceFor(claim: EvidenceClaim): string {
  const sources = claim.sourceIds.length ? claim.sourceIds.join(", ") : "an evidence source";
  const page = claim.locators.find((locator) => typeof locator.pageNumber === "number");
  return `Read from ${sources}${page ? ` · page ${page.pageNumber}` : ""} · confidence ${claim.confidence}`;
}

function fromClaim(
  id: string,
  label: string,
  claim: EvidenceClaim | null,
  unknownProvenance: string,
): ContextFact {
  if (!claim) {
    return { id, label, value: null, source: "unknown", provenance: unknownProvenance };
  }
  return {
    id,
    label,
    value: String(claim.value),
    source: claim.userConfirmed ? "user_confirmed" : "document",
    provenance: provenanceFor(claim),
  };
}

function moneyFromClaim(claim: EvidenceClaim | null): number | null {
  if (!claim) return null;
  const raw =
    typeof claim.normalizedValue === "number"
      ? claim.normalizedValue
      : typeof claim.value === "number"
        ? claim.value
        : typeof claim.value === "string"
          ? Number(claim.value.replace(/[^0-9.]/g, ""))
          : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function formatZar(value: number): string {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function isMonthlyClaim(claim: EvidenceClaim): boolean {
  const text = `${claim.label} ${claim.unit ?? ""} ${String(claim.value)}`.toLowerCase();
  return /per month|monthly|\bp\/?m\b|\/month/.test(text);
}

function countSupported(facts: ContextFact[]): number {
  return facts.filter((fact) => fact.value !== null).length;
}

/* ------------------------------------------------------- site & environment */

const SITE_FACT_SPECS: Array<{
  id: string;
  label: string;
  domains: EvidenceDomain[];
  keys: string[];
  unknown: string;
}> = [
  {
    id: "slope",
    label: "Slope / topography",
    domains: ["environment", "site"],
    keys: ["slope", "topography", "gradient", "geotechnicalNote"],
    unknown: "No topographical survey or geotechnical note has been read for this erf.",
  },
  {
    id: "access",
    label: "Physical access",
    domains: ["infrastructure", "environment"],
    keys: ["roadAccess", "access", "accessRoad"],
    unknown: "No document states how this erf is physically accessed.",
  },
  {
    id: "orientation",
    label: "Orientation / aspect",
    domains: ["environment", "site"],
    keys: ["orientation", "aspect", "solarOrientation"],
    unknown: "Orientation has not been recorded from a diagram or site assessment.",
  },
  {
    id: "wind",
    label: "Wind exposure",
    domains: ["environment"],
    keys: ["windExposure", "wind", "exposure"],
    unknown: "Wind exposure has not been assessed or recorded for this erf.",
  },
  {
    id: "drainage",
    label: "Drainage / stormwater",
    domains: ["environment", "infrastructure"],
    keys: ["drainage", "stormwater", "stormwaterServitude"],
    unknown: "No drainage or stormwater information has been read for this erf.",
  },
  {
    id: "flood",
    label: "Flood risk",
    domains: ["environment"],
    keys: ["floodRisk", "floodLine", "flood"],
    unknown: "No flood-line or flood-risk determination has been obtained.",
  },
  {
    id: "coastal",
    label: "Coastal / setback status",
    domains: ["environment"],
    keys: ["coastalSetback", "coastalManagementLine", "coastal"],
    unknown: "No coastal management line or setback determination has been obtained.",
  },
  {
    id: "environmental",
    label: "Biodiversity, wetlands & protected areas",
    domains: ["environment"],
    keys: ["biodiversity", "wetland", "protectedArea", "environmentalStatus", "cba"],
    unknown: "No environmental screening result has been recorded for this erf.",
  },
  {
    id: "heritage",
    label: "Heritage status",
    domains: ["environment"],
    keys: ["heritageStatus", "heritage"],
    unknown: "Heritage status has not been confirmed with the heritage authority.",
  },
];

/** Constraint precedence — used only to order what evidence already states. */
const SITE_CONSTRAINT_ORDER = [
  "flood",
  "coastal",
  "environmental",
  "slope",
  "drainage",
  "heritage",
  "access",
  "wind",
  "orientation",
];

const SITE_SPECIALIST_CHECKS: ContextMissingCheck[] = [
  {
    id: "flood-line",
    label: "Flood-line and stormwater determination",
    action: "Request the municipal flood-line determination or commission a civil engineer.",
  },
  {
    id: "geotech",
    label: "Geotechnical and slope assessment",
    action: "Commission a geotechnical report before assuming the site is buildable as-is.",
  },
  {
    id: "environmental-screening",
    label: "Environmental screening",
    action:
      "Run a national environmental screening report to test biodiversity, wetland and protected-area triggers.",
  },
  {
    id: "coastal",
    label: "Coastal management line check",
    action: "Confirm the coastal management line and setback with the provincial authority.",
  },
];

export function buildSiteRiskSectionModel(input: {
  pack: PropertyEvidencePack | null;
}): ContextSectionModel {
  const { pack } = input;
  const facts = SITE_FACT_SPECS.map((spec) =>
    fromClaim(spec.id, spec.label, firstClaim(pack, spec.domains, spec.keys), spec.unknown),
  );
  const supported = facts.filter((fact) => fact.value !== null);
  const ranked = SITE_CONSTRAINT_ORDER.map((id) => supported.find((fact) => fact.id === id)).filter(
    Boolean,
  ) as ContextFact[];
  const top = ranked[0] ?? null;
  const unknownIds = new Set(facts.filter((fact) => fact.value === null).map((fact) => fact.id));
  const missingChecks = SITE_SPECIALIST_CHECKS.filter((check) => {
    if (check.id === "flood-line") return unknownIds.has("flood") || unknownIds.has("drainage");
    if (check.id === "geotech") return unknownIds.has("slope");
    if (check.id === "environmental-screening") return unknownIds.has("environmental");
    return unknownIds.has("coastal");
  });

  return {
    facts,
    supportedCount: supported.length,
    headline: top
      ? `Highest recorded physical constraint: ${top.label}`
      : "No physical constraint has been established from evidence",
    headlineDetail: top
      ? `${top.value} — stated by the evidence, not interpreted by Easy Erf.`
      : "Nothing has been read that describes slope, flooding, drainage, coastal setbacks or environmental status for this erf.",
    missingChecks,
    note: "Unknown is not the same as cleared. Easy Erf never marks a physical or environmental check as clear because evidence is missing, and opening a portal is not a finding.",
    nextStep: missingChecks.length
      ? "Add specialist reports or official determinations to the Erf File"
      : null,
    nextStepTab: missingChecks.length ? "reports" : null,
  };
}

/* ------------------------------------------- municipal services & ownership */

const SERVICE_FACT_SPECS: Array<{
  id: string;
  label: string;
  domains: EvidenceDomain[];
  keys: string[];
  unknown: string;
  money?: boolean;
}> = [
  {
    id: "municipal-valuation",
    label: "Municipal valuation",
    domains: ["valuation"],
    keys: ["municipalValue"],
    unknown: "No municipal roll value has been read from an identity-matched document.",
    money: true,
  },
  {
    id: "rates",
    label: "Rates",
    domains: ["valuation"],
    keys: ["ratesAmount", "rates"],
    unknown: "No rates amount has been read from a municipal account or report.",
    money: true,
  },
  {
    id: "levies",
    label: "Levies",
    domains: ["valuation", "infrastructure"],
    keys: ["levies", "levyAmount", "hoaLevy"],
    unknown: "No levy amount has been read. Estate or sectional-title levies may still apply.",
    money: true,
  },
  {
    id: "water",
    label: "Water",
    domains: ["infrastructure"],
    keys: ["waterConnection", "water"],
    unknown: "No water connection status has been confirmed with the municipality.",
  },
  {
    id: "sewer",
    label: "Sewer / septic",
    domains: ["infrastructure"],
    keys: ["sewerConnection", "sewer", "septic"],
    unknown: "No sewer or septic arrangement has been confirmed for this erf.",
  },
  {
    id: "electricity",
    label: "Electricity",
    domains: ["infrastructure"],
    keys: ["electricityConnection", "electricity"],
    unknown: "No electricity connection or supply authority has been confirmed.",
  },
  {
    id: "refuse",
    label: "Refuse",
    domains: ["infrastructure"],
    keys: ["refuse", "refuseCollection", "wasteRemoval"],
    unknown: "No refuse service has been confirmed for this erf.",
  },
  {
    id: "road-access",
    label: "Road access",
    domains: ["infrastructure"],
    keys: ["roadAccess", "accessRoad"],
    unknown: "No document states the road access or road surface for this erf.",
  },
  {
    id: "account-status",
    label: "Account status / arrears",
    domains: ["infrastructure", "valuation"],
    keys: ["accountStatus", "arrears", "municipalAccountStatus"],
    unknown: "No municipal account statement has been supplied, so arrears are unknown.",
  },
];

export function buildMunicipalServicesSectionModel(input: {
  pack: PropertyEvidencePack | null;
}): MunicipalSectionModel {
  const { pack } = input;

  const facts: ContextFact[] = SERVICE_FACT_SPECS.map((spec) => {
    const claim = firstClaim(pack, spec.domains, spec.keys);
    if (spec.money) {
      const amount = moneyFromClaim(claim);
      if (!claim || amount === null) {
        return {
          id: spec.id,
          label: spec.label,
          value: null,
          source: "unknown" as const,
          provenance: spec.unknown,
        };
      }
      return {
        id: spec.id,
        label: spec.label,
        value: formatZar(amount),
        source: "document" as const,
        provenance: provenanceFor(claim),
        caveat:
          spec.id === "municipal-valuation"
            ? "Municipal roll value for rating purposes, not a market valuation."
            : isMonthlyClaim(claim)
              ? "Stated as a monthly amount."
              : "Billing period is not stated on the source, so this is shown exactly as read.",
      };
    }
    return fromClaim(spec.id, spec.label, claim, spec.unknown);
  });

  // Monthly estimate only from amounts the source itself states as monthly.
  const monthlyClaims = SERVICE_FACT_SPECS.filter(
    (spec) => spec.money && spec.id !== "municipal-valuation",
  )
    .map((spec) => ({ spec, claim: firstClaim(pack, spec.domains, spec.keys) }))
    .filter(
      (entry) => entry.claim && isMonthlyClaim(entry.claim) && moneyFromClaim(entry.claim) !== null,
    );

  const monthlyTotal = monthlyClaims.reduce(
    (total, entry) => total + (moneyFromClaim(entry.claim) ?? 0),
    0,
  );

  const missingChecks: ContextMissingCheck[] = facts
    .filter((fact) => fact.value === null)
    .map((fact) => ({
      id: `missing-${fact.id}`,
      label: fact.label,
      action:
        fact.id === "account-status"
          ? "Request a municipal account statement or rates clearance figures."
          : fact.id === "municipal-valuation" || fact.id === "rates"
            ? "Request the municipal valuation roll entry and current rates account."
            : "Confirm this service directly with the municipality or service authority.",
    }));

  const supportedCount = countSupported(facts);

  return {
    facts,
    supportedCount,
    headline: supportedCount
      ? `${supportedCount} of ${facts.length} ownership-cost items supported by evidence`
      : "No ownership-cost item is supported by evidence yet",
    headlineDetail:
      "Rates, levies and service charges change the true cost of holding this erf. Only amounts read from an identity-matched document are shown.",
    missingChecks,
    note: "Easy Erf never shows R0 for an unknown amount and never estimates a charge that no document states.",
    monthlyEstimate: monthlyClaims.length
      ? {
          value: formatZar(monthlyTotal),
          basis: `Sum of ${monthlyClaims.length} amount(s) the source itself states as monthly: ${monthlyClaims
            .map((entry) => entry.spec.label)
            .join(
              ", ",
            )}. Items with no supported monthly amount are excluded, so this is a partial figure.`,
        }
      : null,
    nextStep: missingChecks.length ? "Add municipal account or service evidence" : null,
    nextStepTab: missingChecks.length ? "reports" : null,
  };
}

/* -------------------------------------------------------- location & lifestyle */

const LOCATION_DISTANCE_SPECS: Array<{ id: string; label: string; keys: string[] }> = [
  { id: "beach", label: "Beach / coastline", keys: ["distanceToBeach", "beachDistance"] },
  { id: "town", label: "Town centre", keys: ["distanceToTown", "townDistance"] },
  { id: "shops", label: "Shops", keys: ["distanceToShops", "shopsDistance"] },
  { id: "schools", label: "Schools", keys: ["distanceToSchools", "schoolsDistance"] },
  { id: "medical", label: "Medical facilities", keys: ["distanceToMedical", "medicalDistance"] },
];

export function buildLocationLifestyleSectionModel(input: {
  pack: PropertyEvidencePack | null;
  identity: {
    marketAddressLine: string | null;
    municipality: string | null;
    province: string | null;
    coordinates: { lng: number; lat: number } | null;
  };
  subjectListing: SavedMarketEvidence | null;
}): ContextSectionModel {
  const { pack, identity, subjectListing } = input;
  const facts: ContextFact[] = [];

  facts.push(
    identity.marketAddressLine
      ? {
          id: "address",
          label: "Confirmed address",
          value: identity.marketAddressLine,
          source: "user_confirmed",
          provenance: "Address confirmed by you against the official parcel.",
        }
      : {
          id: "address",
          label: "Confirmed address",
          value: null,
          source: "unknown",
          provenance: "No street address has been confirmed for this erf yet.",
        },
  );

  const areaLine = [identity.municipality, identity.province].filter(Boolean).join(" · ");
  facts.push({
    id: "area",
    label: "Municipality & province",
    value: areaLine || null,
    source: areaLine ? "official" : "unknown",
    provenance: areaLine
      ? "Official cadastral attributes for this parcel."
      : "No municipality or province is recorded on the official parcel.",
  });

  facts.push({
    id: "coordinates",
    label: "Map position",
    value: identity.coordinates
      ? `${identity.coordinates.lat.toFixed(5)}, ${identity.coordinates.lng.toFixed(5)}`
      : null,
    source: identity.coordinates ? "official" : "unknown",
    provenance: identity.coordinates
      ? "Derived from the official parcel geometry."
      : "No parcel geometry is available for this erf.",
  });

  for (const spec of LOCATION_DISTANCE_SPECS) {
    const claim = firstClaim(pack, ["environment", "address", "notes"], spec.keys);
    facts.push(
      fromClaim(
        `distance-${spec.id}`,
        `Distance to ${spec.label.toLowerCase()}`,
        claim,
        "No measured distance or travel time exists in the evidence. Easy Erf does not estimate one.",
      ),
    );
  }

  const roadAccess = firstClaim(pack, ["infrastructure"], ["roadAccess", "accessRoad"]);
  facts.push(
    fromClaim(
      "road-access",
      "Road access",
      roadAccess,
      "No document states the road access for this erf.",
    ),
  );

  const lifestyleSpecs: Array<{ id: string; label: string; keys: string[]; unknown: string }> = [
    {
      id: "views",
      label: "Views",
      keys: ["views", "view"],
      unknown: "No view description has been captured from a listing or your own site notes.",
    },
    {
      id: "noise",
      label: "Noise",
      keys: ["noise", "noiseExposure"],
      unknown: "No noise observation has been recorded for this erf.",
    },
    {
      id: "character",
      label: "Neighbourhood character",
      keys: ["neighbourhood", "neighbourhoodCharacter", "suburbCharacter"],
      unknown: "No neighbourhood description has been recorded from evidence or your notes.",
    },
    {
      id: "development",
      label: "Nearby development activity",
      keys: ["nearbyDevelopment", "developmentActivity"],
      unknown: "No nearby development activity has been recorded for this area.",
    },
  ];

  for (const spec of lifestyleSpecs) {
    facts.push(
      fromClaim(
        spec.id,
        spec.label,
        firstClaim(pack, ["notes", "environment", "market"], spec.keys),
        spec.unknown,
      ),
    );
  }

  if (subjectListing) {
    const listingFacts = [
      subjectListing.propertyType ? `Property type: ${subjectListing.propertyType}` : null,
      typeof subjectListing.beds === "number" ? `${subjectListing.beds} bed` : null,
      typeof subjectListing.baths === "number" ? `${subjectListing.baths} bath` : null,
    ].filter(Boolean) as string[];
    facts.push({
      id: "listing-context",
      label: "Listing-described property",
      value: listingFacts.length ? listingFacts.join(" · ") : null,
      source: listingFacts.length ? "listing" : "unknown",
      provenance: listingFacts.length
        ? `Described by the subject listing${subjectListing.sourcePortal ? ` on ${subjectListing.sourcePortal}` : ""}. Marketing copy, not an official record.`
        : "The saved subject listing does not describe the property in a structured way.",
    });
  }

  const missingChecks: ContextMissingCheck[] = facts
    .filter((fact) => fact.value === null)
    .slice(0, 6)
    .map((fact) => ({
      id: `missing-${fact.id}`,
      label: fact.label,
      action: fact.id.startsWith("distance-")
        ? "Measure the distance yourself and save it as a property note."
        : "Record what you observed on site, or attach a source that states it.",
    }));

  const supportedCount = countSupported(facts);

  return {
    facts,
    supportedCount,
    headline: supportedCount
      ? `${supportedCount} location fact(s) supported by evidence`
      : "No location context is supported by evidence yet",
    headlineDetail:
      "Official and map-derived facts, listing-derived descriptions and your own confirmed observations are kept apart, so marketing language never becomes a fact.",
    missingChecks,
    note: "Easy Erf never invents a distance, a travel time or a lifestyle claim. Anything not stated by a source stays blank with a next step.",
    nextStep: missingChecks.length ? "Add site observations in Notes" : null,
    nextStepTab: missingChecks.length ? "research" : null,
  };
}

/* -------------------------------------------------------- still to verify */

export interface StillToVerifyItem {
  id: string;
  label: string;
  action: string;
}

export interface StillToVerifySummary {
  count: number;
  topItems: StillToVerifyItem[];
  allItems: StillToVerifyItem[];
  action: string;
}

/**
 * Replaces repeating "outstanding checks" blocks across several context
 * sections with one compact summary. Nothing is dropped: every unknown item
 * from every supplied section is preserved in `allItems` for the expandable
 * full list; only the headline view is capped.
 */
export function buildStillToVerifySummary(
  sections: Array<Pick<ContextSectionModel, "missingChecks">>,
  extra: StillToVerifyItem[] = [],
): StillToVerifySummary {
  const allItems: StillToVerifyItem[] = [
    ...sections.flatMap((section) => section.missingChecks),
    ...extra,
  ];
  return {
    count: allItems.length,
    topItems: allItems.slice(0, 3),
    allItems,
    action: allItems.length
      ? "Open the full due diligence & evidence area below to see every outstanding item and close it out."
      : "No outstanding unknowns were recorded across the tracked context sections.",
  };
}
