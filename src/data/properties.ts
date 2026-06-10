// Mock property data for the St Francis Bay pilot region.
// Coordinates are in a normalized 0-1000 grid for the SVG map canvas.

export type PropertyType =
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Agricultural"
  | "Vacant Land";

export type OwnershipType = "Individual" | "Trust" | "Company";

export interface ParcelPolygon {
  // points in the 0..1000 grid
  points: [number, number][];
}

export interface PropertyScores {
  investor: number;
  development: number;
  liquidity: number;
  coastal: number;
  walkability: number;
}

export interface SaleRecord {
  date: string; // ISO
  price: number;
}

export interface OwnershipRecord {
  type: OwnershipType;
  ownerLabel: string;
  since: string; // ISO
}

export interface TimelineEvent {
  date: string;
  title: string;
  kind: "transfer" | "renovation" | "rezoning" | "listing" | "valuation";
}

export interface Property {
  id: string;
  erf: string;
  area:
    | "St Francis Bay"
    | "Cape St Francis"
    | "Santareme"
    | "Port St Francis"
    | "Oyster Bay";
  street: string;
  type: PropertyType;
  sizeSqm: number;
  estimatedValue: number;
  municipalValue: number;
  confidence: number; // 0..1
  scores: PropertyScores;
  ownership: OwnershipRecord;
  sales: SaleRecord[];
  timeline: TimelineEvent[];
  features: {
    beachfront: boolean;
    oceanView: boolean;
    walkingDistanceToBeach: boolean;
    cornerLot: boolean;
  };
  parcel: ParcelPolygon;
  centroid: [number, number]; // grid coords
}

const AREAS = ["St Francis Bay", "Cape St Francis", "Santareme", "Port St Francis", "Oyster Bay"] as const;
const TYPES: PropertyType[] = ["Residential", "Vacant Land", "Commercial", "Residential", "Residential", "Agricultural"];
const STREETS = ["Lyme Rd", "Da Gama Rd", "Marina Dr", "Anchorage Rd", "Pelican St", "Otter Way", "Sea Vista", "Beach Rd", "Sunset Cl", "Harbour Ln"];

function seeded(i: number): number {
  // deterministic pseudo-random
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function makeParcel(cx: number, cy: number, w: number, h: number): ParcelPolygon {
  return {
    points: [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ],
  };
}

function fmtZAR(n: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
}

export const formatZAR = fmtZAR;

function generateProperties(): Property[] {
  const out: Property[] = [];
  // Grid of parcels with slight jitter
  const cols = 12;
  const rows = 10;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      idx++;
      const jitterX = (seeded(idx) - 0.5) * 18;
      const jitterY = (seeded(idx + 7) - 0.5) * 18;
      const cx = 90 + c * 70 + jitterX;
      const cy = 120 + r * 65 + jitterY;
      // Skip parcels in "ocean" region (top-right corner)
      if (cx > 820 && cy < 280) continue;
      // Skip parcels in coast band
      if (cy > 820) continue;
      const w = 48 + seeded(idx + 1) * 16;
      const h = 44 + seeded(idx + 2) * 14;
      const type = TYPES[Math.floor(seeded(idx + 3) * TYPES.length)];
      const area = AREAS[Math.floor(seeded(idx + 4) * AREAS.length)];
      const sizeSqm = Math.round(450 + seeded(idx + 5) * 1800);
      const baseValue =
        type === "Vacant Land"
          ? 800_000 + seeded(idx + 6) * 2_500_000
          : type === "Commercial"
            ? 4_500_000 + seeded(idx + 6) * 9_000_000
            : type === "Agricultural"
              ? 2_200_000 + seeded(idx + 6) * 4_000_000
              : 2_100_000 + seeded(idx + 6) * 6_400_000;
      const beachfront = cx > 700 && seeded(idx + 8) > 0.7;
      const oceanView = beachfront || (cx > 600 && seeded(idx + 9) > 0.55);
      const valueAdj = (beachfront ? 1.9 : 1) * (oceanView ? 1.25 : 1);
      const est = Math.round(baseValue * valueAdj);
      const muni = Math.round(est * (0.55 + seeded(idx + 10) * 0.25));
      const lastSaleYear = 2014 + Math.floor(seeded(idx + 11) * 11);
      const lastSalePrice = Math.round(est * (0.55 + seeded(idx + 12) * 0.35));
      const owner: OwnershipType = seeded(idx + 13) > 0.75 ? "Trust" : seeded(idx + 13) > 0.45 ? "Company" : "Individual";
      out.push({
        id: `parcel-${idx}`,
        erf: `${1200 + idx}`,
        area,
        street: `${10 + (idx % 90)} ${STREETS[idx % STREETS.length]}`,
        type,
        sizeSqm,
        estimatedValue: est,
        municipalValue: muni,
        confidence: 0.72 + seeded(idx + 14) * 0.25,
        scores: {
          investor: Math.round(40 + seeded(idx + 15) * 60),
          development: Math.round(30 + seeded(idx + 16) * 65),
          liquidity: Math.round(35 + seeded(idx + 17) * 60),
          coastal: beachfront ? 95 : oceanView ? 78 : Math.round(20 + seeded(idx + 18) * 50),
          walkability: Math.round(30 + seeded(idx + 19) * 65),
        },
        ownership: {
          type: owner,
          ownerLabel:
            owner === "Trust"
              ? `The ${["Marina", "Atlantic", "Cape", "Pelican", "Dune"][idx % 5]} Family Trust`
              : owner === "Company"
                ? `${["Coastal", "Atlas", "Horizon", "Anchor", "Tideline"][idx % 5]} Holdings (Pty) Ltd`
                : `${["J", "M", "R", "S", "T"][idx % 5]}. ${["Bekker", "Naidoo", "Mokoena", "van der Merwe", "Patel"][idx % 5]}`,
          since: `${2008 + Math.floor(seeded(idx + 20) * 14)}-${String(1 + Math.floor(seeded(idx + 21) * 12)).padStart(2, "0")}-12`,
        },
        sales: [
          { date: `${lastSaleYear}-06-14`, price: lastSalePrice },
          { date: `${lastSaleYear - 6}-03-22`, price: Math.round(lastSalePrice * 0.62) },
        ],
        timeline: [
          { date: `${lastSaleYear}-06-14`, title: "Transferred to current owner", kind: "transfer" },
          { date: `${lastSaleYear - 2}-09-01`, title: "Municipal revaluation", kind: "valuation" },
          { date: `${lastSaleYear - 6}-03-22`, title: "Previous transfer", kind: "transfer" },
        ],
        features: {
          beachfront,
          oceanView,
          walkingDistanceToBeach: cx > 560,
          cornerLot: seeded(idx + 22) > 0.82,
        },
        parcel: makeParcel(cx, cy, w, h),
        centroid: [cx, cy],
      });
    }
  }
  return out;
}

export const PROPERTIES: Property[] = generateProperties();

export function getProperty(id: string): Property | undefined {
  return PROPERTIES.find((p) => p.id === id);
}
