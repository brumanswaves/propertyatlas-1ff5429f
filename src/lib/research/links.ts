// Build outbound public-search URLs for property research.
// All links target third-party search interfaces — no scraping, no copied data.

export interface ResearchContext {
  address?: string;       // e.g. "14 Marina Dr"
  area?: string;          // e.g. "St Francis Bay"
  town?: string;          // e.g. "St Francis Bay"
  suburb?: string;
  municipality?: string;  // e.g. "Kouga Local Municipality"
  province?: string;      // e.g. "Eastern Cape"
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
    ? [ctx.address, erfStr, ctx.suburb ?? ctx.area, ctx.town, ctx.province ?? "Eastern Cape", "South Africa"]
    : [erfStr, ctx.nearestRoad, ctx.suburb ?? ctx.area, ctx.town, ctx.province ?? "Eastern Cape", "South Africa"];
  const parts = order.filter((s) => s && String(s).trim().length > 0) as string[];
  return Array.from(new Set(parts)).join(" ");
}

/** Listing-targeted query: research query + "property for sale". */
export function buildListingQuery(ctx: ResearchContext): string {
  return `${buildResearchQuery(ctx)} property for sale`;
}

function isKouga(ctx: ResearchContext): boolean {
  const muni = (ctx.municipality ?? "").toLowerCase();
  const town = (ctx.town ?? ctx.area ?? "").toLowerCase();
  return (
    muni.includes("kouga") ||
    /st\s*francis|cape st francis|santareme|sea vista|st francis links|jeffreys|humansdorp|oyster bay/.test(town)
  );
}

export type ResearchCategory = "maps" | "listings" | "official" | "documents" | "general";

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
      href: ll ? `https://maps.google.com/?q=${q(ll)}` : `https://www.google.com/maps/search/?api=1&query=${q(query)}`,
      category: "maps", external: true,
    },
    {
      id: "streetview",
      label: "Google Street View",
      description: "Walk down the street virtually.",
      href: ll
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q(ll)}`
        : `https://www.google.com/maps/search/?api=1&query=${q(query)}`,
      category: "maps", external: true,
    },
    {
      id: "csg-viewer",
      label: "CSG Property Viewer",
      description: "Official Chief Surveyor-General cadastral viewer.",
      href: ll ? `https://csggis.drdlr.gov.za/psv/?lng=${ctx.lng}&lat=${ctx.lat}` : `https://csggis.drdlr.gov.za/psv/`,
      category: "maps", external: true,
    },
    ...(inKouga
      ? [{
          id: "kouga-mapping-quick",
          label: "Kouga Public Map",
          description: "Kouga ArcGIS Hub public mapping viewer.",
          href: "https://mapping-kouga.hub.arcgis.com/",
          category: "maps" as const, external: true as const,
        }]
      : []),
  ];

  const official: ResearchLink[] = inKouga
    ? [
        { id: "kouga-portal", label: "Kouga Municipality", description: "Official Kouga Local Municipality website.",
          href: "https://www.kouga.gov.za/", category: "official", external: true },
        { id: "kouga-mapping", label: "Kouga Mapping Portal", description: "Public ArcGIS Hub for Kouga GIS layers (zoning, planning).",
          href: "https://mapping-kouga.hub.arcgis.com/", category: "official", external: true },
        { id: "kouga-planning", label: "Kouga Planning & Development", description: "Zoning, town planning and building plan information.",
          href: "https://www.kouga.gov.za/planning-and-development", category: "official", external: true },
        { id: "kouga-valroll", label: "Kouga Valuation Roll", description: "Public valuation roll notices and access.",
          href: "https://www.kouga.gov.za/municipalvaluationrollavail", category: "official", external: true },
      ]
    : [
        { id: "valuation-roll", label: "Municipal valuation roll", description: "Search the municipality's published valuation roll.",
          href: `https://www.google.com/search?q=${q(`"valuation roll" ${ctx.municipality ?? ""} site:gov.za`)}`,
          category: "official", external: true },
        { id: "muni-gis", label: "Municipal GIS / zoning portal", description: "Find the relevant municipal GIS or zoning viewer.",
          href: `https://www.google.com/search?q=${q(`${ctx.municipality ?? ""} GIS zoning portal`)}`,
          category: "official", external: true },
      ];

  const general: ResearchLink[] = [
    {
      id: "google",
      label: "Google web search",
      description: "General web search for this property.",
      href: `https://www.google.com/search?q=${q(query)}`,
      category: "general", external: true,
    },
  ];

  // Listings and official-document buttons are intentionally excluded here.
  // Listings live in the Listings tab; SG documents live in Overview/Reports.
  return [...maps, ...official, ...general];
}

// ===== Listings (Google site-search; no scraping) =====

export interface ListingSearchLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

export function buildListingResearchLinks(ctx: ResearchContext): ListingSearchLink[] {
  const query = buildListingQuery(ctx);
  const site = (domain: string) => `https://www.google.com/search?q=${q(`site:${domain} ${query}`)}`;
  return [
    { id: "property24",      label: "Search Property24 via Google",       description: "Google site search on property24.com.",       href: site("property24.com") },
    { id: "privateproperty", label: "Search Private Property via Google", description: "Google site search on privateproperty.co.za.", href: site("privateproperty.co.za") },
    { id: "pamgolding",      label: "Search Pam Golding via Google",      description: "Google site search on pamgolding.co.za.",      href: site("pamgolding.co.za") },
    { id: "seeff",           label: "Search Seeff via Google",            description: "Google site search on seeff.com.",             href: site("seeff.com") },
    { id: "remax",           label: "Search RE/MAX via Google",           description: "Google site search on remax.co.za.",           href: site("remax.co.za") },
    { id: "rawson",          label: "Search Rawson via Google",           description: "Google site search on rawson.co.za.",          href: site("rawson.co.za") },
    { id: "google-listings", label: "Search all web listings",            description: "General Google search for active listings.",
      href: `https://www.google.com/search?q=${q(query)}` },
  ];
}

// Legacy export kept for backwards compatibility with any older callers.
export const LISTING_SITES = [
  { id: "property24",      label: "Property24",       url: (a: string) => `https://www.google.com/search?q=${q(`site:property24.com ${a}`)}` },
  { id: "privateproperty", label: "Private Property", url: (a: string) => `https://www.google.com/search?q=${q(`site:privateproperty.co.za ${a}`)}` },
  { id: "pamgolding",      label: "Pam Golding",      url: (a: string) => `https://www.google.com/search?q=${q(`site:pamgolding.co.za ${a}`)}` },
  { id: "seeff",           label: "Seeff",            url: (a: string) => `https://www.google.com/search?q=${q(`site:seeff.com ${a}`)}` },
  { id: "remax",           label: "RE/MAX",           url: (a: string) => `https://www.google.com/search?q=${q(`site:remax.co.za ${a}`)}` },
  { id: "rawson",          label: "Rawson",           url: (a: string) => `https://www.google.com/search?q=${q(`site:rawson.co.za ${a}`)}` },
  { id: "google-listings", label: "Google search",    url: (a: string) => `https://www.google.com/search?q=${q(`${a} property for sale`)}` },
];

export function listingSearchAddress(ctx: ResearchContext): string {
  return [ctx.address, ctx.area ?? ctx.suburb, ctx.town].filter(Boolean).join(" ");
}
