import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bookmark, MapPinned, FileText, NotebookPen, Link2, Calculator, ClipboardList, Sparkles, ArrowUpRight, ChevronRight,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropertyAtlas" },
      { name: "description", content: "Your saved parcels, notes, listings, report interests, and due-diligence checklist." },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
  component: Dashboard,
});

interface Counts {
  savedProperties: number;
  notesProperties: number;
  savedListings: number;
  reportInterests: number;
}

interface SavedRow { parcel_id: string; created_at: string | null }
interface ListingRow { id: string; parcel_id: string; url: string | null; status: string; asking_price_cents: number | null; created_at: string | null }
interface ActivityRow { kind: string; label: string; at: string }

const CHECKLIST = [
  "Verify ownership (Lightstone / WinDeed report when available)",
  "Check zoning (Kouga Mapping Portal or municipal source)",
  "Check SG diagram (CSG Property Viewer)",
  "Search listings on portals",
  "Save listing URL if found",
  "Add notes and questions",
  "Run a calculator scenario",
  "Order a verified report when integrations are live",
];

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ savedProperties: 0, notesProperties: 0, savedListings: 0, reportInterests: 0 });
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, n, l] = await Promise.all([
        supabase.from("saved_properties").select("parcel_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("property_notes").select("parcel_id, updated_at").eq("user_id", user.id),
        supabase.from("property_listings").select("id, parcel_id, url, status, asking_price_cents, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const savedRows = (s.data ?? []) as SavedRow[];
      const noteRows = (n.data ?? []) as { parcel_id: string; updated_at: string | null }[];
      const listingRows = (l.data ?? []) as ListingRow[];

      // Report interest is stored client-side per parcel; count keys with a `pa.reportInterests.` prefix.
      let reportInterests = 0;
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i) ?? "";
          if (k.startsWith("pa.reportInterests.")) {
            try {
              const v = JSON.parse(window.localStorage.getItem(k) ?? "{}");
              reportInterests += Object.keys(v).length;
            } catch {}
          }
        }
      } catch {}

      setSaved(savedRows);
      setListings(listingRows);
      setCounts({
        savedProperties: savedRows.length,
        notesProperties: noteRows.length,
        savedListings: listingRows.length,
        reportInterests,
      });

      const act: ActivityRow[] = [
        ...savedRows.slice(0, 5).map((r) => ({ kind: "saved", label: `Saved ${r.parcel_id}`, at: r.created_at ?? "" })),
        ...noteRows.slice(0, 5).map((r) => ({ kind: "note", label: `Added note to ${r.parcel_id}`, at: r.updated_at ?? "" })),
        ...listingRows.slice(0, 5).map((r) => ({ kind: "listing", label: `Saved listing for ${r.parcel_id}`, at: r.created_at ?? "" })),
      ]
        .filter((r) => r.at)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 8);
      setActivity(act);
    })();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-28">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> Research workspace
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Your research</h1>
            <p className="text-sm text-muted-foreground">Saved parcels, notes, listings, and report interests.</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <MapPinned className="h-3.5 w-3.5" /> Open map
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Bookmark className="h-4 w-4" />} label="Saved properties" value={counts.savedProperties} />
          <KpiCard icon={<NotebookPen className="h-4 w-4" />} label="Properties with notes" value={counts.notesProperties} />
          <KpiCard icon={<Link2 className="h-4 w-4" />} label="Listings saved" value={counts.savedListings} />
          <KpiCard icon={<FileText className="h-4 w-4" />} label="Report interests" value={counts.reportInterests} />
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Panel icon={<ClipboardList className="h-3.5 w-3.5" />} title="Due-diligence checklist">
            <ul className="space-y-1.5 text-[12.5px]">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="text-muted-foreground">{c}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={<Sparkles className="h-3.5 w-3.5" />} title="Recent activity">
            {activity.length === 0 ? (
              <EmptyInline body="No activity yet. Click a parcel on the map to start." />
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                    <span className="truncate text-foreground">{a.label}</span>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">{new Date(a.at).toLocaleDateString("en-ZA")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section className="mt-10">
          <SectionTitle icon={<Bookmark className="h-3.5 w-3.5" />}>Saved properties</SectionTitle>
          {saved.length === 0 ? (
            <EmptyCard
              icon={<Bookmark className="h-5 w-5" />}
              title="You haven't saved any properties yet"
              body="Click any parcel on the map and tap the bookmark to save it for later research."
              cta={{ to: "/", label: "Open the map" }}
            />
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {saved.map((p) => (
                <li key={p.parcel_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.parcel_id}</div>
                    <div className="text-[10.5px] text-muted-foreground">Saved {p.created_at ? new Date(p.created_at).toLocaleDateString("en-ZA") : ""}</div>
                  </div>
                  <Link to="/" search={{ parcel: p.parcel_id } as never} className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline">
                    Open on map <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle icon={<Link2 className="h-3.5 w-3.5" />}>Saved listings</SectionTitle>
          {listings.length === 0 ? (
            <EmptyCard
              icon={<Link2 className="h-5 w-5" />}
              title="No saved listings"
              body="Live listing feed not connected. Save listings manually from the Listings tab on any parcel."
            />
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {listings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">{l.status}</span>
                      <span className="truncate font-medium">{l.parcel_id}</span>
                    </div>
                    {l.asking_price_cents != null && (
                      <div className="text-[11px] tabular-nums text-muted-foreground">R {(l.asking_price_cents / 100).toLocaleString("en-ZA")}</div>
                    )}
                  </div>
                  {l.url && (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline">
                      Open <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle icon={<Calculator className="h-3.5 w-3.5" />}>Calculators</SectionTitle>
          <EmptyCard
            icon={<Calculator className="h-5 w-5" />}
            title="Run scenarios from the property panel"
            body="Open a parcel and use the Calculators tab to run yield, holding-cost, flip and development scenarios using your own numbers."
            cta={{ to: "/", label: "Open the map" }}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">{icon}</span>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyInline({ body }: { body: string }) {
  return <p className="text-[12px] text-muted-foreground">{body}</p>;
}

function EmptyCard({
  icon, title, body, cta,
}: { icon: React.ReactNode; title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {cta && (
        <Link to={cta.to} className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
