/**
 * Persistence for the vendor directory ("my vendors") and per-property vendor
 * assignments.
 *
 * This deliberately reuses the existing `saved_properties.user_data` JSON
 * column and the `patch_saved_property_user_data` RPC rather than adding a
 * new table/migration:
 *  - Property assignments live under `user_data.vendorAssignments` on the
 *    real parcel's saved_properties row (same pattern as strategyWorkspace,
 *    savedMarketEvidence, etc).
 *  - The user-scoped vendor directory (reusable across every property) is
 *    stored the same way, but keyed against a reserved sentinel parcel id
 *    (`VENDOR_LIBRARY_PARCEL_ID`) scoped to the signed-in user by the same
 *    RLS policy that protects every other saved_properties row. No new
 *    table, policy, or migration is required.
 *
 * Signed-out users fall back to localStorage so the workspace still works,
 * degrading gracefully (no cross-device sync) until they sign in.
 */
import { supabase } from "@/integrations/supabase/client";
import { patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import type { Vendor, VendorAssignment } from "./types";
import { coerceAssignmentList, coerceVendorDirectory } from "./vendorRecords";

export const VENDOR_LIBRARY_PARCEL_ID = "__vendor_library__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const LOCAL_DIRECTORY_KEY = "easyerf.vendors.directory.v1";
const LOCAL_ASSIGNMENTS_PREFIX = "easyerf.vendors.assignments.v1";

function localAssignmentsKey(parcelId: string): string {
  return `${LOCAL_ASSIGNMENTS_PREFIX}.${parcelId}`;
}

export function readLocalVendorDirectory(): Vendor[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_DIRECTORY_KEY) ?? "[]");
    return coerceVendorDirectory(parsed);
  } catch {
    return [];
  }
}

export function writeLocalVendorDirectory(vendors: Vendor[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_DIRECTORY_KEY, JSON.stringify(vendors));
  } catch {
    // Local persistence is best-effort.
  }
}

export function readLocalVendorAssignments(parcelId: string): VendorAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(localAssignmentsKey(parcelId)) ?? "[]",
    );
    return coerceAssignmentList(parsed, parcelId);
  } catch {
    return [];
  }
}

export function writeLocalVendorAssignments(parcelId: string, assignments: VendorAssignment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      localAssignmentsKey(parcelId),
      JSON.stringify(assignments.filter((assignment) => assignment.parcelId === parcelId)),
    );
  } catch {
    // Local persistence is best-effort.
  }
}

export async function fetchRemoteVendorDirectory(
  userId: string,
  client = supabase,
): Promise<Vendor[]> {
  const { data } = await client
    .from("saved_properties")
    .select("user_data")
    .eq("user_id", userId)
    .eq("parcel_id", VENDOR_LIBRARY_PARCEL_ID)
    .maybeSingle();
  const userData = isRecord(data?.user_data) ? data?.user_data : {};
  return coerceVendorDirectory(userData?.vendorDirectory);
}

export async function persistRemoteVendorDirectory(vendors: Vendor[], client = supabase) {
  const merged = await patchSavedPropertyUserData(
    VENDOR_LIBRARY_PARCEL_ID,
    { vendorDirectory: vendors },
    client,
  );
  return coerceVendorDirectory(isRecord(merged) ? merged.vendorDirectory : []);
}

export async function fetchRemoteVendorAssignments(
  parcelId: string,
  userId: string,
  client = supabase,
): Promise<VendorAssignment[]> {
  const { data } = await client
    .from("saved_properties")
    .select("user_data")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .maybeSingle();
  const userData = isRecord(data?.user_data) ? data?.user_data : {};
  return coerceAssignmentList(userData?.vendorAssignments, parcelId);
}

export async function persistRemoteVendorAssignments(
  parcelId: string,
  assignments: VendorAssignment[],
  client = supabase,
) {
  const merged = await patchSavedPropertyUserData(
    parcelId,
    { vendorAssignments: assignments },
    client,
  );
  return coerceAssignmentList(isRecord(merged) ? merged.vendorAssignments : [], parcelId);
}
