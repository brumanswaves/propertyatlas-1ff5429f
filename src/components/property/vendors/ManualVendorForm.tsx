import { useState } from "react";
import { UserPlus } from "lucide-react";
import { VENDOR_ROLES } from "@/lib/vendors/types";
import type { ManualVendorInput, VendorRole } from "@/lib/vendors/types";

interface Props {
  onSave: (input: ManualVendorInput) => Promise<void> | void;
  submitLabel?: string;
}

const EMPTY: ManualVendorInput = {
  name: "",
  company: "",
  role: "other",
  phone: "",
  email: "",
  website: "",
  serviceArea: "",
  source: "Manually added",
  notes: "",
};

export function ManualVendorForm({ onSave, submitLabel = "Save vendor" }: Props) {
  const [form, setForm] = useState<ManualVendorInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ManualVendorInput>(key: K, value: ManualVendorInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, source: form.source?.trim() || "Manually added" });
      setForm(EMPTY);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-[#0D1B2A]/15 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none focus:border-[#FF6A00]/50";
  const labelClass = "text-xs font-semibold text-[#0D1B2A]/70";

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#D9E6F2] bg-white p-4">
      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D1B2A]">
        <UserPlus className="h-4 w-4" /> Add someone you already know
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Name *
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Company
          <input
            className={inputClass}
            value={form.company ?? ""}
            onChange={(event) => update("company", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Role / trade
          <select
            className={inputClass}
            value={form.role}
            onChange={(event) => update("role", event.target.value as VendorRole)}
          >
            {VENDOR_ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Service area
          <input
            className={inputClass}
            value={form.serviceArea ?? ""}
            onChange={(event) => update("serviceArea", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Phone
          <input
            className={inputClass}
            value={form.phone ?? ""}
            onChange={(event) => update("phone", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Email
          <input
            type="email"
            className={inputClass}
            value={form.email ?? ""}
            onChange={(event) => update("email", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Website
          <input
            className={inputClass}
            value={form.website ?? ""}
            onChange={(event) => update("website", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Source / how you know them
          <input
            className={inputClass}
            value={form.source ?? ""}
            onChange={(event) => update("source", event.target.value)}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Notes
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes ?? ""}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving || !form.name.trim()}
        className="mt-4 inline-flex min-h-9 items-center justify-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7d1f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
