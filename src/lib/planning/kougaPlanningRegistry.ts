import type {
  LocalDesignGuideline,
  MunicipalityPlanningRegistryEntry,
  MunicipalityPlanningSource,
  ZoneDefinition,
  ZoningRule,
} from "./municipalityPlanningTypes";

/**
 * Kouga Local Municipality planning source + rule registry.
 *
 * SOURCE VERIFICATION NOTE (important, do not remove):
 * The Kouga website returned HTTP 403 to automated retrieval while this
 * registry was built, so the Residential Zone 1 numeric controls below could
 * NOT be confirmed against the official Land Use Scheme text. They are stored
 * with status `manual_candidate` — a review-required published-rule candidate.
 * They must never be rendered as active official rules until a maintainer sets
 * `status: "active"` with a real citation and `lastVerifiedAt`.
 */

const KOUGA = "Kouga Local Municipality";

export const KOUGA_PLANNING_AREAS = [
  "St Francis Bay Village",
  "St Francis Bay Canals",
  "Santareme",
  "Cape St Francis",
  "Harbour precinct",
  "Sea Vista",
  "Jeffreys Bay",
  "Oyster Bay",
  "Humansdorp",
  "Hankey",
  "Patensie",
];

export const KOUGA_PLANNING_SOURCES: MunicipalityPlanningSource[] = [
  {
    id: "kouga-document-library",
    municipality: KOUGA,
    title: "Kouga Municipality document library",
    sourceType: "planning_register",
    url: "https://www.kouga.gov.za/document-library",
    jurisdiction: "municipal",
    status: "active",
    version: null,
    effectiveDate: null,
    publishedDate: null,
    lastVerifiedAt: null,
    planningAreas: [],
    notes:
      "Index of published municipal documents, including the Land Use Scheme and town zoning plans.",
  },
  {
    id: "kouga-planning-and-development",
    municipality: KOUGA,
    title: "Kouga Planning and Development",
    sourceType: "planning_register",
    url: "https://www.kouga.gov.za/planning-and-development",
    jurisdiction: "municipal",
    status: "active",
    version: null,
    effectiveDate: null,
    publishedDate: null,
    lastVerifiedAt: null,
    planningAreas: [],
    notes: "Departmental landing page for land-use applications and planning contacts.",
  },
  {
    id: "kouga-land-use-scheme-adoption-notice",
    municipality: KOUGA,
    title: "Kouga Land Use Scheme adoption notice",
    sourceType: "land_use_scheme",
    url: "https://www.kouga.gov.za/notice/kouga-land-use-scheme-adoption-notice",
    jurisdiction: "municipal",
    status: "active",
    version: "Adoption notice",
    effectiveDate: null,
    publishedDate: null,
    lastVerifiedAt: null,
    planningAreas: [],
    notes: "Adoption notice for the Kouga Land Use Scheme. Confirms the scheme, not zone values.",
  },
  {
    id: "kouga-land-use-scheme-2021",
    municipality: KOUGA,
    title: "Kouga Land Use Scheme 2021 and town zoning plans",
    sourceType: "land_use_scheme",
    url: "https://www.kouga.gov.za/document-library",
    jurisdiction: "municipal",
    status: "active",
    version: "2021",
    effectiveDate: null,
    publishedDate: "2021-01-01",
    lastVerifiedAt: null,
    planningAreas: ["St Francis Bay Village", "Cape St Francis", "Oyster Bay", "Jeffreys Bay"],
    notes:
      "Scheme text plus town zoning plan PDFs listed in the document library. Numeric zone controls in Easy Erf are still review-required candidates until read off this document.",
  },
  {
    id: "kouga-building-aesthetics-2025",
    municipality: KOUGA,
    title: "Kouga by-laws relating to building aesthetics (2025 notice)",
    sourceType: "by_law",
    url: "https://www.kouga.gov.za/notice/by-laws-relating-to-the-building-aesthetics",
    jurisdiction: "municipal",
    // Promulgation not independently proved — must stay pending.
    status: "pending",
    version: "2025 notice",
    effectiveDate: null,
    publishedDate: "2025-01-01",
    lastVerifiedAt: null,
    planningAreas: [],
    notes:
      "Marked pending because promulgation has not been independently proved. Do not present as enforceable law.",
  },
  {
    id: "kouga-draft-aesthetics-2020",
    municipality: KOUGA,
    title: "Draft aesthetic by-law and guidelines — Sea Vista, St Francis Bay Village and Canals",
    sourceType: "architectural_guideline",
    url: "https://www.kouga.gov.za/notice/draft-aeshetical-by-law-sea-vista-st-francis-bay-village-canals-and",
    jurisdiction: "municipal",
    status: "draft",
    version: "2020 draft",
    effectiveDate: null,
    publishedDate: "2020-01-01",
    lastVerifiedAt: null,
    planningAreas: ["Sea Vista", "St Francis Bay Village", "St Francis Bay Canals", "Santareme"],
    notes: "Draft guidance. Enforceability not proved. Never present as enforceable law.",
  },
  {
    id: "kouga-arcgis-catalog",
    municipality: KOUGA,
    title: "Kouga ArcGIS services catalog",
    sourceType: "zoning_map",
    url: "https://services6.arcgis.com/HrQQGPZkIr5BuMyY/ArcGIS/rest/services",
    jurisdiction: "municipal",
    status: "active",
    version: null,
    effectiveDate: null,
    publishedDate: null,
    lastVerifiedAt: null,
    planningAreas: [],
    notes:
      "Exposes parcel, SG, suburb, address and historical-application services. No dependable official zoning polygon service has been confirmed, so automatic zoning detection is not available.",
  },
  {
    id: "national-building-standards-act-103-1977",
    municipality: KOUGA,
    title: "National Building Regulations and Building Standards Act 103 of 1977",
    sourceType: "national_legislation",
    url: "https://www.gov.za/documents/national-building-regulations-and-building-standards-act-16-apr-2015-1302",
    jurisdiction: "national",
    status: "active",
    version: "Act 103 of 1977",
    effectiveDate: null,
    publishedDate: null,
    lastVerifiedAt: null,
    planningAreas: [],
    notes:
      "National statute governing building approval. SANS 10400 deemed-to-satisfy content is paid and is not reproduced by Easy Erf.",
  },
  {
    id: "national-building-regulations-2008",
    municipality: KOUGA,
    title: "National Building Regulations (regulations notice)",
    sourceType: "national_legislation",
    url: "https://www.gov.za/documents/notices/national-building-regulations-and-building-standards-act-regulations-27-may-2008",
    jurisdiction: "national",
    status: "active",
    version: "27 May 2008",
    effectiveDate: "2008-05-27",
    publishedDate: "2008-05-27",
    lastVerifiedAt: null,
    planningAreas: [],
    notes:
      "Regulations made under Act 103 of 1977. SANS 10400 parts are referenced at a high level only; the authorised source must be purchased separately.",
  },
];

/**
 * Residential Zone 1 controls supplied in the product brief.
 *
 * These are NOT confirmed official values. Status is `manual_candidate` for
 * every rule until each one is read off the Kouga Land Use Scheme with a real
 * section citation.
 */
const RES1_RULES: ZoningRule[] = [
  {
    id: "kouga-res1-street-building-line",
    ruleType: "street_building_line",
    label: "Street building line",
    value: 3,
    unit: "m",
    statement: "Street building line of 3 m (review-required candidate value).",
    conditions: ["Value not yet confirmed against the Kouga Land Use Scheme text."],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "Published schemes normally require buildings to be set back from the street boundary. The exact distance for this erf must be confirmed with the municipality.",
  },
  {
    id: "kouga-res1-side-building-line",
    ruleType: "side_building_line",
    label: "Side building lines",
    value: 1.5,
    unit: "m",
    statement: "Side building lines of 1.5 m (review-required candidate value).",
    conditions: ["Value not yet confirmed against the Kouga Land Use Scheme text."],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "Side setbacks typically apply to each lateral boundary. Departures, servitudes and title conditions can change what applies here.",
  },
  {
    id: "kouga-res1-rear-building-line",
    ruleType: "rear_building_line",
    label: "Rear building line",
    value: 1.5,
    unit: "m",
    statement: "Rear building line of 1.5 m (review-required candidate value).",
    conditions: ["Value not yet confirmed against the Kouga Land Use Scheme text."],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "A rear setback is normally measured from the rear boundary. Confirm the measured boundary with the SG diagram.",
  },
  {
    id: "kouga-res1-height",
    ruleType: "height",
    label: "Maximum height",
    value: 8.5,
    unit: "m",
    statement: "Maximum height of 8.5 m (review-required candidate value).",
    conditions: ["Value not yet confirmed against the Kouga Land Use Scheme text."],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "Published Residential Zone 1 rules indicate a maximum height of 8.5 m. Property-specific departures, title conditions, servitudes and approved plans have not yet been confirmed.",
  },
  {
    id: "kouga-res1-coverage",
    ruleType: "coverage",
    label: "Maximum coverage",
    value: 50,
    unit: "percent",
    statement: "Maximum coverage of 50% (review-required candidate value).",
    conditions: ["Value not yet confirmed against the Kouga Land Use Scheme text."],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "Coverage limits the ground-floor footprint as a share of erf area. The resulting figure is theoretical until boundaries, servitudes and title conditions are confirmed.",
  },
  {
    id: "kouga-res1-dwellings",
    ruleType: "dwelling_units",
    label: "Dwelling units",
    value: 1,
    unit: "units",
    statement:
      "One dwelling unit; an additional dwelling unit is subject to municipal consent (review-required candidate value).",
    conditions: [
      "Additional dwelling requires consent use approval.",
      "Value not yet confirmed against the Kouga Land Use Scheme text.",
    ],
    sourceId: "kouga-land-use-scheme-2021",
    citation: null,
    status: "manual_candidate",
    interpretation:
      "A second dwelling is normally a consent use, meaning a municipal application is required. Nothing here confirms that consent would be granted for this erf.",
  },
];

const KOUGA_ZONES: ZoneDefinition[] = [
  {
    code: "RES1",
    name: "Residential Zone 1 (single residential)",
    municipality: KOUGA,
    permittedUses: ["Dwelling house"],
    consentUses: [
      "Additional dwelling unit",
      "Home occupation / home business",
      "Guest accommodation",
      "Place of instruction or worship",
    ],
    rules: RES1_RULES,
    sourceId: "kouga-land-use-scheme-2021",
    status: "manual_candidate",
    summary:
      "Single residential zoning. Published scheme rules describe a dwelling house as the primary permitted use, with additional dwellings and business-type uses treated as consent uses.",
  },
];

const KOUGA_GUIDELINES: LocalDesignGuideline[] = [
  {
    id: "kouga-guideline-aesthetics-2025",
    municipality: KOUGA,
    planningAreas: [],
    title: "Kouga building aesthetics by-law notice (2025)",
    summary:
      "Notice of by-laws relating to building aesthetics. Promulgation has not been independently proved, so this is treated as pending and not as enforceable law.",
    authority: "municipal",
    sourceId: "kouga-building-aesthetics-2025",
    citation: null,
    status: "pending",
    confidence: "low",
  },
  {
    id: "kouga-guideline-draft-aesthetics-2020",
    municipality: KOUGA,
    planningAreas: ["Sea Vista", "St Francis Bay Village", "St Francis Bay Canals", "Santareme"],
    title: "Draft aesthetic guidelines — Sea Vista, St Francis Bay Village and Canals",
    summary:
      "Draft aesthetic guidance covering roof form, materials, colour and massing in the listed precincts. Draft guidance only; enforceability is not proved.",
    authority: "guidance",
    sourceId: "kouga-draft-aesthetics-2020",
    citation: null,
    status: "draft",
    confidence: "low",
  },
];

export const KOUGA_PLANNING_REGISTRY: MunicipalityPlanningRegistryEntry = {
  municipality: KOUGA,
  municipalityAliases: ["kouga", "kouga local municipality", "kouga municipality"],
  planningAreas: KOUGA_PLANNING_AREAS,
  sources: KOUGA_PLANNING_SOURCES,
  zones: KOUGA_ZONES,
  guidelines: KOUGA_GUIDELINES,
  // No dependable official zoning polygon service confirmed yet.
  zoningPolygonAdapter: null,
};
