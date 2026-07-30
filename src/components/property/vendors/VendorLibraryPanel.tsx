import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Mail, Phone, PlusCircle, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Vendor, VendorAssignment, VendorAssignmentInput, VendorRole } from "@/lib/vendors/types";
import { VENDOR_ROLES, vendorRoleLabel } from "@/lib/vendors/types";
import { AssignVendorDialog } from "./AssignVendorDialog";

interface Props {
  parcelLabel: string;
  vendors: Vendor[];
  assignments: VendorAssignment[];
  onAssignVendor: (
    vendorId: string,
    input: VendorAssignmentInput & { roleOnProperty: VendorRole },
  ) => Promise<void> | void;
  onDeleteVendor: (vendorId: string) => Promise<void> | void;
}

function copyContactDetails(vendor: Vendor) {
  const lines = [
    vendor.name,
    vendor.company,
    vendor.phone ? `Phone: ${vendor.phone}` : null,
    vendor.email ? `Email: ${vendor.email}` : null,
    vendor.website,
  ].filter(Boolean);
  const text = lines.join("\n");
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Contact details copied"))
      .catch(() => toast.error("Could not copy contact details"));
  }
}

export function VendorLibraryPanel({
  parcelLabel,
  vendors,
  assignments,
  onAssignVendor,
  onDeleteVendor,
}: Props) {
  const [roleFilter, setRoleFilter] = useState<VendorRole | "all">("all");
  const [assigningVendor, setAssigningVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  const assignedVendorIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.vendorId)),
    [assignments],
  );

  const filtered = useMemo(
    () => (roleFilter === "all" ? vendors : vendors.filter((vendor) => vendor.role === roleFilter)),
    [vendors, roleFilter],
  );

  return (
    <div className="rounded-2xl border border-[#D9E6F2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D1B2A]">
          <Users className="h-4 w-4" /> My vendors ({vendors.length})
        </div>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as VendorRole | "all")}
          className="h-8 rounded-full border border-[#0D1B2A]/15 bg-white px-3 text-xs font-semibold text-[#0D1B2A]"
        >
          <option value="all">All roles</option>
          {VENDOR_ROLES.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[#0D1B2A]/62">
          No saved vendors yet. Search local professionals or add someone you know, and they will
          appear here for reuse across every property.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((vendor) => (
            <article key={vendor.id} className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0D1B2A]">{vendor.name}</p>
                  {vendor.company && <p className="text-xs text-[#0D1B2A]/62">{vendor.company}</p>}
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                    {vendorRoleLabel(vendor.role)}
                    {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ""}
                  </p>
                </div>
                {assignedVendorIds.has(vendor.id) && (
                  <span className="inline-flex items-center rounded-full bg-[#E7F6EC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1B7A3D]">
                    On this property
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {vendor.phone && (
                  <a
                    href={`tel:${vendor.phone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-[#0D1B2A] px-3 text-xs font-semibold text-white"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
                {vendor.email && (
                  <a
                    href={`mailto:${vendor.email}`}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 text-xs font-semibold text-[#0D1B2A]"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                )}
                {vendor.website && (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 text-xs font-semibold text-[#0D1B2A]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Website
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => copyContactDetails(vendor)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 text-xs font-semibold text-[#0D1B2A]"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy details
                </button>
                <button
                  type="button"
                  onClick={() => setAssigningVendor(vendor)}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-[#FF6A00] px-3 text-xs font-semibold text-white"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Add to this property
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingVendor(vendor)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 text-xs font-semibold text-[#B42318]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AssignVendorDialog
        vendor={assigningVendor}
        existingAssignment={
          assigningVendor
            ? (assignments.find((assignment) => assignment.vendorId === assigningVendor.id) ?? null)
            : null
        }
        parcelLabel={parcelLabel}
        onClose={() => setAssigningVendor(null)}
        onAssign={async (input) => {
          if (!assigningVendor) return;
          await onAssignVendor(assigningVendor.id, input);
        }}
      />

      <AlertDialog open={Boolean(deletingVendor)} onOpenChange={(open) => !open && setDeletingVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingVendor?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the vendor from your directory and from every property it is attached to.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingVendor) await onDeleteVendor(deletingVendor.id);
                setDeletingVendor(null);
              }}
            >
              Delete vendor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
