import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2, Copy } from "lucide-react";
import { buildListingResearchLinks, listingSearchAddress, type ResearchContext } from "@/lib/research/links";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl, copyToClipboard } from "@/lib/external";
import { toast } from "sonner";


const STATUSES = ["For Sale", "Under Offer", "Sold", "Off Market", "Watching"] as const;
type Status = typeof STATUSES[number];

interface Listing {
  id: string;
  url: string | null;
  asking_price_cents: number | null;
  agent: string | null;
  agency: string | null;
  notes: string | null;
  found_at: string | null;
  status: string;
}

export function ListingsTab({ parcelId, ctx }: { parcelId: string; ctx: ResearchContext }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [draft, setDraft] = useState<{ url: string; asking_price: string; agent: string; agency: string; notes: string; status: Status }>({
    url: "", asking_price: "", agent: "", agency: "", notes: "", status: "For Sale",
  });
  const addr = listingSearchAddress(ctx) || "St Francis Bay";
  void addr;
  const listingLinks = buildListingResearchLinks(ctx);


  useEffect(() => {
    if (!user) return;
    supabase.from("property_listings").select("*").eq("parcel_id", parcelId).order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Listing[]));
  }, [user, parcelId]);

  async function save() {
    if (!user) { toast.message("Sign in to save listings"); return; }
    const price = draft.asking_price ? Math.round(parseFloat(draft.asking_price) * 100) : null;
    const { data, error } = await supabase.from("property_listings").insert({
      user_id: user.id,
      parcel_id: parcelId,
      url: draft.url || null,
      asking_price_cents: price,
      agent: draft.agent || null,
      agency: draft.agency || null,
      notes: draft.notes || null,
      status: draft.status,
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setItems((arr) => [data as Listing, ...arr]);
    setDraft({ url: "", asking_price: "", agent: "", agency: "", notes: "", status: "For Sale" });
    toast.success("Listing saved");
  }

  async function remove(id: string) {
    await supabase.from("property_listings").delete().eq("id", id);
    setItems((arr) => arr.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Listings research</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Search popular SA property sites for this address, then save what you find.
        </p>
      </div>

      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Search active listings</div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          PropertyAtlas does not scrape listing portals. These searches open Google site-searches in a new tab so you can browse the portal directly and save any listing you find.
        </p>
        <div className="flex flex-wrap gap-2">
          {listingLinks.map((s) => (
            <span key={s.id} className="inline-flex items-center overflow-hidden rounded-full border border-border bg-card text-[11px] font-medium hover:bg-muted">
              <button
                type="button"
                onClick={(e) => openExternalUrl(s.href, e)}
                title={s.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5"
              >
                <ExternalLink className="h-3 w-3" /> {s.label}
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const ok = await copyToClipboard(s.href);
                  if (ok) toast.success("Link copied"); else toast.error("Could not copy link");
                }}
                title="Copy link"
                aria-label="Copy link"
                className="border-l border-border px-2 py-1.5 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>


      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add a listing you found</div>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <input className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Listing URL"
            value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Asking price (R)"
              inputMode="decimal" value={draft.asking_price} onChange={(e) => setDraft({ ...draft, asking_price: e.target.value })} />
            <select className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Agent"
              value={draft.agent} onChange={(e) => setDraft({ ...draft, agent: e.target.value })} />
            <input className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Agency"
              value={draft.agency} onChange={(e) => setDraft({ ...draft, agency: e.target.value })} />
          </div>
          <textarea className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" placeholder="Notes" rows={2}
            value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <button onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90">
            <Plus className="h-3 w-3" /> Save listing
          </button>
        </div>
      </section>

      {items.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saved listings</div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((l) => (
              <li key={l.id} className="flex items-start gap-3 p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">{l.status}</span>
                    {l.url && (
                      <button type="button" onClick={(e) => openExternalUrl(l.url!, e)} className="inline-flex items-center gap-1 text-primary hover:underline">
                        Open listing <ExternalLink className="h-3 w-3" />
                      </button>
                    )}

                  </div>
                  <div className="mt-1 font-semibold tabular-nums">
                    {l.asking_price_cents ? `R ${(l.asking_price_cents / 100).toLocaleString("en-ZA")}` : "Price not entered"}
                  </div>
                  {(l.agent || l.agency) && (
                    <div className="text-muted-foreground">{[l.agent, l.agency].filter(Boolean).join(" · ")}</div>
                  )}
                  {l.notes && <p className="mt-1 text-muted-foreground">{l.notes}</p>}
                </div>
                <button onClick={() => remove(l.id)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ComplianceNotice tone="soft">
        Listings are user-entered. PropertyAtlas does not copy or store proprietary listing content from third-party sites.
      </ComplianceNotice>
      <SourceBadge source="demo" />
    </div>
  );
}
