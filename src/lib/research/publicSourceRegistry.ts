import {
  CSG_OFFICIAL_URL,
  CSG_VIEWER_URL,
  KOUGA_MAPPING_URL,
  KOUGA_PUBLIC_MAP_URL,
} from "@/lib/external-urls";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import type {
  ParcelFieldKey,
  ResearchSource,
  ResearchSourceContext,
  ResearchSourceDefinition,
} from "@/lib/research/sourceTypes";

const google = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
const googleImages = (query: string) =>
  `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;

function hasField(ctx: ResearchSourceContext, field: ParcelFieldKey): boolean {
  const p = ctx.parcel;
  switch (field) {
    case "erfNumber":
      return p.erfNumber !== null && p.erfNumber !== undefined && String(p.erfNumber).trim() !== "";
    case "portion":
      return p.portion !== null && p.portion !== undefined && String(p.portion).trim() !== "";
    case "lpi":
      return !!p.lpi?.trim();
    case "parcelKey":
      return !!p.parcelKey?.trim();
    case "municipality":
      return !!p.municipality?.trim();
    case "province":
      return !!p.province?.trim();
    case "suburbOrArea":
      return !!p.suburbOrArea?.trim();
    case "coordinates":
      return typeof p.coordinates?.lng === "number" && typeof p.coordinates?.lat === "number";
  }
}

function queryParts(ctx: ResearchSourceContext): string[] {
  const p = ctx.parcel;
  return [
    p.erfNumber != null ? `Erf ${p.erfNumber}` : null,
    p.portion != null ? `Portion ${p.portion}` : null,
    p.suburbOrArea,
    p.municipality,
    p.province,
    "South Africa",
  ].filter((part): part is string => !!part && part.trim().length > 0);
}

function baseQuery(ctx: ResearchSourceContext): string {
  return Array.from(new Set(queryParts(ctx))).join(" ");
}

function coordsQuery(ctx: ResearchSourceContext): string | null {
  const c = ctx.parcel.coordinates;
  return c ? `${c.lat},${c.lng}` : null;
}

function kougaLikely(ctx: ResearchSourceContext): boolean {
  const p = ctx.parcel;
  return `${p.municipality ?? ""} ${p.suburbOrArea ?? ""} ${p.town ?? ""}`
    .toLowerCase()
    .includes("kouga");
}

export const PUBLIC_SOURCE_DEFINITIONS: ResearchSourceDefinition[] = [
  {
    id: "csg-property-viewer",
    category: "csg-sg-documents",
    name: "CSG Property Viewer",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Official cadastral parcel context and source viewer access.",
    requiredFields: [],
    actionLabel: "Open CSG Viewer",
    complianceNote: "Official public viewer. Verify parcel identity inside the source system.",
    buildUrl: () => CSG_VIEWER_URL,
  },
  {
    id: "sg-document-list",
    category: "csg-sg-documents",
    name: "SG diagram/document list",
    sourceType: "official",
    defaultStatus: "available",
    missingStatus: "manual-check",
    reveals:
      "Surveyor-General diagrams and related registered documents when the URL can be built.",
    requiredFields: ["erfNumber"],
    actionLabel: "Open SG documents",
    complianceNote:
      "Only shown as direct action when enough CSG fields are known. Otherwise use the CSG official site.",
    buildUrl: ({ parcel }) => {
      const result = buildSgDocumentUrl({
        lpi: parcel.lpi,
        parcelKey: parcel.parcelKey,
        erfNumber: parcel.erfNumber,
        portion: parcel.portion,
        province: parcel.province,
        majorRegion: parcel.municipality,
        minorRegion: parcel.suburbOrArea,
      });
      return result.shown ? result.url : CSG_OFFICIAL_URL;
    },
  },
  {
    id: "deeds-office-search",
    category: "deeds-ownership",
    name: "Deeds Office / DeedsWeb research",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Possible deeds office research entry points for ownership and transfer checks.",
    requiredFields: ["erfNumber", "province"],
    actionLabel: "Search deeds sources",
    complianceNote:
      "Ownership is not displayed unless a verified paid or official source is attached.",
    buildUrl: (ctx) => google(`${baseQuery(ctx)} Deeds Office DeedsWeb property ownership`),
  },
  {
    id: "windeed-lightstone-manual",
    category: "deeds-ownership",
    name: "WinDeed / Lightstone ownership report",
    sourceType: "paid-provider",
    defaultStatus: "paid-report",
    reveals: "Paid ownership, transfer, bonds, and comparable-sales reports when ordered.",
    requiredFields: [],
    actionLabel: "Save report interest",
    complianceNote: "Paid provider data not yet attached.",
  },
  {
    id: "municipal-valuation-roll",
    category: "municipal-valuation-rates",
    name: "Municipal valuation roll",
    sourceType: "municipal",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Municipal valuation roll entries, property category, and possible roll values.",
    requiredFields: ["municipality"],
    actionLabel: "Search valuation roll",
    complianceNote: "Rates and municipal values must be verified against the municipality.",
    buildUrl: (ctx) => google(`${ctx.parcel.municipality ?? ""} valuation roll ${baseQuery(ctx)}`),
  },
  {
    id: "kouga-mapping-zoning",
    category: "zoning-land-use",
    name: "Kouga public mapping and zoning",
    sourceType: "municipal",
    defaultStatus: "available",
    missingStatus: "open-search",
    reveals:
      "Municipal GIS layers, zoning viewer context, and public map overlays where available.",
    requiredFields: [],
    actionLabel: "Open Kouga map",
    complianceNote: "Confirm zoning with the municipality before relying on it.",
    buildUrl: (ctx) =>
      kougaLikely(ctx)
        ? KOUGA_PUBLIC_MAP_URL
        : google(`${baseQuery(ctx)} municipal GIS zoning viewer`),
  },
  {
    id: "land-use-scheme",
    category: "zoning-land-use",
    name: "Land-use scheme documents",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Scheme documents, coverage, height, density, consent use, and land-use rules.",
    requiredFields: ["municipality"],
    actionLabel: "Search land-use scheme",
    complianceNote: "Generated public web search. Verify against the official municipal document.",
    buildUrl: (ctx) =>
      google(`${ctx.parcel.municipality ?? ""} land use scheme zoning coverage height FAR`),
  },
  {
    id: "planning-public-notices",
    category: "planning-notices",
    name: "Planning applications and public notices",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "Rezoning, subdivision, departures, consent use, building plan references, and SPLUMA notices.",
    requiredFields: ["erfNumber", "municipality"],
    actionLabel: "Search planning notices",
    complianceNote:
      "External searches may return nearby or unrelated results and must be verified manually.",
    buildUrl: (ctx) =>
      google(`${baseQuery(ctx)} rezoning subdivision departure consent use SPLUMA notice`),
  },
  {
    id: "environmental-heritage-risk",
    category: "environmental-heritage-risk",
    name: "Environmental, heritage, flood, coastal, and geology checks",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "DFFE, SAHRA/SAHRIS, flood, coastal, wetland, and geology risk research paths.",
    requiredFields: ["suburbOrArea"],
    actionLabel: "Search risk sources",
    complianceNote:
      "Shown as research checks, not verified risk results unless evidence is attached.",
    buildUrl: (ctx) =>
      google(`${baseQuery(ctx)} DFFE SAHRA SAHRIS flood coastal wetland geology risk`),
  },
  {
    id: "property24-search",
    category: "listings-market-evidence",
    name: "Property24 search",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Possible active listings, asking prices, agent context, and market evidence.",
    requiredFields: ["suburbOrArea"],
    actionLabel: "Open Property24",
    complianceNote:
      "External listing results are unverified unless the user saves and confirms them.",
    buildUrl: (ctx) => google(`site:property24.com ${baseQuery(ctx)} property for sale`),
  },
  {
    id: "private-property-search",
    category: "listings-market-evidence",
    name: "Private Property search",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Possible active listings, asking prices, agent context, and market evidence.",
    requiredFields: ["suburbOrArea"],
    actionLabel: "Open Private Property",
    complianceNote:
      "External listing results are unverified unless the user saves and confirms them.",
    buildUrl: (ctx) => google(`site:privateproperty.co.za ${baseQuery(ctx)} property for sale`),
  },
  {
    id: "google-listing-search",
    category: "listings-market-evidence",
    name: "Google listing search",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Agency pages, old listings, auction references, and public market evidence.",
    requiredFields: ["erfNumber", "suburbOrArea"],
    actionLabel: "Search Google",
    complianceNote:
      "Generated search. Results may be nearby or unrelated and must be verified manually.",
    buildUrl: (ctx) => google(`${baseQuery(ctx)} property for sale listing`),
  },
  {
    id: "google-images-market-evidence",
    category: "listings-market-evidence",
    name: "Google Images and web evidence",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "Images, old listings, agency pages, auction references, and surrounding market context.",
    requiredFields: ["erfNumber", "suburbOrArea"],
    actionLabel: "Search images",
    complianceNote:
      "Generated public search. Results may be unrelated and must be verified manually.",
    buildUrl: (ctx) => googleImages(`${baseQuery(ctx)} property`),
  },
  {
    id: "google-maps-listing-context",
    category: "listings-market-evidence",
    name: "Google Maps context",
    sourceType: "public-web",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Location, access, surrounding properties, nearby amenities, and Street View context.",
    requiredFields: ["coordinates"],
    actionLabel: "Open Google Maps",
    complianceNote: "Map context is not listing evidence by itself. Verify all findings manually.",
    buildUrl: (ctx) => {
      const coords = coordsQuery(ctx);
      return coords ? `https://maps.google.com/?q=${encodeURIComponent(coords)}` : null;
    },
  },
  {
    id: "neighbourhood-schools-amenities",
    category: "neighbourhood-intelligence",
    name: "Schools, amenities, demographics, and crime context",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "Neighbourhood amenities, schools, census/demographic sources, and crime-stat references.",
    requiredFields: ["suburbOrArea"],
    actionLabel: "Search neighbourhood",
    complianceNote:
      "Contextual public research only. Do not treat search results as verified statistics.",
    buildUrl: (ctx) =>
      google(`${baseQuery(ctx)} schools amenities census demographics crime statistics`),
  },
  {
    id: "maps-access-roads",
    category: "roads-access-infrastructure",
    name: "Roads, access, and infrastructure",
    sourceType: "public-web",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals: "Access, nearby roads, municipal upgrades, tenders, and infrastructure catalysts.",
    requiredFields: ["coordinates"],
    actionLabel: "Open map/search",
    complianceNote: "Map and search context must be checked manually.",
    buildUrl: (ctx) => {
      const coords = coordsQuery(ctx);
      return coords
        ? `https://maps.google.com/?q=${encodeURIComponent(coords)}`
        : google(`${baseQuery(ctx)} road access infrastructure upgrade`);
    },
  },
  {
    id: "legal-entity-distress",
    category: "legal-entity-distress",
    name: "Legal, entity, estate, and distress research",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "CIPC, Master of the High Court, liquidation, insolvency, SAFLII, and Gazette research paths.",
    requiredFields: ["suburbOrArea"],
    actionLabel: "Search legal sources",
    complianceNote:
      "POPIA-sensitive research. Do not infer personal ownership or distress without verified sources.",
    buildUrl: (ctx) =>
      google(
        `${baseQuery(ctx)} CIPC Master High Court liquidation insolvency SAFLII Government Gazette`,
      ),
  },
  {
    id: "tenders-catalysts",
    category: "tenders-catalysts",
    name: "Public tenders and future area catalysts",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "eTenders, municipal tenders, IDP/SDF documents, infrastructure projects, and development notices.",
    requiredFields: ["municipality"],
    actionLabel: "Search catalysts",
    complianceNote:
      "Generated public search. Confirm against official tender and municipal documents.",
    buildUrl: (ctx) =>
      google(
        `${ctx.parcel.municipality ?? ""} eTenders IDP SDF infrastructure projects ${ctx.parcel.suburbOrArea ?? ""}`,
      ),
  },
  {
    id: "paid-report-slots",
    category: "paid-reports",
    name: "Lightstone, WinDeed, deeds, valuation, and comparables reports",
    sourceType: "paid-provider",
    defaultStatus: "paid-report",
    reveals: "Paid provider reports that can improve confidence when ordered and attached.",
    requiredFields: [],
    actionLabel: "Order report / save interest",
    complianceNote: "Paid provider data not yet attached.",
  },
];

export function buildPublicResearchSources(
  parcel: ResearchSourceContext["parcel"],
): ResearchSource[] {
  const ctx = { parcel };
  return PUBLIC_SOURCE_DEFINITIONS.map((definition) => {
    const missingFields = definition.requiredFields.filter((field) => !hasField(ctx, field));
    const url = missingFields.length === 0 ? (definition.buildUrl?.(ctx) ?? null) : null;
    const status =
      missingFields.length > 0
        ? (definition.missingStatus ?? "manual-check")
        : definition.defaultStatus;

    return {
      ...definition,
      status,
      url,
      missingFields,
    };
  });
}
