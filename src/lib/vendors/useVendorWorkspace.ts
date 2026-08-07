import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/useAuth";
import type {
  ManualVendorInput,
  Vendor,
  VendorAssignment,
  VendorAssignmentInput,
  VendorRole,
} from "./types";
import {
  assignVendorToParcel as assignVendorToParcelRecord,
  deleteVendorFromDirectory,
  markAssignmentSelected as markAssignmentSelectedRecord,
  recordQuote as recordQuoteRecord,
  removeAssignment as removeAssignmentRecord,
  updateAssignment as updateAssignmentRecord,
  updateVendorInDirectory,
  upsertVendorInDirectory,
} from "./vendorRecords";
import {
  fetchRemoteVendorAssignments,
  fetchRemoteVendorDirectory,
  persistRemoteVendorAssignments,
  persistRemoteVendorDirectory,
  readLocalVendorAssignments,
  readLocalVendorDirectory,
  writeLocalVendorAssignments,
  writeLocalVendorDirectory,
} from "./vendorStore";

export function useVendorWorkspace(parcelId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [directory, setDirectory] = useState<Vendor[]>([]);
  const [assignments, setAssignments] = useState<VendorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      if (!userId) {
        if (!alive) return;
        setDirectory(readLocalVendorDirectory());
        setAssignments(readLocalVendorAssignments(parcelId));
        setLoading(false);
        return;
      }
      const [remoteDirectory, remoteAssignments] = await Promise.all([
        fetchRemoteVendorDirectory(userId).catch(() => readLocalVendorDirectory()),
        fetchRemoteVendorAssignments(parcelId, userId).catch(() =>
          readLocalVendorAssignments(parcelId),
        ),
      ]);
      if (!alive) return;
      setDirectory(remoteDirectory);
      setAssignments(remoteAssignments);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [parcelId, userId]);

  const persistDirectory = useCallback(async (next: Vendor[]) => {
    setDirectory(next);
    if (!userIdRef.current) {
      writeLocalVendorDirectory(next);
      return;
    }
    try {
      const merged = await persistRemoteVendorDirectory(next);
      setDirectory(merged);
    } catch {
      writeLocalVendorDirectory(next);
      toast.error("Could not sync your vendor directory. Saved locally on this device instead.");
    }
  }, []);

  const persistAssignments = useCallback(
    async (next: VendorAssignment[]) => {
      setAssignments(next);
      if (!userIdRef.current) {
        writeLocalVendorAssignments(parcelId, next);
        return;
      }
      try {
        const merged = await persistRemoteVendorAssignments(parcelId, next);
        setAssignments(merged);
      } catch {
        writeLocalVendorAssignments(parcelId, next);
        toast.error("Could not sync this property's vendor team. Saved locally on this device instead.");
      }
    },
    [parcelId],
  );

  const saveVendor = useCallback(
    async (input: ManualVendorInput) => {
      const { directory: next, vendor } = upsertVendorInDirectory(directory, input);
      await persistDirectory(next);
      return vendor;
    },
    [directory, persistDirectory],
  );

  const updateVendor = useCallback(
    async (vendorId: string, patch: Partial<ManualVendorInput>) => {
      await persistDirectory(updateVendorInDirectory(directory, vendorId, patch));
    },
    [directory, persistDirectory],
  );

  const deleteVendor = useCallback(
    async (vendorId: string, confirmed: boolean) => {
      if (!confirmed) return;
      await persistDirectory(deleteVendorFromDirectory(directory, vendorId));
      await persistAssignments(assignments.filter((assignment) => assignment.vendorId !== vendorId));
    },
    [assignments, directory, persistAssignments, persistDirectory],
  );

  const assignVendor = useCallback(
    async (
      vendorId: string,
      input: VendorAssignmentInput & { roleOnProperty: VendorRole },
    ) => {
      const { assignments: next, assignment } = assignVendorToParcelRecord(
        assignments,
        vendorId,
        parcelId,
        input,
      );
      await persistAssignments(next);
      return assignment;
    },
    [assignments, parcelId, persistAssignments],
  );

  const updateAssignment = useCallback(
    async (assignmentId: string, patch: VendorAssignmentInput) => {
      await persistAssignments(updateAssignmentRecord(assignments, assignmentId, patch));
    },
    [assignments, persistAssignments],
  );

  const recordQuote = useCallback(
    async (
      assignmentId: string,
      quote: { quoteAmount: number | null; quoteDate: string | null; quoteNotes?: string | null },
    ) => {
      await persistAssignments(recordQuoteRecord(assignments, assignmentId, quote));
    },
    [assignments, persistAssignments],
  );

  const markSelected = useCallback(
    async (assignmentId: string) => {
      await persistAssignments(markAssignmentSelectedRecord(assignments, assignmentId));
    },
    [assignments, persistAssignments],
  );

  const removeFromProperty = useCallback(
    async (assignmentId: string) => {
      await persistAssignments(removeAssignmentRecord(assignments, assignmentId));
    },
    [assignments, persistAssignments],
  );

  return {
    loading,
    directory,
    assignments,
    saveVendor,
    updateVendor,
    deleteVendor,
    assignVendor,
    updateAssignment,
    recordQuote,
    markSelected,
    removeFromProperty,
  };
}
