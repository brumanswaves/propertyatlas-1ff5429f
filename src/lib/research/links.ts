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
  lng?: number;
  lat?: number;
}

const q = (s: string) => encodeURIComponent(s.trim());

function fullAddress(ctx: ResearchContext): string {
  return [ctx.address, ctx.suburb ?? ctx.area, ctx.town, ctx.province, "South Africa"]
    .filter(Boolean).join(", ");
}

export interface ResearchLink {
  id: string;
  label: string;
  description: string;
  href: string;
  category: "maps" | "listings" | "official" | "deeds" | "general";
  external: true;
}

export function buildResearchLinks(ctx: ResearchContext): ResearchLink[] {
  const addr = fullAddress(ctx);
  const ll = ctx.lat != null && ctx.lng != null ? `${ctx.lat},${ctx.lng}` : null;
  const erfStr = ctx.erf ? `erf ${ctx.erf}` : "";
  const muni = ctx.municipality ?? "";

  return [
    {
      id: "gmaps",
      label: "Google Maps",
      description: "View location, surroundings, nearby amenities.",
      href: ll
        ? `https://www.google.com/maps/search/?api=1&query=${q(ll)}`
        : `https://www.google.com/maps/search/?api=1&query=${q(addr)}`,
      category: "maps", external: true,
    },
    {
      id: "streetview",
      label: "Google Street View",
      description: "Walk down the street virtually.",
      href: ll
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q(ll)}`
        : `https://www.google.com/maps?q=${q(addr)}&layer=c`,
      category: "maps", external: true,
    },
    {
      id: "property24",
      label: "Property24 search",
      description: "Look up active listings on Property24.",
      href: `https://www.property24.com/search?q=${q(addr)}`,
      category: "listings", external: true,
    },
    {
      id: "privateproperty",
      label: "Private Property search",
      description: "Look up active listings on Private Property.",
      href: `https://www.privateproperty.co.za/search?search=${q(addr)}`,
      category: "listings", external: true,
    },
    {
      id: "valuation-roll",
      label: "Municipal valuation roll",
      description: "Search the municipality's published valuation roll.",
      href: `https://www.google.com/search?q=${q(`"valuation roll" ${muni} site:gov.za`)}`,
      category: "official", external: true,
    },
    {
      id: "muni-gis",
      label: "Municipal GIS / zoning portal",
      description: "Find the relevant municipal GIS or zoning viewer.",
      href: `https://www.google.com/search?q=${q(`${muni} GIS zoning portal`)}`,
      category: "official", external: true,
    },
    {
      id: "surveyor-general",
      label: "Surveyor-General search",
      description: "Locate the SG diagram for this property.",
      href: `https://csg.drdlr.gov.za/`,
      category: "official", external: true,
    },
    {
      id: "windeed",
      label: "WinDeed search",
      description: "Deeds Office search via WinDeed (account required).",
      href: `https://www.windeed.co.za/`,
      category: "deeds", external: true,
    },
    {
      id: "lightstone",
      label: "Lightstone reports",
      description: "Property report and AVM provider.",
      href: `https://www.lightstone.co.za/`,
      category: "deeds", external: true,
    },
    {
      id: "deeds-office",
      label: "Deeds Office information",
      description: "DALRRD Deeds Registration general information.",
      href: `https://www.gov.za/services/deeds-registration`,
      category: "deeds", external: true,
    },
    {
      id: "google",
      label: "Google search",
      description: "General web search for this property.",
      href: `https://www.google.com/search?q=${q(`${addr} ${erfStr}`)}`,
      category: "general", external: true,
    },
  ];
}

export const LISTING_SITES = [
  { id: "property24",      label: "Property24",      url: (a: string) => `https://www.property24.com/search?q=${q(a)}` },
  { id: "privateproperty", label: "Private Property", url: (a: string) => `https://www.privateproperty.co.za/search?search=${q(a)}` },
  { id: "pamgolding",      label: "Pam Golding",     url: (a: string) => `https://www.pamgolding.co.za/property-search/properties-for-sale?searchTerm=${q(a)}` },
  { id: "seeff",           label: "Seeff",           url: (a: string) => `https://www.seeff.com/results/residential/for-sale/?search=${q(a)}` },
  { id: "remax",           label: "RE/MAX",          url: (a: string) => `https://www.remax.co.za/property-for-sale/?search=${q(a)}` },
  { id: "rawson",          label: "Rawson",          url: (a: string) => `https://www.rawson.co.za/results?keyword=${q(a)}` },
  { id: "google-listings", label: "Google search",   url: (a: string) => `https://www.google.com/search?q=${q(`"for sale" ${a}`)}` },
];

export function listingSearchAddress(ctx: ResearchContext): string {
  return [ctx.address, ctx.area ?? ctx.suburb, ctx.town].filter(Boolean).join(" ");
}
