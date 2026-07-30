/**
 * Lightweight, dependency-free helpers other surfaces (e.g. investigation
 * progress messaging) can call to answer common questions about the vendor
 * team on a property, without importing UI or persistence code.
 */
import type { PrintSafeVendorSummary, Vendor, VendorAssignment, VendorRole } from "./types";

const ACTIVE_STATUSES = new Set([
  "considering",
  "contacted",
  "quote_requested",
  "quote_received",
  "selected",
  "work_underway",
  "completed",
]);

const QUOTE_RECEIVED_OR_LATER = new Set([
  "quote_received",
  "selected",
  "work_underway",
  "completed",
]);

/** Is a professional of this role currently attached to the property (not "not using")? */
export function isRoleAssigned(assignments: VendorAssignment[], role: VendorRole): boolean {
  return assignments.some(
    (assignment) => assignment.roleOnProperty === role && ACTIVE_STATUSES.has(assignment.status),
  );
}

/** Has a quote been received (or progressed further) from any vendor in this role? */
export function hasQuoteReceivedForRole(assignments: VendorAssignment[], role: VendorRole): boolean {
  return assignments.some(
    (assignment) =>
      assignment.roleOnProperty === role && QUOTE_RECEIVED_OR_LATER.has(assignment.status),
  );
}

/** Has any vendor in this role been marked as selected for the work? */
export function hasSelectedVendorForRole(assignments: VendorAssignment[], role: VendorRole): boolean {
  return assignments.some(
    (assignment) => assignment.roleOnProperty === role && assignment.status === "selected",
  );
}

/**
 * Print-safe summaries of the vendor team for a property — deliberately
 * excludes phone and email so they are safe to include in exports/reports.
 */
export function printSafeVendorSummaries(
  vendors: Vendor[],
  assignments: VendorAssignment[],
): PrintSafeVendorSummary[] {
  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  return assignments.flatMap((assignment) => {
    const vendor = vendorsById.get(assignment.vendorId);
    if (!vendor) return [];
    return [
      {
        vendorId: vendor.id,
        assignmentId: assignment.id,
        name: vendor.name,
        company: vendor.company,
        role: vendor.role,
        roleOnProperty: assignment.roleOnProperty,
        status: assignment.status,
        quoteAmount: assignment.quoteAmount,
        nextFollowUpDate: assignment.nextFollowUpDate,
      },
    ];
  });
}
