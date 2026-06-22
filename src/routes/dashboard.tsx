import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bookmark,
  MapPinned,
  FileText,
  NotebookPen,
  Link2,
  Calculator,
  ClipboardList,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserGreetingName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSavedParcelMapHref,
  isDemoParcelId,
  isOfficialParcelId,
} from "@/lib/parcels/officialParcelId";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropertyAtlas" },
      {
        name: "description",
        content:
          "Your saved parcels, notes, listings, report interests, and due-diligence checklist.",
      },
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

interface SavedRow {
  parcel_id: string;
  created_at: string | null;
  research_status: string | null;
  status: string | null;
  tags: string[] | null;
  user_data: unknown;
}
interface ListingRow {
  id: string;
  parcel_id: string;
  url: string | null;
  status: string;
  asking_price_cents: number | null;
  created_at: string | null;
}
interface ActivityRow {
  kind: string;
  label: string;
  at: string;
}

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
  const greetingName = getUserGreetingName(user);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    savedProperties: 0,
    notesProperties: 0,
    savedListings: 0,
    reportInterests: 0,
  });
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, n, l] = await Promise.all([
        supabase
          .from("saved_properties")
          .select("parcel_id, created_at, research_status, status, tags, user_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("property_notes").select("parcel_id, updated_at").eq("user_id", user.id),
        supabase
          .from("property_listings")
          .select("id, parcel_id, url, status, asking_price_cents, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
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
            } catch {
              // Ignore malformed local report-interest payloads.
            }
          }
        }
      } catch {
        // localStorage can be unavailable in restricted browser contexts.
      }

      setSaved(savedRows);
      setListings(listingRows);
      setCounts({
        savedProperties: savedRows.length,
        notesProperties: noteRows.length,
        savedListings: listingRows.length,
        reportInterests,
      });

      const act: ActivityRow[] = [
        ...savedRows.slice(0, 5).map((r) => ({
          kind: "saved",
          label: `Saved ${savedTitle(r)}`,
          at: r.created_at ?? "",
        })),
        ...noteRows.slice(0, 5).map((r) => ({
          kind: "note",
          label: `Added note to ${r.parcel_id}`,
          at: r.updated_at ?? "",
        })),
        ...listingRows.slice(0, 5).map((r) => ({
          kind: "listing",
          label: `Saved listing for ${r.parcel_id}`,
          at: r.created_at ?? "",
        })),
      ]
        .filter((r) => r.at)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 8);
      setActivity(act);
    })();
  }, [user]);

  async function removeSavedProperty(parcelId: string) {
    if (!user) return;
    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSaved((rows) => rows.filter((row) => row.parcel_id !== parcelId));
    setCounts((current) => ({
      ...current,
      savedProperties: Math.max(0, current.savedProperties - 1),
    }));
    toast.success("Saved property removed");
  }

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
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Hello {greetingName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Saved parcels, notes, listings, and report interests.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <MapPinned className="h-3.5 w-3.5" /> Open map
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Bookmark className="h-4 w-4" />}
            label="Saved properties"
            value={counts.savedProperties}
          />
          <KpiCard
            icon={<NotebookPen className="h-4 w-4" />}
            label="Properties with notes"
            value={counts.notesProperties}
          />
          <KpiCard
            icon={<Link2 className="h-4 w-4" />}
            label="Listings saved"
            value={counts.savedListings}
          />
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label="Report interests"
            value={counts.reportInterests}
          />
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
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-2 text-[12.5px]"
                  >
                    <span className="truncate text-foreground">{a.label}</span>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">
                      {new Date(a.at).toLocaleDateString("en-ZA")}
                    </span>
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
                <SavedPropertyRow key={p.parcel_id} row={p} onRemove={removeSavedProperty} />
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
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                        {l.status}
                      </span>
                      <span className="truncate font-medium">{l.parcel_id}</span>
                    </div>
                    {l.asking_price_cents != null && (
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        R {(l.asking_price_cents / 100).toLocaleString("en-ZA")}
                      </div>
                    )}
                  </div>
                  {l.url && (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline"
                    >
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringField(data: unknown, key: string): string | null {
  if (!isRecord(data)) return null;
  const value = data[key];
  return value === null || value === undefined || String(value).trim() === ""
    ? null
    : String(value);
}

function savedTitle(row: SavedRow): string {
  const title =
    stringField(row.user_data, "displayTitle") ??
    stringField(row.user_data, "address") ??
    stringField(row.user_data, "researchQuery");
  if (title) return title;
  const erf = stringField(row.user_data, "erfNumber") ?? stringField(row.user_data, "erf");
  return erf
    ? `Erf ${erf}`
    : isOfficialParcelId(row.parcel_id)
      ? "Official parcel dossier"
      : row.parcel_id;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-ZA") : "Unknown date";
}

function SavedPropertyRow({
  row,
  onRemove,
}: {
  row: SavedRow;
  onRemove: (parcelId: string) => Promise<void>;
}) {
  const official = isOfficialParcelId(row.parcel_id);
  const demo = isDemoParcelId(row.parcel_id);
  const title = savedTitle(row);
  const erf = stringField(row.user_data, "erfNumber") ?? stringField(row.user_data, "erf");
  const portion = stringField(row.user_data, "portion");
  const municipality =
    stringField(row.user_data, "municipality") ??
    stringField(row.user_data, "town") ??
    stringField(row.user_data, "majorRegion");
  const province = stringField(row.user_data, "province");
  const lat = stringField(row.user_data, "lat") ?? stringField(row.user_data, "latitude");
  const lng = stringField(row.user_data, "lng") ?? stringField(row.user_data, "longitude");
  const status = row.research_status || row.status;
  const tags = row.tags ?? [];
  const href = demo
    ? `/?parcel=${encodeURIComponent(row.parcel_id)}`
    : buildSavedParcelMapHref(row.parcel_id, {
        title,
        erf,
        portion,
        municipality,
        province,
        lat,
        lng,
        zoom: 18,
      });
  const open = () => {
    window.location.assign(href);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
  const remove = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("Remove this saved property?")) return;
    await onRemove(row.parcel_id);
  };

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      className="flex cursor-pointer flex-col gap-3 px-4 py-3 text-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {official && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Official parcel / Erf Research Dossier
            </span>
          )}
          {demo && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Demo property
            </span>
          )}
          {status && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {status.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <div className="mt-1 truncate font-medium">{title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
          {erf && <span>Erf {erf}</span>}
          {portion && <span>Portion {portion}</span>}
          {municipality && <span>{municipality}</span>}
          {province && <span>{province}</span>}
          <span>Saved {formatDate(row.created_at)}</span>
        </div>
        <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
          {row.parcel_id}
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2 py-0.5 text-[9px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
          Open property <ChevronRight className="h-3 w-3" />
        </span>
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </li>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">
        {icon}
      </span>
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

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">
          {icon}
        </span>
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
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
