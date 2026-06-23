import {
  CSG_OFFICIAL_URL,
  CSG_VIEWER_URL,
  DFFE_EGIS_URL,
  GOVZA_DEEDS_GUIDANCE_URL,
  KOUGA_MAPPING_URL,
  KOUGA_PUBLIC_MAP_URL,
  SANBI_BGIS_URL,
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
const KOUGA_VALUATION_ROLL_URL = "https://www.kouga.gov.za/municipalvaluationrollavail";
const SAHRA_SAHRIS_URL = "https://www.sahra.org.za/sahris/";

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

function isGeneratedSearchUrl(url: string | null): boolean {
  return !!url && /^https:\/\/www\.google\.com\/search\?/i.test(url);
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
  if (isGeneratedSearchUrl(url)) {
    return "generated_search";
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
    ].includes(definition.id) &&
    quality !== "generated_search"
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
    actionInstruction:
      "Open the CSG viewer, search or zoom to the erf, and confirm LPI, parcel key, erf and portion against this dossier.",
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
    actionInstruction:
      "Use this as the official fallback portal when a direct SG document link cannot be built.",
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
    userUsefulness: "secondary",
    actionInstruction:
      "Use the CSG data-system entry point only when the viewer or SG document list does not answer the identity question.",
    confidence: "official_relevant",
    dossierGroup: "official-parcel-identity",
    buildUrl: fixedUrl("https://csg.dlrrd.gov.za/data.htm"),
  }),
  source({
    id: "opendataza-csg-listing",
    category: "official",
    name: "Historical OpenDataZA CSG viewer listing",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Historical public directory entry describing the CSG cadastral viewer.",
    requiredFields: [],
    actionLabel: "Open background",
    complianceNote:
      "Background discovery link only. It is not a live parcel source; verify parcel data with CSG.",
    sourceQuality: "weak_or_deprecated",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only as historical background for the CSG viewer; do not rely on it for current parcel evidence.",
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
    actionInstruction:
      "Open the SG document list and verify the registration division, erf and portion before saving a diagram as evidence.",
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
    actionInstruction:
      "Open DeedsWeb as the lawful registry entry point; search with verified parcel identifiers and attach only verified outputs.",
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
    userUsefulness: "secondary",
    actionInstruction:
      "Read the official process guidance before ordering or relying on deeds registry information.",
    confidence: "official_relevant",
    dossierGroup: "deeds-ownership",
    buildUrl: fixedUrl(GOVZA_DEEDS_GUIDANCE_URL),
  }),
  {
    id: "deeds-office-search",
    category: "deeds-ownership",
    name: "Deeds Office / DeedsWeb research",
    sourceType: "generated-search",
    defaultStatus: "open-search",
    missingStatus: "manual-check",
    reveals:
      "Backup web discovery for deeds registry guidance, offices, and lawful research paths.",
    requiredFields: ["erfNumber", "province"],
    actionLabel: "Manual search",
    complianceNote:
      "Generated search only. Ownership is not displayed unless a verified paid or official source is attached.",
    sourceQuality: "generated_search",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only if DeedsWeb or gov.za guidance is insufficient; verify any result before saving it.",
    confidence: "external_relevant",
    dossierGroup: "deeds-ownership",
    buildUrl: (ctx) => google(`${baseQuery(ctx)} Deeds Office DeedsWeb property ownership`),
  },
  {
    id: "windeed-lightstone-manual",
    category: "deeds-ownership",
    name: "Paid ownership and valuation report guidance",
    sourceType: "paid-provider",
    defaultStatus: "paid-report",
    reveals: "Paid ownership, transfer, bonds, and comparable-sales reports when ordered.",
    requiredFields: [],
    actionLabel: "Save report interest",
    complianceNote: "Paid provider data not yet attached.",
    confidence: "paid_report",
    dossierGroup: "paid-reports",
    userUsefulness: "hidden_by_default",
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
    actionInstruction:
      "Open the municipal valuation source, search by erf/portion or address, and save only a parcel-matched roll entry.",
    confidence: "official_relevant",
    dossierGroup: "municipal-evidence",
    buildUrl: (ctx) =>
      kougaLikely(ctx)
        ? KOUGA_VALUATION_ROLL_URL
        : google(`${ctx.parcel.municipality ?? ""} valuation roll ${baseQuery(ctx)}`),
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
    actionInstruction:
      "Open the Kouga ArcGIS hub, choose public map layers, and verify that any zoning or municipal layer matches the selected erf.",
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
    actionInstruction:
      "Open the Kouga public map, search or zoom to the erf, and confirm zoning or public layers manually.",
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
    actionInstruction:
      "Use this municipal department page to confirm planning, building-control, zoning or land-use process questions.",
    confidence: "official_relevant",
    dossierGroup: "planning-zoning",
    buildUrl: fixedUrl("https://www.kouga.gov.za/planning-and-development"),
  }),
  {
    id: "kouga-mapping-zoning",
    category: "zoning-land-use",
    name: "Municipal mapping and zoning portal",
    sourceType: "municipal",
    defaultStatus: "available",
    missingStatus: "open-search",
    reveals:
      "Municipal GIS layers, zoning viewer context, and public map overlays where available.",
    requiredFields: [],
    actionLabel: "Open map/search",
    complianceNote: "Confirm zoning with the municipality before relying on it.",
    userUsefulness: "secondary",
    actionInstruction:
      "Use as a manual zoning portal check; if a Google search opens, find the official municipal GIS result before relying on it.",
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
    actionLabel: "Manual search",
    complianceNote: "Generated public web search. Verify against the official municipal document.",
    userUsefulness: "secondary",
    actionInstruction:
      "Search for the official municipal land-use scheme PDF, then confirm the applicable zone and rules with the municipality.",
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
    actionLabel: "Manual search",
    complianceNote:
      "External searches may return nearby or unrelated results and must be verified manually.",
    userUsefulness: "secondary",
    actionInstruction:
      "Search for official notices using erf, municipality and suburb; save only notices that clearly match this parcel.",
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
    actionLabel: "Manual search",
    complianceNote:
      "Shown as research checks, not verified risk results unless evidence is attached.",
    userUsefulness: "secondary",
    actionInstruction:
      "Use this as a broad risk search, then verify any flood, wetland, heritage or geology clue in an official source.",
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
    userUsefulness: "secondary",
    actionInstruction:
      "Open the official environmental GIS entry point and check relevant layers near the parcel location.",
    confidence: "official_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl(DFFE_EGIS_URL),
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
    userUsefulness: "secondary",
    actionInstruction:
      "Use the coastal viewer for nearby coastal context only; do not treat it as parcel-specific risk without layer evidence.",
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
    sourceQuality: "weak_or_deprecated",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only if the main coastal viewer is unavailable; this is metadata, not parcel evidence.",
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
    userUsefulness: "secondary",
    actionInstruction:
      "Use for coastal vulnerability context, then verify parcel-specific risk against official layers or a specialist report.",
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
    sourceQuality: "weak_or_deprecated",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only as background reading; it is not a South African parcel risk source.",
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl(
      "https://www.digitalearthafrica.org/en_za/understanding-coastal-vulnerabilities-using-digital-earth-africas-decision-ready-products/",
    ),
  }),
  source({
    id: "sanbi-bgis",
    category: "environmental",
    name: "SANBI BGIS biodiversity datasets",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "South African biodiversity GIS datasets and map viewers for conservation context.",
    requiredFields: [],
    actionLabel: "Open BGIS",
    complianceNote:
      "Public biodiversity source. No parcel-specific biodiversity result is attached unless verified.",
    userUsefulness: "secondary",
    actionInstruction:
      "Open BGIS and search relevant biodiversity map viewers or datasets for the parcel area.",
    confidence: "external_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl(SANBI_BGIS_URL),
  }),
  source({
    id: "sahra-sahris",
    category: "environmental-heritage-risk",
    name: "SAHRA SAHRIS heritage system",
    sourceType: "official",
    defaultStatus: "available",
    reveals: "Official heritage resource and heritage management system entry point.",
    requiredFields: [],
    actionLabel: "Open SAHRIS",
    complianceNote:
      "Official heritage source. No heritage status is attached unless manually verified.",
    userUsefulness: "secondary",
    actionInstruction:
      "Search SAHRIS by place, suburb or coordinates and save only heritage records that clearly match the parcel area.",
    confidence: "official_relevant",
    dossierGroup: "environmental-coastal-risk",
    buildUrl: fixedUrl(SAHRA_SAHRIS_URL),
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
    actionLabel: "Manual search",
    complianceNote:
      "Generated Google site search. External listing results are unverified unless the user saves and confirms them.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Open the search, then match address, erf, suburb and agent details before saving any listing URL.",
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
    actionLabel: "Manual search",
    complianceNote:
      "Generated Google site search. External listing results are unverified unless the user saves and confirms them.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Open the search, then match address, erf, suburb and agent details before saving any listing URL.",
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
    actionLabel: "Manual search",
    complianceNote:
      "Generated search. Results may be nearby or unrelated and must be verified manually.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only as a broad discovery search; save nothing until the result clearly matches this parcel.",
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
    actionLabel: "Manual image search",
    complianceNote:
      "Generated public search. Results may be unrelated and must be verified manually.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only for visual clues. Do not copy images, and save only the source URL after manual verification.",
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
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Open the saved coordinates in Google Maps for access and surrounding context; it is not parcel ownership or valuation evidence.",
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
    actionLabel: "Manual search",
    complianceNote:
      "Contextual public research only. Do not treat search results as verified statistics.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only for broad area context, then verify any claim against a primary source before saving it.",
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
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use for access and road context only; verify infrastructure claims through official municipal or tender documents.",
    confidence: "external_relevant",
    dossierGroup: "market-intelligence",
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
    actionLabel: "Manual search",
    complianceNote:
      "POPIA-sensitive research. Do not infer personal ownership or distress without verified sources.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use only after you have a lawful research basis; do not save personal or distress claims without verified evidence.",
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
    actionLabel: "Manual search",
    complianceNote:
      "Generated public search. Confirm against official tender and municipal documents.",
    userUsefulness: "hidden_by_default",
    actionInstruction:
      "Use as optional area catalyst research; verify tenders, IDP or SDF references at the official source before saving.",
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
    name: "Lightstone Property Report",
    sourceType: "paid-provider",
    defaultStatus: "paid-report",
    reveals:
      "Future Lightstone property report action for valuation, comparable sales, ownership and market intelligence when connected.",
    requiredFields: [],
    actionLabel: "Save Lightstone interest",
    complianceNote: "Paid provider data not yet attached.",
    confidence: "paid_report",
    dossierGroup: "paid-reports",
  },
  {
    id: "windeed-property-report",
    category: "paid-reports",
    name: "WinDeed Property Report",
    sourceType: "paid-provider",
    defaultStatus: "paid-report",
    reveals:
      "Future WinDeed report action for deeds-office ownership, bonds and transfer history when connected.",
    requiredFields: [],
    actionLabel: "Save WinDeed interest",
    complianceNote: "Paid provider data not yet attached.",
    confidence: "paid_report",
    dossierGroup: "paid-reports",
  },
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
