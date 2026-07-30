/**
 * Vendor workspace types.
 *
 * Two separate typed models, per the product spec:
 *  - `Vendor`  — a reusable, user-scoped directory record ("my vendors").
 *  - `VendorAssignment` — a property-scoped record linking a vendor to a
 *    specific parcel with status/quote/follow-up detail.
 *
 * Keeping these separate means assigning an existing vendor to a new
 * property never duplicates the vendor record itself.
 */

export type VendorRole =
  | "town-planner"
  | "architect"
  | "builder"
  | "land-surveyor"
  | "conveyancer"
  | "engineer"
  | "estate-agent"
  | "valuation"
  | "environmental"
  | "other";

export const VENDOR_ROLES: { id: VendorRole; label: string }[] = [
  { id: "town-planner", label: "Town planner" },
  { id: "architect", label: "Architect" },
  { id: "builder", label: "Builder" },
  { id: "land-surveyor", label: "Land surveyor" },
  { id: "conveyancer", label: "Conveyancer" },
  { id: "engineer", label: "Engineer" },
  { id: "estate-agent", label: "Estate agent" },
  { id: "valuation", label: "Valuation" },
  { id: "environmental", label: "Environmental" },
  { id: "other", label: "Other" },
];

export function vendorRoleLabel(role: VendorRole): string {
  return VENDOR_ROLES.find((entry) => entry.id === role)?.label ?? "Other";
}

export type VendorAssignmentStatus =
  | "considering"
  | "contacted"
  | "quote_requested"
  | "quote_received"
  | "selected"
  | "work_underway"
  | "completed"
  | "not_using";

export const VENDOR_ASSIGNMENT_STATUSES: { id: VendorAssignmentStatus; label: string }[] = [
  { id: "considering", label: "Considering" },
  { id: "contacted", label: "Contacted" },
  { id: "quote_requested", label: "Quote requested" },
  { id: "quote_received", label: "Quote received" },
  { id: "selected", label: "Selected" },
  { id: "work_underway", label: "Work underway" },
  { id: "completed", label: "Completed" },
  { id: "not_using", label: "Not using" },
];

export function vendorAssignmentStatusLabel(status: VendorAssignmentStatus): string {
  return VENDOR_ASSIGNMENT_STATUSES.find((entry) => entry.id === status)?.label ?? status;
}

/** A reusable, user-scoped vendor / professional the user knows about or has found. */
export interface Vendor {
  id: string;
  name: string;
  company: string | null;
  role: VendorRole;
  phone: string | null;
  email: string | null;
  website: string | null;
  serviceArea: string | null;
  /** Where this contact came from, e.g. "Google search", "Referral", "Manually added". */
  source: string | null;
  notes: string | null;
  /** When saved from a Google place search result, used to avoid duplicate directory entries. */
  originPlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ManualVendorInput = {
  name: string;
  company?: string | null;
  role: VendorRole;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  serviceArea?: string | null;
  source?: string | null;
  notes?: string | null;
  originPlaceId?: string | null;
};

/** A property-specific link between a saved vendor and a parcel. */
export interface VendorAssignment {
  id: string;
  vendorId: string;
  parcelId: string;
  roleOnProperty: VendorRole;
  status: VendorAssignmentStatus;
  scopeOfWork: string | null;
  quoteAmount: number | null;
  quoteDate: string | null;
  quoteNotes: string | null;
  nextFollowUpDate: string | null;
  propertyNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VendorAssignmentInput = {
  roleOnProperty?: VendorRole;
  status?: VendorAssignmentStatus;
  scopeOfWork?: string | null;
  quoteAmount?: number | null;
  quoteDate?: string | null;
  quoteNotes?: string | null;
  nextFollowUpDate?: string | null;
  propertyNotes?: string | null;
};

/** Print-safe summary used anywhere phone/email must not be shared (e.g. exported reports). */
export interface PrintSafeVendorSummary {
  vendorId: string;
  assignmentId: string;
  name: string;
  company: string | null;
  role: VendorRole;
  roleOnProperty: VendorRole;
  status: VendorAssignmentStatus;
  quoteAmount: number | null;
  nextFollowUpDate: string | null;
}
