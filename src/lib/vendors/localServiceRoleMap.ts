/**
 * Maps a local-services search category (src/lib/localServices/catalog.ts)
 * onto the closest vendor role/trade category, so a Google search result can
 * be saved straight into the vendor directory with a sensible role.
 */
import type { VendorRole } from "./types";

const CATEGORY_TO_ROLE: Record<string, VendorRole> = {
  "land-surveyors": "land-surveyor",
  "architects-draughtspersons": "architect",
  "builders-contractors": "builder",
  "town-planners": "town-planner",
  engineers: "engineer",
  "quantity-surveyors": "other",
  "insurance-brokers": "other",
  "property-inspectors": "other",
  "security-companies": "other",
  electricians: "other",
  plumbers: "other",
  "solar-backup-power": "other",
  "garden-maintenance": "other",
  "fibre-internet": "other",
  "tv-dstv": "other",
  "water-tanks-pumps-boreholes": "other",
  "electricity-connections": "other",
  "municipal-water-electricity": "other",
  "waste-refuse": "environmental",
  "estate-agents": "estate-agent",
  "conveyancers-attorneys": "conveyancer",
  "bond-finance": "other",
  "rental-property-managers": "other",
  "movers-storage": "other",
  "property-valuers": "valuation",
};

export function vendorRoleForLocalServiceCategory(categoryId: string): VendorRole {
  return CATEGORY_TO_ROLE[categoryId] ?? "other";
}
