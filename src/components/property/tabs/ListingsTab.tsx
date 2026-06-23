import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2, Copy, BookmarkCheck, ChevronDown } from "lucide-react";
import { buildMarketEvidenceWorkflow, type ResearchContext } from "@/lib/research/links";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl, copyToClipboard } from "@/lib/external";
import { toast } from "sonner";

const STATUSES = ["For Sale", "Under Offer", "Sold", "Off Market", "Watching"] as const;
type Status = (typeof STATUSES)[number];

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

const PORTAL_LABELS: Record<string, string> = {
  property24: "Property24",
  privateproperty: "Private Property",
  pamgolding: "Pam Golding",
  seeff: "Seeff",
  remax: "RE/MAX",
  rawson: "Rawson",
};

function inferPortalFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("property24.com")) return "Property24";
  if (u.includes("privateproperty.co.za")) return "Private Property";
  if (u.includes("pamgolding.co.za")) return "Pam Golding";
  if (u.includes("seeff.com")) return "Seeff";
  if (u.includes("remax.co.za")) return "RE/MAX";
  if (u.includes("rawson.co.za")) return "Rawson";
  return "Other";
}

export function ListingsTab({
  parcelId,
  ctx,
  showSourceBadge = true,
}: {
  parcelId: string;
  ctx: ResearchContext;
  showSourceBadge?: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<{
    url: string;
    portal: string;
    asking_price: string;
    agent: string;
    agency: string;
    notes: string;
    status: Status;
  }>({
    url: "",
    portal: "",
    asking_price: "",
    agent: "",
    agency: "",
    notes: "",
    status: "For Sale",
  });
  const marketWorkflow = buildMarketEvidenceWorkflow(ctx);
  const listingLinks = marketWorkflow.portals;
  const searchPhrase = marketWorkflow.searchPhrase;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("property_listings")
      .select("*")
      .eq("parcel_id", parcelId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Listing[]));
  }, [user, parcelId]);

  async function save() {
    if (!user) {
      toast.message("Sign in to save listings");
      return;
    }
    const price = draft.asking_price ? Math.round(parseFloat(draft.asking_price) * 100) : null;
    const portal = draft.portal || (draft.url ? inferPortalFromUrl(draft.url) : "Other");
    const notes = [draft.notes, portal ? `Portal: ${portal}` : ""].filter(Boolean).join("\n");
    const { data, error } = await supabase
      .from("property_listings")
      .insert({
        user_id: user.id,
        parcel_id: parcelId,
        url: draft.url || null,
        asking_price_cents: price,
        agent: draft.agent || null,
        agency: draft.agency || null,
        notes: notes || null,
        status: draft.status,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((arr) => [data as Listing, ...arr]);
    setDraft({
      url: "",
      portal: "",
      asking_price: "",
      agent: "",
      agency: "",
      notes: "",
      status: "For Sale",
    });
    setShowAdd(false);
    toast.success("Listing saved");
  }

  async function remove(id: string) {
    await supabase.from("property_listings").delete().eq("id", id);
    setItems((arr) => arr.filter((l) => l.id !== id));
  }

  const hasSaved = items.length > 0;

  const hasLatLng = ctx.lat != null && ctx.lng != null;
  const coordStr = hasLatLng ? `${ctx.lat},${ctx.lng}` : "";
  const erfDetails = [
    ctx.erf ? `Erf ${ctx.erf}` : null,
    ctx.nearestRoad ?? null,
    ctx.suburb ?? ctx.area ?? null,
    ctx.town ?? null,
    ctx.province ?? "Eastern Cape",
    hasLatLng ? `${ctx.lat?.toFixed(6)}, ${ctx.lng?.toFixed(6)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Listing Search Assistant</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          PropertyAtlas does not currently have a live listing feed. Use the portal searches below,
          then save any listing URL you find under this erf.
        </p>
      </div>

      {/* Selected erf details + quick copy/open-at-erf tools */}
      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Selected erf
        </div>
        <div className="mt-1 text-[12px] font-medium text-foreground">
          {erfDetails || "No erf details available"}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              if (await copyToClipboard(erfDetails)) toast.success("Erf details copied");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
          >
            <Copy className="h-3 w-3" /> Copy erf details
          </button>
          {hasLatLng && (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (await copyToClipboard(coordStr)) toast.success("Coordinates copied");
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                <Copy className="h-3 w-3" /> Copy coordinates
              </button>
              <button
                type="button"
                onClick={(e) =>
                  openExternalUrl(`https://maps.google.com/?q=${encodeURIComponent(coordStr)}`, e)
                }
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Open Google Maps at erf
              </button>
              <button
                type="button"
                onClick={(e) =>
                  openExternalUrl(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(coordStr)}`,
                    e,
                  )
                }
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Open Street View
              </button>
            </>
          )}
        </div>
      </section>

      {/* Saved status — honest about what we know */}
      <section
        className={`rounded-2xl border ${hasSaved ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed border-border bg-muted/20"} p-3`}
      >
        {hasSaved ? (
          <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
            <BookmarkCheck className="h-4 w-4" /> Saved listing found ({items.length})
          </div>
        ) : (
          <div className="text-[12px]">
            <div className="font-semibold text-foreground">No saved listing yet</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Live listing feed not connected. Search a portal below and save any listing you find.
            </div>
          </div>
        )}
      </section>

      {/* Portal searches — open the portal home; user searches manually */}
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Search listing portals
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          {marketWorkflow.instruction} PropertyAtlas does not yet verify live listing availability.
        </p>
        <div className="flex flex-wrap gap-2">
          {listingLinks.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => openExternalUrl(s.href, e)}
              title={s.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> {s.label}
            </button>
          ))}
        </div>

        {searchPhrase && (
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Search phrase
            </div>
            <div className="mt-0.5 break-words text-[12px] font-medium text-foreground">
              {searchPhrase}
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(searchPhrase);
                if (ok) toast.success("Search phrase copied");
                else toast.error("Could not copy");
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
            >
              <Copy className="h-3 w-3" /> Copy search phrase
            </button>
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3 py-2.5 text-[12px] font-semibold hover:bg-muted"
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add listing manually
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition ${showAdd ? "rotate-180" : ""}`} />
        </button>
        {showAdd && (
          <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-3">
            <input
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              placeholder="Listing URL (paste from portal)"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                value={draft.portal}
                onChange={(e) => setDraft({ ...draft, portal: e.target.value })}
              >
                <option value="">Portal (auto-detect)</option>
                {Object.values(PORTAL_LABELS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              <select
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                placeholder="Asking price (R)"
                inputMode="decimal"
                value={draft.asking_price}
                onChange={(e) => setDraft({ ...draft, asking_price: e.target.value })}
              />
              <input
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                placeholder="Agent"
                value={draft.agent}
                onChange={(e) => setDraft({ ...draft, agent: e.target.value })}
              />
              <input
                className="col-span-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                placeholder="Agency"
                value={draft.agency}
                onChange={(e) => setDraft({ ...draft, agency: e.target.value })}
              />
            </div>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              placeholder="Notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            <button
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
            >
              <Plus className="h-3 w-3" /> Save listing
            </button>
          </div>
        )}
      </section>

      {hasSaved && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Saved listings
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((l) => (
              <li key={l.id} className="flex items-start gap-3 p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                      {l.status}
                    </span>
                    {l.url && (
                      <>
                        <span className="text-[10px] text-muted-foreground">
                          {inferPortalFromUrl(l.url)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => openExternalUrl(l.url!, e)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Open listing <ExternalLink className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="mt-1 font-semibold tabular-nums">
                    {l.asking_price_cents
                      ? `R ${(l.asking_price_cents / 100).toLocaleString("en-ZA")}`
                      : "Price not entered"}
                  </div>
                  {(l.agent || l.agency) && (
                    <div className="text-muted-foreground">
                      {[l.agent, l.agency].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {l.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{l.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(l.id)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ComplianceNotice tone="soft">
        Listings are user-entered. PropertyAtlas does not copy or store proprietary listing content
        from third-party sites and cannot confirm whether a listing is currently active.
      </ComplianceNotice>
      {showSourceBadge && <SourceBadge source="demo" />}
    </div>
  );
}
