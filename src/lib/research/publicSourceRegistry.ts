import {
  CSG_OFFICIAL_URL,
  CSG_VIEWER_URL,
  KOUGA_MAPPING_URL,
  KOUGA_PUBLIC_MAP_URL,
} from "@/lib/external-urls";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import {
  ERF_962_EVIDENCE_SOURCES,
  ERF_962_GENERATED_QUERIES,
  matchesErf962HarbourRoad,
} from "@/lib/research/seedParcels/erf962HarbourRoad";
import type {
  ParcelFieldKey,
  ResearchSource,
  ResearchSourceContext,
  ResearchSourceDefinition,
  ResearchSourceQuality,
  ResearchSourceUsefulness,
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
    p.knownFields.find((field) => /address/i.test(field.label))?.value,
    p.erfNumber != null ? `Erf ${p.erfNumber}` : null,
    p.portion != null ? `Portion ${p.portion}` : null,
    p.lpi,
    p.parcelKey,
    p.suburbOrArea,
    p.town,
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

function fixedUrl(url: string): (ctx: ResearchSourceContext) => string {
  return () => url;
}

function source(definition: ResearchSourceDefinition): ResearchSourceDefinition {
  return definition;
}

function generatedSearchDefinition(id: string, query: string): ResearchSourceDefinition {
  return {
    id,
    category: "search",
    name: query,
    sourceType: "generated-search",
    defaultStatus: "open-search",
    reveals: "Generated public web search for parcel research leads.",
    requiredFields: [],
    actionLabel: "Search",
    complianceNote:
      "Generated search. Results may be nearby or unrelated and must be verified manually.",
    confidence: "external_relevant",
    dossierGroup: "generated-searches",
    buildUrl: () => google(query),
  };
}

function genericGeneratedQueries(ctx: ResearchSourceContext): string[] {
  const p = ctx.parcel;
  const address = p.knownFields.find((field) => /address/i.test(field.label))?.value;
  const place = [p.suburbOrArea, p.town, p.municipality, p.province].filter(Boolean).join(" ");
  return [
    address && place ? `"${address}" "${place}"` : null,
    p.erfNumber != null && place ? `"Erf ${p.erfNumber}" "${place}"` : null,
    p.erfNumber != null && p.suburbOrArea ? `"Erf ${p.erfNumber}" "${p.suburbOrArea}"` : null,
    p.lpi ? `"${p.lpi}"` : null,
    p.parcelKey ? `"${p.parcelKey}"` : null,
    p.erfNumber != null && p.municipality
      ? `site:gov.za "Erf ${p.erfNumber}" "${p.municipality}"`
      : null,
    p.erfNumber != null && p.municipality ? `site:${"kouga.gov.za"} "${p.erfNumber}"` : null,
  ].filter((query): query is string => !!query && query.trim().length > 0);
}

function buildGeneratedSearchDefinitions(ctx: ResearchSourceContext): ResearchSourceDefinition[] {
  const queries = matchesErf962HarbourRoad(ctx.parcel)
    ? ERF_962_GENERATED_QUERIES
    : genericGeneratedQueries(ctx);
  return Array.from(new Set(queries)).map((query, index) =>
    generatedSearchDefinition(
      `generated-search-${index}-${query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 42)}`,
      query,
    ),
  );
}

function hasStrongParcelContext(ctx: ResearchSourceContext): boolean {
  const p = ctx.parcel;
  const hasIdentity =
    hasField(ctx, "lpi") || hasField(ctx, "parcelKey") || hasField(ctx, "erfNumber");
  const hasPlace =
    hasField(ctx, "municipality") || hasField(ctx, "province") || hasField(ctx, "suburbOrArea");
  return hasIdentity && hasPlace;
}

function inferSourceQuality(
  definition: ResearchSourceDefinition,
  ctx: ResearchSourceContext,
  url: string | null,
  missingFields: ParcelFieldKey[],
): ResearchSourceQuality {
  if (definition.sourceQuality) return definition.sourceQuality;
  if (definition.sourceType === "paid-provider" || definition.defaultStatus === "paid-report") {
    return "paid_provider";
  }
  if (
    definition.id === "sg-document-list" &&
    url &&
    url !== CSG_OFFICIAL_URL &&
    missingFields.length === 0
  ) {
    return "direct_parcel_link";
  }
  if (definition.parcelSpecific && definition.confidence === "confirmed_for_parcel") {
    return "direct_parcel_link";
  }
  if (definition.id === "opendataza-csg-listing" || definition.sourceType === "unavailable") {
    return "weak_or_deprecated";
  }
  if (
    definition.sourceType === "municipal" ||
    definition.category === "municipal-valuation-rates"
  ) {
    return "municipal_source";
  }
  if (definition.sourceType === "official") {
    return "official_portal";
  }
  if (definition.sourceType === "generated-search") {
    return "generated_search";
  }
  if (!hasStrongParcelContext(ctx) && definition.requiredFields.length === 0) {
    return "weak_or_deprecated";
  }
  return "generated_search";
}

function inferUsefulness(
  definition: ResearchSourceDefinition,
  ctx: ResearchSourceContext,
  quality: ResearchSourceQuality,
  missingFields: ParcelFieldKey[],
): ResearchSourceUsefulness {
  if (definition.userUsefulness) return definition.userUsefulness;
  if (quality === "weak_or_deprecated" || definition.sourceType === "unavailable") {
    return "hidden_by_default";
  }
  if (
    quality === "direct_parcel_link" ||
    ["csg-property-viewer", "csg-official-site", "deedsweb-official"].includes(definition.id)
  ) {
    return "primary";
  }
  if (
    [
      "municipal-valuation-roll",
      "kouga-mapping-portal",
      "kouga-public-map-viewer",
      "kouga-planning-development",
      "kouga-mapping-zoning",
    ].includes(definition.id)
  ) {
    return "primary";
  }
  if (
    ["property24-search", "private-property-search"].includes(definition.id) &&
    hasStrongParcelContext(ctx) &&
    missingFields.length === 0
  ) {
    return "primary";
  }
  if (quality === "paid_provider") return "secondary";
  if (definition.sourceType === "generated-search" && !hasStrongParcelContext(ctx)) {
    return "hidden_by_default";
  }
  return "secondary";
}

function inferActionInstruction(
  definition: ResearchSourceDefinition,
  quality: ResearchSourceQuality,
): string {
  if (definition.actionInstruction) return definition.actionInstruction;
  if (definition.id === "sg-document-list") {
    return "Open the SG document list and confirm the erf, portion, LPI or parcel key before saving evidence.";
  }
  if (definition.id === "municipal-valuation-roll") {
    return "Search the municipal roll, then save only parcel-matched valuation or rates findings.";
  }
  if (definition.category === "zoning-land-use" || definition.category === "planning-notices") {
    return "Check whether zoning or planning results clearly match this erf before relying on them.";
  }
  if (definition.category === "listings-market-evidence" || definition.category === "market") {
    return "Open the search, compare address/erf evidence, and save only verified listing URLs.";
  }
  if (definition.category === "deeds-ownership" || definition.id.includes("deeds")) {
    return "Use this as a lawful ownership/deeds research entry point; do not infer owner data here.";
  }
  if (quality === "direct_parcel_link") {
    return "Open the direct source and confirm the parcel identifiers match this dossier.";
  }
  if (quality === "official_portal") {
    return "Open the official portal, search the known parcel fields, and verify the record manually.";
  }
  if (quality === "municipal_source") {
    return "Open the municipal source and verify valuation, zoning, rates or planning evidence manually.";
  }
  if (quality === "generated_search") {
    return "Open the search and treat every result as unverified until you match it to this erf.";
  }
  if (quality === "paid_provider") {
    return "Use this slot only when a verified paid report is ordered or attached.";
  }
  return "Use as a backup discovery source and verify any result against official records.";
}

export const PUBLIC_SOURCE_DEFINITIONS: ResearchSourceDefinition[] = [
  source({
    id: "csg-property-viewer",
    category: "csg-sg-documents",
    name: "CSG Property Viewer",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Official cadastral parcel context and source viewer access.",
    requiredFields: [],
    actionLabel: "Open CSG Viewer",
    complianceNote: "Official public viewer. Verify parcel identity inside the source system.",
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
    buildUrl: () => CSG_VIEWER_URL,
  }),
  source({
    id: "csg-official-site",
    category: "official",
    name: "Chief Surveyor-General",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Official Surveyor-General public entry point.",
    requiredFields: [],
    actionLabel: "Open CSG",
    complianceNote: "Official public source. Verify parcel identity inside the source system.",
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
    buildUrl: fixedUrl("https://csg.dlrrd.gov.za/"),
  }),
  source({
    id: "csg-data-system",
    category: "official",
    name: "CSG data system",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Chief Surveyor-General data-system entry point.",
    requiredFields: [],
    actionLabel: "Open CSG data",
    complianceNote: "Official public source. Confirm any parcel record in the source system.",
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
    buildUrl: fixedUrl("https://csg.dlrrd.gov.za/data.htm"),
  }),
  source({
    id: "opendataza-csg-listing",
    category: "official",
    name: "OpenDataZA CSG cadastral viewer listing",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Public directory listing for the CSG cadastral viewer.",
    requiredFields: [],
    actionLabel: "Open listing",
    complianceNote: "Directory/source discovery link. Verify parcel data with CSG.",
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
    buildUrl: fixedUrl("https://odza.herokuapp.com/opendataza/resource/14"),
  }),
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
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
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
  source({
    id: "deedsweb-official",
    category: "official",
    name: "DeedsWeb",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Official DeedsWeb entry point for deeds registry searches.",
    requiredFields: [],
    actionLabel: "Open DeedsWeb",
    complianceNote:
      "Owner and deeds information may be restricted, paid, outdated or subject to lawful-use requirements.",
    confidence: "official_relevant",
    dossierGroup: "deeds-ownership",
    buildUrl: fixedUrl("https://deedsweb.deeds.gov.za/deedsweb/welcome.jsp"),
  }),
  source({
    id: "govza-deeds-guidance",
    category: "official",
    name: "Gov.za deeds registry guidance",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Government guidance on getting deeds registry information.",
    requiredFields: [],
    actionLabel: "Open guidance",
    complianceNote: "Guidance source only. It does not attach owner or deeds data.",
    confidence: "official_relevant",
    dossierGroup: "deeds-ownership",
    buildUrl: fixedUrl(
      "https://www.gov.za/services/services-residents/place-live/get-deeds-registry-information",
    ),
  }),
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
    confidence: "external_relevant",
    dossierGroup: "deeds-ownership",
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
    confidence: "paid_report",
    dossierGroup: "paid-reports",
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
    confidence: "official_relevant",
    dossierGroup: "municipal-evidence",
    buildUrl: (ctx) => google(`${ctx.parcel.municipality ?? ""} valuation roll ${baseQuery(ctx)}`),
  },
  source({
    id: "kouga-mapping-portal",
    category: "municipal",
    name: "Kouga Mapping Portal",
    sourceType: "municipal",
    defaultStatus: "available",
    reveals: "Kouga ArcGIS datasets and public municipal map layers.",
    requiredFields: [],
    actionLabel: "Open portal",
    complianceNote: "Official municipal portal. Confirm parcel-specific records manually.",
    confidence: "official_relevant",
    dossierGroup: "planning-zoning",
    buildUrl: fixedUrl(KOUGA_MAPPING_URL),
  }),
  source({
    id: "kouga-public-map-viewer",
    category: "municipal",
    name: "Kouga Public Map Viewer",
    sourceType: "municipal",
    defaultStatus: "available",
    reveals: "Public municipal map viewer for layers and spatial context.",
    requiredFields: [],
    actionLabel: "Open viewer",
    complianceNote: "Official municipal viewer. Do not infer zoning unless confirmed.",
    confidence: "official_relevant",
    dossierGroup: "planning-zoning",
    buildUrl: fixedUrl(KOUGA_PUBLIC_MAP_URL),
  }),
  source({
    id: "kouga-planning-development",
    category: "municipal",
    name: "Kouga Planning and Development",
    sourceType: "municipal",
    defaultStatus: "available",
    reveals: "Municipal planning, zoning and building-plan information entry point.",
    requiredFields: [],
    actionLabel: "Open planning",
    complianceNote: "Municipal source. Verify any parcel-specific planning status directly.",
    confidence: "official_relevant",
    dossierGroup: "planning-zoning",
    buildUrl: fixedUrl("https://www.kouga.gov.za/planning-and-development"),
  }),
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
    confidence: "official_relevant",
    dossierGroup: "planning-zoning",
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
    confidence: "external_relevant",
    dossierGroup: "planning-zoning",
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
    confidence: "external_relevant",
    dossierGroup: "planning-zoning",
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
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: (ctx) =>
      google(`${baseQuery(ctx)} DFFE SAHRA SAHRIS flood coastal wetland geology risk`),
  },
  source({
    id: "dffe-environmental-gis",
    category: "environmental",
    name: "DFFE Environmental GIS",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Environmental GIS entry point for national environmental context.",
    requiredFields: [],
    actionLabel: "Open EGIS",
    complianceNote: "General official source. No parcel-specific risk is attached unless verified.",
    confidence: "official_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl("https://www.dffe.gov.za/egis"),
  }),
  source({
    id: "dffe-coastal-viewer",
    category: "environmental",
    name: "DFFE Coastal Viewer",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Coastal viewer for public coastal context.",
    requiredFields: [],
    actionLabel: "Open coastal viewer",
    complianceNote: "General official source. Verify parcel-specific coastal risk manually.",
    confidence: "official_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl("https://ocims.environment.gov.za/CoastalViewer.html"),
  }),
  source({
    id: "coastal-viewer-arcgis-item",
    category: "environmental",
    name: "Coastal Viewer ArcGIS item",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "ArcGIS item metadata for the coastal viewer.",
    requiredFields: [],
    actionLabel: "Open item",
    complianceNote: "Metadata/source discovery link. Verify risk in official layers.",
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl("https://www.arcgis.com/home/item.html?id=e934701c777d4e27a01c801fba18e93e"),
  }),
  source({
    id: "saeon-sarva-coastal-vulnerability",
    category: "environmental",
    name: "SAEON / SARVA Coastal Vulnerability",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Coastal vulnerability research context.",
    requiredFields: [],
    actionLabel: "Open SARVA",
    complianceNote:
      "Research context only. Do not treat as parcel-specific risk without verification.",
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl("https://sarva.saeon.ac.za/coastal-vulnerability/"),
  }),
  source({
    id: "digital-earth-africa-coastal-background",
    category: "environmental",
    name: "Digital Earth Africa coastal vulnerability background",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Background on coastal vulnerability data products.",
    requiredFields: [],
    actionLabel: "Open background",
    complianceNote: "Background source only. It does not verify parcel-specific risk.",
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl(
      "https://www.digitalearthafrica.org/en_za/understanding-coastal-vulnerabilities-using-digital-earth-africas-decision-ready-products/",
    ),
  }),
  source({
    id: "sanbi-bgis-future",
    category: "environmental",
    name: "SANBI BGIS and Eastern Cape biodiversity datasets",
    sourceType: "unavailable",
    defaultStatus: "unavailable",
    reveals: "Future biodiversity and conservation planning integration source cards.",
    requiredFields: [],
    actionLabel: "Future integration",
    complianceNote:
      "Future integration placeholder. No parcel-specific biodiversity result is attached.",
    confidence: "future_integration",
    dossierGroup: "environmental-coastal-risk",
  }),
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
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    confidence: "external_relevant",
    dossierGroup: "generated-searches",
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
    confidence: "external_relevant",
    dossierGroup: "generated-searches",
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
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    confidence: "external_relevant",
    dossierGroup: "official-parcel-identity",
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
    confidence: "external_relevant",
    dossierGroup: "deeds-ownership",
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
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    confidence: "paid_report",
    dossierGroup: "paid-reports",
  },
  ...[
    ["lightstone-property", "Lightstone Property", "https://www.lightstoneproperty.co.za/"],
    [
      "lightstone-sample-property-report",
      "Lightstone sample property report",
      "https://www.lightstone.co.za/downloads/sample-reports/Property-Report.pdf",
    ],
    ["windeed", "WinDeed", "https://www.windeed.co.za/"],
    ["windeed-property-report", "WinDeed Property Report", "https://www.windeed.co.za/wpr/"],
    ["searchworks", "SearchWorks", "https://www.searchworks.co.za/"],
    ["agentiq-property-search", "AgentIQ", "https://www.agentiq.co.za/Search/PropertySearch"],
    ["deedsonline", "DEEDSOnline", "https://www.deedsonline.co.za/"],
    ["mydeedsearch", "MyDeedSearch", "https://www.mydeedsearch.co.za/"],
    ["1map-propertymap", "1map PropertyMap", "https://www.1map.co.za/products/propertymap"],
    ["deedscheck", "DeedsCheck", "https://deedscheck.co.za/"],
    [
      "edeeds-sg-diagram",
      "eDeeds SG Diagram service",
      "https://www.edeeds.co.za/instant-search/instant-sg-surveyor-general-diagram-download/8/45/",
    ],
    [
      "afrigis-landparcel-erven",
      "AfriGIS Land Parcel Erven",
      "https://developers.afrigis.co.za/landparcel-erven/",
    ],
  ].map(([id, name, url]) =>
    source({
      id,
      category: "reports",
      name,
      sourceType: "paid-provider",
      defaultStatus: "paid-report",
      reveals: "Paid or commercial property data source that may require a user account or order.",
      requiredFields: [],
      actionLabel: "Open provider",
      complianceNote:
        "Some records require paid third-party reports. Paid provider data is not attached here.",
      confidence: "paid_report",
      dossierGroup: "paid-reports",
      buildUrl: fixedUrl(url),
    }),
  ),
];

export function buildPublicResearchSources(
  parcel: ResearchSourceContext["parcel"],
): ResearchSource[] {
  const ctx = { parcel };
  const definitions = [
    ...PUBLIC_SOURCE_DEFINITIONS,
    ...(matchesErf962HarbourRoad(parcel) ? ERF_962_EVIDENCE_SOURCES : []),
    ...buildGeneratedSearchDefinitions(ctx),
  ];
  return definitions.map((definition) => {
    const missingFields = definition.requiredFields.filter((field) => !hasField(ctx, field));
    const url = missingFields.length === 0 ? (definition.buildUrl?.(ctx) ?? null) : null;
    const status =
      missingFields.length > 0
        ? (definition.missingStatus ?? "manual-check")
        : definition.defaultStatus;
    const sourceQuality = inferSourceQuality(definition, ctx, url, missingFields);

    return {
      ...definition,
      status,
      url,
      missingFields,
      sourceQuality,
      userUsefulness: inferUsefulness(definition, ctx, sourceQuality, missingFields),
      actionInstruction: inferActionInstruction(definition, sourceQuality),
    };
  });
}
