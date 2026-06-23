// Normal user report actions. Keep this small until provider integrations are live.

export type ReportType = "lightstone_property" | "windeed_property" | "sg_diagram";

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
    description:
      "Coming soon: valuation, comparable sales, ownership and market intelligence when the Lightstone provider is connected.",
    priceCents: 0,
    available: false,
    providerHint: "Lightstone",
    estTurnaround: "Coming soon / save interest",
  },
  {
    id: "windeed_property",
    name: "WinDeed Property Report",
    description:
      "Coming soon: deeds-office ownership, bonds and transfer history when the WinDeed provider is connected.",
    priceCents: 0,
    available: false,
    providerHint: "WinDeed",
    estTurnaround: "Coming soon / save interest",
  },
  {
    id: "sg_diagram",
    name: "SG Document List",
    description: "Official Surveyor-General document list when a direct CSG URL can be built.",
    priceCents: 0,
    available: false,
    providerHint: "Chief Surveyor-General",
    estTurnaround: "Official public source",
  },
];

export function formatPrice(cents: number) {
  if (cents <= 0) return "Coming soon";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
