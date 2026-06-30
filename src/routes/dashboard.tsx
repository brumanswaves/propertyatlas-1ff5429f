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
import { calculateMarketEvidenceSummary } from "@/features/marketEvidence/calculateMarketEvidenceSummary";
import {
  CONFIDENCE_LABELS,
  RELATIONSHIP_LABELS,
  type SavedMarketEvidence,
} from "@/features/marketEvidence/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ErfStop" },
      {
        name: "description",
        content:
          "Your saved parcels, notes, market evidence, report interests, and due-diligence checklist.",
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
  savedMarketEvidence: number;
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
interface ActivityRow {
  kind: string;
  label: string;
  at: string;
}

const NEXT_ACTIONS = [
  "Open the map and continue a saved dossier",
  "Add a note or question to a saved erf",
  "Use Market Evidence to save verified source URLs",
  "Run calculators from a saved property dossier",
  "Save report interest when Lightstone or WinDeed data is needed",
];

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const greetingName = getUserGreetingName(user);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    savedProperties: 0,
    notesProperties: 0,
    savedMarketEvidence: 0,
    reportInterests: 0,
  });
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, n] = await Promise.all([
        supabase
          .from("saved_properties")
          .select("parcel_id, created_at, research_status, status, tags, user_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("property_notes").select("parcel_id, updated_at").eq("user_id", user.id),
      ]);
      const savedRows = (s.data ?? []) as SavedRow[];
      const noteRows = (n.data ?? []) as { parcel_id: string; updated_at: string | null }[];
      const marketEvidenceRows = savedRows.flatMap((row) =>
        savedMarketEvidence(row).map((item) => ({ row, item })),
      );

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
      setCounts({
        savedProperties: savedRows.length,
        notesProperties: noteRows.length,
        savedMarketEvidence: marketEvidenceRows.length,
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
        ...marketEvidenceRows.slice(0, 5).map(({ row, item }) => ({
          kind: "market-evidence",
          label: `Saved market evidence for ${savedTitle(row)}`,
          at: item.updatedAt ?? item.savedAt ?? "",
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
              Saved research dossiers, notes, market evidence, and report interests.
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
            label="Market evidence"
            value={counts.savedMarketEvidence}
          />
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label="Report interests"
            value={counts.reportInterests}
          />
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Panel icon={<ClipboardList className="h-3.5 w-3.5" />} title="Next best actions">
            <ul className="space-y-1.5 text-[12.5px]">
              {NEXT_ACTIONS.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="text-muted-foreground">{c}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {activity.length > 0 && (
            <Panel icon={<Sparkles className="h-3.5 w-3.5" />} title="Recent activity">
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
            </Panel>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle icon={<Bookmark className="h-3.5 w-3.5" />}>
            Saved Research Dossiers
          </SectionTitle>
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

        {saved.some((row) => savedMarketEvidence(row).length > 0) && (
          <section className="mt-10">
            <SectionTitle icon={<Link2 className="h-3.5 w-3.5" />}>Market Evidence</SectionTitle>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {saved
                .filter((row) => savedMarketEvidence(row).length > 0)
                .map((row) => (
                  <MarketEvidenceDashboardRow key={row.parcel_id} row={row} />
                ))}
            </ul>
          </section>
        )}
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

function savedMarketEvidence(row: SavedRow): SavedMarketEvidence[] {
  if (!isRecord(row.user_data) || !Array.isArray(row.user_data.savedMarketEvidence)) return [];
  return row.user_data.savedMarketEvidence
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? ""),
      parcelId: String(item.parcelId ?? row.parcel_id),
      sourceUrl: String(item.sourceUrl ?? ""),
      sourcePortal: String(item.sourcePortal ?? "Other"),
      title: String(item.title ?? "Saved market evidence"),
      askingPrice: item.askingPrice == null ? null : Number(item.askingPrice),
      propertyType: item.propertyType == null ? null : String(item.propertyType),
      beds: item.beds == null ? null : Number(item.beds),
      baths: item.baths == null ? null : Number(item.baths),
      landSizeM2: item.landSizeM2 == null ? null : Number(item.landSizeM2),
      buildingSizeM2: item.buildingSizeM2 == null ? null : Number(item.buildingSizeM2),
      relationship: String(item.relationship ?? "weak_comp") as SavedMarketEvidence["relationship"],
      confidence: String(item.confidence ?? "low") as SavedMarketEvidence["confidence"],
      includeInSummary: Boolean(item.includeInSummary),
      notes: item.notes == null ? null : String(item.notes),
      savedAt: String(item.savedAt ?? row.created_at ?? ""),
      updatedAt: String(item.updatedAt ?? item.savedAt ?? row.created_at ?? ""),
    }))
    .filter((item) => item.sourceUrl);
}

function formatMoney(value: number | undefined | null): string {
  if (!value) return "No price entered";
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
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
  const calculatorHref = `${href}${href.includes("?") ? "&" : "?"}tab=calc`;
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
  const runCalculator = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(calculatorHref);
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
        <button
          type="button"
          onClick={runCalculator}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
          aria-label={`Run calculator for ${title}`}
          title="Open the property and use the Calc tab. Calculator scenarios are not saved yet."
        >
          <Calculator className="h-3.5 w-3.5" />
          Run calculator
        </button>
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

function MarketEvidenceDashboardRow({ row }: { row: SavedRow }) {
  const evidence = savedMarketEvidence(row);
  const summary = calculateMarketEvidenceSummary(evidence);
  const primary = evidence[0];
  const rate = summary.averageLandPricePerM2
    ? `Avg land R/m2 ${Math.round(summary.averageLandPricePerM2).toLocaleString("en-ZA")}`
    : "No R/m2 summary yet";

  return (
    <li className="flex flex-col gap-3 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="font-medium">{savedTitle(row)}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {evidence.length} evidence item{evidence.length === 1 ? "" : "s"}
          </span>
          {primary && (
            <>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {RELATIONSHIP_LABELS[primary.relationship]}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {CONFIDENCE_LABELS[primary.confidence]}
              </span>
            </>
          )}
        </div>
        {primary && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {formatMoney(primary.askingPrice)} / {rate}
            {primary.notes ? ` / ${primary.notes}` : ""}
          </p>
        )}
      </div>
      {primary?.sourceUrl && (
        <a
          href={primary.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"
        >
          Open source <ChevronRight className="h-3 w-3" />
        </a>
      )}
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
