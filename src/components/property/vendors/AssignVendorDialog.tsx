import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  VENDOR_ASSIGNMENT_STATUSES,
  VENDOR_ROLES,
} from "@/lib/vendors/types";
import type {
  Vendor,
  VendorAssignment,
  VendorAssignmentInput,
  VendorAssignmentStatus,
  VendorRole,
} from "@/lib/vendors/types";

interface Props {
  vendor: Vendor | null;
  existingAssignment?: VendorAssignment | null;
  parcelLabel: string;
  onClose: () => void;
  onAssign: (input: VendorAssignmentInput & { roleOnProperty: VendorRole }) => Promise<void> | void;
}

export function AssignVendorDialog({ vendor, existingAssignment, parcelLabel, onClose, onAssign }: Props) {
  const [roleOnProperty, setRoleOnProperty] = useState<VendorRole>("other");
  const [status, setStatus] = useState<VendorAssignmentStatus>("considering");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [propertyNotes, setPropertyNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!vendor) return;
    setRoleOnProperty(existingAssignment?.roleOnProperty ?? vendor.role);
    setStatus(existingAssignment?.status ?? "considering");
    setScopeOfWork(existingAssignment?.scopeOfWork ?? "");
    setQuoteAmount(existingAssignment?.quoteAmount != null ? String(existingAssignment.quoteAmount) : "");
    setQuoteDate(existingAssignment?.quoteDate ?? "");
    setQuoteNotes(existingAssignment?.quoteNotes ?? "");
    setNextFollowUpDate(existingAssignment?.nextFollowUpDate ?? "");
    setPropertyNotes(existingAssignment?.propertyNotes ?? "");
  }, [vendor, existingAssignment]);

  if (!vendor) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onAssign({
        roleOnProperty,
        status,
        scopeOfWork: scopeOfWork.trim() || null,
        quoteAmount: quoteAmount.trim() ? Number(quoteAmount) : null,
        quoteDate: quoteDate.trim() || null,
        quoteNotes: quoteNotes.trim() || null,
        nextFollowUpDate: nextFollowUpDate.trim() || null,
        propertyNotes: propertyNotes.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-[#0D1B2A]/15 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none focus:border-[#FF6A00]/50";
  const labelClass = "text-xs font-semibold text-[#0D1B2A]/70";

  return (
    <Dialog open={Boolean(vendor)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign {vendor.name} to this erf</DialogTitle>
          <DialogDescription>{parcelLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Role on this property
            <select
              className={inputClass}
              value={roleOnProperty}
              onChange={(event) => setRoleOnProperty(event.target.value as VendorRole)}
            >
              {VENDOR_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Status
            <select
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as VendorAssignmentStatus)}
            >
              {VENDOR_ASSIGNMENT_STATUSES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Scope of work
            <textarea
              className={inputClass}
              rows={2}
              value={scopeOfWork}
              onChange={(event) => setScopeOfWork(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            Quote amount (ZAR)
            <input
              type="number"
              min="0"
              className={inputClass}
              value={quoteAmount}
              onChange={(event) => setQuoteAmount(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            Quote date
            <input
              type="date"
              className={inputClass}
              value={quoteDate}
              onChange={(event) => setQuoteDate(event.target.value)}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Quote / reference notes
            <textarea
              className={inputClass}
              rows={2}
              value={quoteNotes}
              onChange={(event) => setQuoteNotes(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            Next follow-up date
            <input
              type="date"
              className={inputClass}
              value={nextFollowUpDate}
              onChange={(event) => setNextFollowUpDate(event.target.value)}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Property notes
            <textarea
              className={inputClass}
              rows={2}
              value={propertyNotes}
              onChange={(event) => setPropertyNotes(event.target.value)}
            />
          </label>
          <div className="sm:col-span-2 mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0D1B2A]/15 px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7d1f] disabled:opacity-60"
            >
              {saving ? "Saving…" : existingAssignment ? "Update assignment" : "Add to this property"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
