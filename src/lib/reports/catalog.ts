// Report marketplace catalog. All reports currently generate mock payloads;
// "available: false" surfaces a "Coming Soon" button in the UI.

export type ReportType =
  | "property"
  | "ownership"
  | "valuation"
  | "comparables"
  | "transfers";

export interface ReportDef {
  id: ReportType;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  providerHint: string;
  estTurnaround: string;
}

export const REPORT_CATALOG: ReportDef[] = [
  {
    id: "property",
    name: "Property Report",
    description: "Full property snapshot — characteristics, zoning, valuation, neighbourhood context.",
    priceCents: 19900,
    available: true,
    providerHint: "Demo + Municipal GIS",
    estTurnaround: "Instant (mock)",
  },
  {
    id: "ownership",
    name: "Ownership Report",
    description: "Current registered owner, ownership type, holding period, related entities (when connected).",
    priceCents: 14900,
    available: false,
    providerHint: "Requires WinDeed integration",
    estTurnaround: "Real-time once connected",
  },
  {
    id: "valuation",
    name: "Valuation Report",
    description: "AVM market estimate, confidence interval, comparable benchmark range.",
    priceCents: 24900,
    available: false,
    providerHint: "Requires Lightstone integration",
    estTurnaround: "Real-time once connected",
  },
  {
    id: "comparables",
    name: "Comparable Sales Report",
    description: "Closest comparable transfers in the last 24 months, with price-per-m² normalisation.",
    priceCents: 17900,
    available: true,
    providerHint: "Demo dataset",
    estTurnaround: "Instant (mock)",
  },
  {
    id: "transfers",
    name: "Transfer History Report",
    description: "Full deeds-office transfer chain for the parcel, including consideration and deed references.",
    priceCents: 12900,
    available: false,
    providerHint: "Requires WinDeed integration",
    estTurnaround: "Real-time once connected",
  },
];

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}
