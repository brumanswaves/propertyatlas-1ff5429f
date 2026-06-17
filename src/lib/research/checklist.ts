// Fixed 10-item due-diligence checklist used in the Notes tab.

export interface ChecklistItem {
  id: string;
  label: string;
}

export const DUE_DILIGENCE: ChecklistItem[] = [
  { id: "ownership",        label: "Verify ownership" },
  { id: "zoning",           label: "Check zoning" },
  { id: "muni_valuation",   label: "Check municipal valuation" },
  { id: "rates",            label: "Check rates" },
  { id: "servitudes",       label: "Check servitudes" },
  { id: "risk",             label: "Check flood / fire risk" },
  { id: "comparables",      label: "Check recent comparable sales" },
  { id: "active_listings",  label: "Check active listings" },
  { id: "report",           label: "Order property report" },
  { id: "transfers",        label: "Review transfer history" },
];
