// Report marketplace catalog. Only Lightstone Property Report runs the
// placeholder order flow today; others are tagged Coming Soon until their
// underlying provider integration is wired.

export type ReportType =
  | "lightstone_property"
  | "lightstone_seller"
  | "windeed_property"
  | "windeed_avm"
  | "sg_diagram";

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
    id: "lightstone_property",
    name: "Lightstone Property Report",
    description: "Comprehensive property snapshot — owner, valuation band, sales history, comparable transfers.",
    priceCents: 29900,
    available: true,
    providerHint: "Lightstone",
    estTurnaround: "Real-time once provider is connected",
  },
  {
    id: "lightstone_seller",
    name: "Lightstone Property Value Seller Report",
    description: "Seller-focused AVM with suggested asking range and recent comparable activity.",
    priceCents: 19900,
    available: false,
    providerHint: "Lightstone",
    estTurnaround: "Real-time once connected",
  },
  {
    id: "windeed_property",
    name: "WinDeed Property Report",
    description: "Deeds-office property report including registered owner and bond information.",
    priceCents: 24900,
    available: false,
    providerHint: "WinDeed",
    estTurnaround: "Real-time once connected",
  },
  {
    id: "windeed_avm",
    name: "WinDeed Automated Valuation Report",
    description: "Automated valuation model output sourced via WinDeed.",
    priceCents: 17900,
    available: false,
    providerHint: "WinDeed",
    estTurnaround: "Real-time once connected",
  },
  {
    id: "sg_diagram",
    name: "Surveyor-General Diagram",
    description: "Official SG diagram for the registered parcel.",
    priceCents: 14900,
    available: false,
    providerHint: "Surveyor-General",
    estTurnaround: "Manual lookup",
  },
];

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}
