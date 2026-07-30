import { useMemo, useState } from "react";
import { CalendarClock, Mail, Phone, Trash2, Users } from "lucide-react";
import type { Vendor, VendorAssignment, VendorAssignmentInput } from "@/lib/vendors/types";
import { vendorAssignmentStatusLabel, vendorRoleLabel } from "@/lib/vendors/types";
import { cn } from "@/lib/utils";

interface Props {
  parcelLabel: string;
  vendors: Vendor[];
  assignments: VendorAssignment[];
  onUpdateAssignment: (assignmentId: string, patch: VendorAssignmentInput) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
}

function formatRand(amount: number | null): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(
      amount,
    );
  } catch {
    return `R ${amount.toLocaleString()}`;
  }
}

export function MyPropertyTeam({
  parcelLabel,
  vendors,
  assignments,
  onUpdateAssignment,
  onRemoveAssignment,
  onOpenSearch,
  onOpenLibrary,
}: Props) {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const vendorsById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);

  const grouped = useMemo(() => {
    const byRole = new Map<string, VendorAssignment[]>();
    for (const assignment of assignments) {
      const list = byRole.get(assignment.roleOnProperty) ?? [];
      list.push(assignment);
      byRole.set(assignment.roleOnProperty, list);
    }
    return Array.from(byRole.entries());
  }, [assignments]);

  return (
    <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
          <Users className="h-3.5 w-3.5" /> My team for this property
        </div>
        <p className="text-xs font-semibold text-[#0D1B2A]/60">{parcelLabel}</p>
      </div>

      {assignments.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-[#F7FBFF] p-5 text-sm leading-6 text-[#0D1B2A]/68">
          <p>
            No professionals are attached to this erf yet. Search nearby providers or add someone you
            already know.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7d1f]"
            >
              Search nearby providers
            </button>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
            >
              Add someone you know
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map(([role, roleAssignments]) => (
            <div key={role}>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                {vendorRoleLabel(role as Vendor["role"])}
              </h4>
              <div className="mt-2 space-y-2">
                {roleAssignments.map((assignment) => {
                  const vendor = vendorsById.get(assignment.vendorId);
                  if (!vendor) return null;
                  const quote = formatRand(assignment.quoteAmount);
                  return (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-[#D9E6F2] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0D1B2A]">{vendor.name}</p>
                          {vendor.company && (
                            <p className="text-xs text-[#0D1B2A]/62">{vendor.company}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                            assignment.status === "selected" || assignment.status === "completed"
                              ? "bg-[#E7F6EC] text-[#1B7A3D]"
                              : assignment.status === "not_using"
                                ? "bg-[#FDECEC] text-[#B42318]"
                                : "bg-[#F7FBFF] text-[#0D1B2A]/70",
                          )}
                        >
                          {vendorAssignmentStatusLabel(assignment.status)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#0D1B2A]/62">
                        {quote && <span>Quote: {quote}</span>}
                        {assignment.nextFollowUpDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" /> Follow up {assignment.nextFollowUpDate}
                          </span>
                        )}
                      </div>
                      {assignment.propertyNotes && (
                        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                          {assignment.propertyNotes}
                        </p>
                      )}

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
                        <select
                          value={assignment.status}
                          onChange={(event) =>
                            onUpdateAssignment(assignment.id, {
                              status: event.target.value as VendorAssignment["status"],
                            })
                          }
                          className="h-8 rounded-full border border-[#0D1B2A]/15 bg-white px-3 text-xs font-semibold text-[#0D1B2A]"
                        >
                          {[
                            "considering",
                            "contacted",
                            "quote_requested",
                            "quote_received",
                            "selected",
                            "work_underway",
                            "completed",
                            "not_using",
                          ].map((status) => (
                            <option key={status} value={status}>
                              {vendorAssignmentStatusLabel(status as VendorAssignment["status"])}
                            </option>
                          ))}
                        </select>
                        {confirmRemoveId === assignment.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveAssignment(assignment.id);
                              setConfirmRemoveId(null);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-[#B42318] px-3 text-xs font-semibold text-white"
                          >
                            Confirm remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(assignment.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 text-xs font-semibold text-[#0D1B2A]"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove from property
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
