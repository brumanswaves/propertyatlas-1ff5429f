import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2, Link2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { toast } from "sonner";
import { openExternalUrl } from "@/lib/external";


type Row = {
  id: string;
  label: string;
  url: string;
  category: string;
  note: string | null;
  created_at: string;
};

const CATEGORIES = ["maps", "listings", "official", "deeds", "general", "other"] as const;

/**
 * Per-property saved research URLs.
 *
 * ErfStoep never scrapes third-party sites. Instead users save the public
 * URLs they actually use (Google Maps, Street View, Kouga portals, WinDeed and
 * Lightstone search pages, etc.) along with a short note. We only store
 * metadata the user typed — never the page content behind the URL.
 */
export function SavedLinksManager({ parcelId }: { parcelId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  async function load() {
    if (!user) { setRows([]); return; }
    const { data, error } = await supabase
      .from("property_research_links")
      .select("id,label,url,category,note,created_at")
      .eq("parcel_id", parcelId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, parcelId]);

  async function remove(id: string) {
    const { error } = await supabase.from("property_research_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-[11px] text-muted-foreground">
        Sign in to save research URLs (Google Maps, WinDeed searches, Kouga portal pages, etc.) on this property.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> Your saved links
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setOpen(true); }}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-semibold text-primary-foreground hover:opacity-95"
        >
          <Plus className="h-3 w-3" /> Add link
        </button>
      </div>

      {rows === null ? (
        <div className="text-[11px] text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/50 px-3 py-3 text-[11px] text-muted-foreground">
          No saved links yet. Add a URL you want to keep handy for this property — listing pages, satellite shots, WinDeed searches, Kouga portal pages.
        </div>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5">
              <button
                type="button"
                onClick={(e) => openExternalUrl(r.url, e)}
                className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                title={r.url}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary">
                  <ExternalLink className="h-3 w-3" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-foreground">{r.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{r.url}</span>
                  {r.note && <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{r.note}</span>}
                  <span className="mt-1 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{r.category}</span>
                </span>
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" onClick={() => { setEditing(r); setOpen(true); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => remove(r.id)} className="rounded-md p-1 text-muted-foreground hover:bg-rose-100 hover:text-rose-700" title="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <LinkDialog
          parcelId={parcelId}
          userId={user.id}
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

function LinkDialog({
  parcelId, userId, initial, onClose, onSaved,
}: {
  parcelId: string;
  userId: string;
  initial: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!label.trim() || !url.trim()) { toast.error("Label and URL are required"); return; }
    try { new URL(url); } catch { toast.error("That URL doesn't look valid"); return; }
    setSaving(true);
    const payload = { label: label.trim(), url: url.trim(), category, note: note.trim() || null };
    const op = initial
      ? supabase.from("property_research_links").update(payload).eq("id", initial.id)
      : supabase.from("property_research_links").insert({ ...payload, user_id: userId, parcel_id: parcelId });
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Link updated" : "Link saved");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold">{initial ? "Edit link" : "Save research URL"}</div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          We store the URL and your note — not the page content. Open the link to view the source.
        </p>
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" placeholder="e.g. Google Street View — 14 Marina Dr" />
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" placeholder="https://…" />
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" placeholder="What did you find on this link?" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-muted">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? "Saving…" : "Save link"}
          </button>
        </div>
      </div>
    </div>
  );
}
