// Build outbound public-search URLs for property research.
// All links target third-party search interfaces — no scraping, no copied data.
import {
  CSG_OFFICIAL_URL,
  CSG_VIEWER_URL,
  KOUGA_MAPPING_URL,
  KOUGA_PUBLIC_MAP_URL,
  LISTING_PORTALS,
} from "@/lib/external-urls";
void KOUGA_PUBLIC_MAP_URL;

export interface ResearchContext {
  address?: string; // e.g. "14 Marina Dr"
  area?: string; // e.g. "St Francis Bay"
  town?: string; // e.g. "St Francis Bay"
  suburb?: string;
  municipality?: string; // e.g. "Kouga Local Municipality"
  province?: string; // e.g. "Eastern Cape"
  erf?: string;
  nearestRoad?: string;
  lng?: number;
  lat?: number;
}

const q = (s: string) => encodeURIComponent(s.trim());

/** Best available research query — never empty. Erf-first by default. */
export function buildResearchQuery(ctx: ResearchContext): string {
  const erfStr = ctx.erf ? `Erf ${ctx.erf}` : "";
  const order = ctx.address
    ? [
        ctx.address,
        erfStr,
        ctx.suburb ?? ctx.area,
        ctx.town,
        ctx.province ?? "Eastern Cape",
        "South Africa",
      ]
    : [
        erfStr,
        ctx.nearestRoad,
        ctx.suburb ?? ctx.area,
        ctx.town,
        ctx.province ?? "Eastern Cape",
        "South Africa",
      ];
  const parts = order.filter((s) => s && String(s).trim().length > 0) as string[];
  return Array.from(new Set(parts)).join(" ");
}

/** Listing-targeted query: research query + "property for sale". */
export function buildListingQuery(ctx: ResearchContext): string {
  return `${buildResearchQuery(ctx)} property for sale`;
}

/** Plain copy-paste search phrase for manual listing searches.
 *  e.g. "Erf 962 Lovemore Crescent Sea Vista Humansdorp Eastern Cape South Africa" */
export function buildSearchPhrase(ctx: ResearchContext): string {
  const erfStr = ctx.erf ? `Erf ${ctx.erf}` : "";
  const order = [
    erfStr,
    ctx.nearestRoad,
    ctx.suburb ?? ctx.area,
    ctx.town,
    ctx.province ?? "Eastern Cape",
    "South Africa",
  ];
  const parts = order.filter((s) => s && String(s).trim().length > 0) as string[];
  return Array.from(new Set(parts)).join(" ");
}

function isKouga(ctx: ResearchContext): boolean {
  const muni = (ctx.municipality ?? "").toLowerCase();
  const town = (ctx.town ?? ctx.area ?? "").toLowerCase();
  return (
    muni.includes("kouga") ||
    /st\s*francis|cape st francis|santareme|sea vista|st francis links|jeffreys|humansdorp|oyster bay/.test(
      town,
    )
  );
}

export type ResearchCategory =
  | "maps"
  | "listings"
  | "municipal"
  | "official"
  | "documents"
  | "general";

export interface ResearchLink {
  id: string;
  label: string;
  description: string;
  href: string;
  category: ResearchCategory;
  external: true;
}

export function buildResearchLinks(ctx: ResearchContext): ResearchLink[] {
  const hasLL = ctx.lat != null && ctx.lng != null;
  const ll = hasLL ? `${ctx.lat},${ctx.lng}` : null;
  const inKouga = isKouga(ctx);
  const query = buildResearchQuery(ctx);

  const maps: ResearchLink[] = [
    {
      id: "gmaps",
      label: "Google Maps",
      description: "View location, surroundings, nearby amenities.",
      href: ll
        ? `https://maps.google.com/?q=${q(ll)}`
        : `https://www.google.com/maps/search/?api=1&query=${q(query)}`,
      category: "maps",
      external: true,
    },
    {
      id: "streetview",
      label: "Google Street View",
      description: "Walk down the street virtually.",
      href: ll
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q(ll)}`
        : `https://www.google.com/maps/search/?api=1&query=${q(query)}`,
      category: "maps",
      external: true,
    },
    {
      id: "csg-viewer",
      label: "CSG Property Viewer",
      description: "Official Chief Surveyor-General Experience Builder viewer.",
      href: CSG_VIEWER_URL,
      category: "maps",
      external: true,
    },
    ...(inKouga
      ? [
          {
            id: "kouga-mapping-quick",
            label: "Kouga Public Map",
            description: "Kouga ArcGIS Hub public mapping viewer.",
            href: KOUGA_PUBLIC_MAP_URL,
            category: "maps" as const,
            external: true as const,
          },
          {
            id: "kouga-mapping-hub",
            label: "Kouga Mapping Portal",
            description: "Kouga ArcGIS Hub — zoning, planning, public layers.",
            href: KOUGA_MAPPING_URL,
            category: "maps" as const,
            external: true as const,
          },
        ]
      : []),
  ];

  const municipal: ResearchLink[] = inKouga
    ? [
        {
          id: "kouga-portal",
          label: "Kouga Municipality",
          description: "Official Kouga Local Municipality website.",
          href: "https://www.kouga.gov.za/",
          category: "municipal",
          external: true,
        },
        {
          id: "kouga-planning",
          label: "Kouga Planning & Development",
          description: "Zoning, town planning and building plan information.",
          href: "https://www.kouga.gov.za/planning-and-development",
          category: "municipal",
          external: true,
        },
        {
          id: "kouga-valroll",
          label: "Kouga Valuation Roll",
          description:
            "Official municipal valuation-roll notice. Search the document library or roll by erf/address after opening.",
          href: "https://www.kouga.gov.za/municipalvaluationrollavail",
          category: "municipal",
          external: true,
        },
      ]
    : [
        {
          id: "valuation-roll",
          label: "Manual valuation roll search",
          description:
            "Generated search for the municipality's valuation roll. Verify any result on the official municipal site.",
          href: `https://www.google.com/search?q=${q(`"valuation roll" ${ctx.municipality ?? ""} site:gov.za`)}`,
          category: "municipal",
          external: true,
        },
        {
          id: "muni-gis",
          label: "Manual municipal GIS/zoning search",
          description: "Generated search for an official municipal GIS or zoning viewer.",
          href: `https://www.google.com/search?q=${q(`${ctx.municipality ?? ""} GIS zoning portal`)}`,
          category: "municipal",
          external: true,
        },
      ];

  const official: ResearchLink[] = [
    {
      id: "csg-official",
      label: "CSG Official Site",
      description: "Chief Surveyor-General official home — always-available fallback.",
      href: CSG_OFFICIAL_URL,
      category: "official",
      external: true,
    },
  ];

  const general: ResearchLink[] = [
    {
      id: "google",
      label: "Broad manual web search",
      description:
        "Generated web search. Treat results as unverified until they match this property.",
      href: `https://www.google.com/search?q=${q(query)}`,
      category: "general",
      external: true,
    },
  ];

  // Listings and official-document buttons are intentionally excluded here.
  // Listings live in the Listings tab; SG documents live in Overview/Reports.
  return [...maps, ...municipal, ...official, ...general];
}

// ===== Listings (open the portal home; let the user search manually) =====

export interface ListingSearchLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface MarketEvidenceWorkflow {
  searchPhrase: string;
  exactSearch: string;
  areaSearch: string;
  broadSearch: string;
  streetSearch?: string;
  instruction: string;
  portals: ListingSearchLink[];
}

/** Returns links that open each portal's home page so users can search manually. */
export function buildListingResearchLinks(ctx: ResearchContext): ListingSearchLink[] {
  const coords = ctx.lat != null && ctx.lng != null ? `${ctx.lat},${ctx.lng}` : null;
  const broad = buildBroadListingSearch(ctx);
  return [
    ...LISTING_PORTALS.map((p) => ({
      id: p.id,
      label: `Open ${p.label}`,
      description: `Open ${p.label}, paste the search phrase, then save only matching listing URLs.`,
      href: p.url,
    })),
    {
      id: "google-maps",
      label: "Open Google Maps nearby",
      description: "Open the selected parcel area in Google Maps for nearby streets and amenities.",
      href: coords
        ? `https://maps.google.com/?q=${encodeURIComponent(coords)}`
        : `https://www.google.com/maps/search/${encodeURIComponent(broad)}`,
    },
    {
      id: "google-web",
      label: "Open Google web search",
      description: "Open a broad web search. Verify every result manually before saving it.",
      href: `https://www.google.com/search?q=${encodeURIComponent(broad)}`,
    },
  ];
}

function uniqueParts(parts: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(parts.map((part) => String(part ?? "").trim()).filter((part) => part.length > 0)),
  );
}

export function buildExactListingSearch(ctx: ResearchContext): string {
  const erf = ctx.erf ? `Erf ${ctx.erf}` : "";
  return uniqueParts([erf, ctx.suburb ?? ctx.area, ctx.town, ctx.municipality]).join(" ");
}

export function buildStreetListingSearch(ctx: ResearchContext): string {
  return uniqueParts([ctx.address ?? ctx.nearestRoad, ctx.suburb ?? ctx.area, ctx.town]).join(" ");
}

export function buildAreaListingSearch(ctx: ResearchContext): string {
  return uniqueParts([ctx.suburb ?? ctx.area, ctx.town, ctx.province ?? "Eastern Cape"]).join(" ");
}

export function buildBroadListingSearch(ctx: ResearchContext): string {
  const context = uniqueParts([ctx.suburb, ctx.area, ctx.town, ctx.municipality, ctx.province])
    .join(" ")
    .toLowerCase();
  const kougaTerms = [
    "St Francis Bay property for sale",
    "Cape St Francis property for sale",
    "Sea Vista property for sale",
    "Humansdorp property for sale",
  ];
  if (/kouga|st\s*francis|cape st francis|sea vista|santareme|humansdorp/.test(context)) {
    return kougaTerms.join(" OR ");
  }
  const area = buildAreaListingSearch(ctx);
  return area ? `${area} property for sale` : "South Africa coastal property for sale";
}

export function buildMarketEvidenceWorkflow(ctx: ResearchContext): MarketEvidenceWorkflow {
  const exactSearch = buildExactListingSearch(ctx);
  const streetSearch = buildStreetListingSearch(ctx);
  const areaSearch = buildAreaListingSearch(ctx);
  const broadSearch = buildBroadListingSearch(ctx);
  return {
    searchPhrase:
      exactSearch || streetSearch || areaSearch || broadSearch || buildSearchPhrase(ctx),
    exactSearch,
    streetSearch,
    areaSearch,
    broadSearch,
    instruction: "Open the portal, paste/search the phrase, then save only matching listing URLs.",
    portals: buildListingResearchLinks(ctx),
  };
}

// Legacy export kept for backwards compatibility with any older callers.
export const LISTING_SITES = LISTING_PORTALS.map((p) => ({
  id: p.id,
  label: p.label,
  url: (_a: string) => p.url,
}));

export function listingSearchAddress(ctx: ResearchContext): string {
  return [ctx.address, ctx.area ?? ctx.suburb, ctx.town].filter(Boolean).join(" ");
}
