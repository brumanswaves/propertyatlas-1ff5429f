import { useState } from "react";
import { X, MapPin, Save } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  lng?: number;
  lat?: number;
  onClose: () => void;
  onCreated?: (parcelId: string) => void;
}

export function AddPropertyDialog({ lng, lat, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [f, setF] = useState({ address: "", erf: "", suburb: "", municipality: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) { toast.message("Sign in to add a property"); return; }
    if (!f.address && !f.erf) { toast.error("Add an address or erf number"); return; }
    setSaving(true);
    const parcelId = `user:${crypto.randomUUID()}`;
    const { error } = await supabase.from("saved_properties").insert({
      user_id: user.id,
      parcel_id: parcelId,
      note: f.notes || null,
      research_status: "researching",
      user_data: {
        address: f.address, erf: f.erf, suburb: f.suburb, municipality: f.municipality,
        lng, lat, source: "user_manual",
      },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Property added to research");
    onCreated?.(parcelId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Research this location</div>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight">Add property</h2>
            {lng != null && lat != null && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 space-y-2">
          <input className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Address"
            value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Erf number"
              value={f.erf} onChange={(e) => setF({ ...f, erf: e.target.value })} />
            <input className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Suburb"
              value={f.suburb} onChange={(e) => setF({ ...f, suburb: e.target.value })} />
          </div>
          <input className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Municipality"
            value={f.municipality} onChange={(e) => setF({ ...f, municipality: e.target.value })} />
          <textarea className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Notes" rows={3}
            value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60">
            <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save research"}
          </button>
        </div>
      </div>
    </div>
  );
}
