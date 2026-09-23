import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Bookmark,
  Building2,
  ChevronRight,
  FileText,
  Link2,
  NotebookPen,
  PlayCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerWorkspaceShell } from "@/components/account/CustomerWorkspaceShell";
import { useAuth } from "@/lib/auth/useAuth";
import { StaffDashboardLinks } from "@/components/admin/StaffDashboardLinks";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSavedParcelMapHref,
  isDemoParcelId,
  isOfficialParcelId,
} from "@/lib/parcels/officialParcelId";
import { GUIDED_INVESTIGATION_STEPS } from "@/lib/investigation/guidedJourney";
import {
  readDashboardMetadata,
  dashboardProgress,
  type DashboardMetadata as SavedRow,
  type DashboardNote as NoteRow,
  type DashboardProgress as InvestigationSummary,
} from "@/lib/workbench/dashboardMetadata";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: `My Properties | ${BRAND.site}` },
      {
        name: "description",
        content:
          "Your saved Easy Erf properties, investigation position, Site Potential status, report status and recent activity.",
      },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
  component: Dashboard,
});

interface ActivityRow {
  kind: "saved" | "note" | "market" | "investigation";
  label: string;
  at: string;
}

const EMPTY_SAVED: SavedRow[] = [];
const EMPTY_NOTES: NoteRow[] = [];

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!loading && !user)
      navigate({
        to: "/auth",
        search: {
          redirect: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        },
      });
  }, [user, loading, navigate]);
  if (loading || !userId) return null;
  return <AccountDashboard key={userId} userId={userId} />;
}

function AccountDashboard({ userId }: { userId: string }) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [reloadRequest, setReloadRequest] = useState(0);
  const [response, setResponse] = useState<{
    userId: string;
    saved: SavedRow[];
    notes: NoteRow[];
    failed: boolean;
    complete: boolean;
  } | null>(null);
  // Hide the previous account's rows, counts and activity during the render
  // before effect cleanup runs, as well as while the next request is pending.
  const currentResponse = userId && response?.userId === userId ? response : null;
  const saved = currentResponse?.saved ?? EMPTY_SAVED;
  const notes = currentResponse?.notes ?? EMPTY_NOTES;
  const loadingRows = !currentResponse;
  const countsAvailable = !loadingRows && !currentResponse?.failed && currentResponse?.complete;

  useEffect(() => {
    const request = new AbortController();
    void (async () => {
      try {
        const result = await readDashboardMetadata(userId, request.signal);
        if (request.signal.aborted) return;
        setResponse({ userId, ...result, failed: false });
      } catch {
        if (request.signal.aborted) return;
        request.abort();
        setResponse({ userId, saved: [], notes: [], failed: true, complete: false });
      }
    })();

    return () => request.abort();
  }, [userId, reloadRequest]);

  const rows = useMemo(
    () =>
      saved.map((row) => ({
        row,
        summary: dashboardProgress(row),
      })),
    [saved],
  );

  const counts = useMemo(() => {
    const countKnown = (values: Array<boolean | null>) =>
      values.some((value) => value === null) ? "Status unavailable" : values.filter(Boolean).length;
    return {
      properties: rows.length,
      activeInvestigations: countKnown(rows.map(({ summary }) => summary.started)),
      reportsOpened: countKnown(rows.map(({ summary }) => summary.reportStarted)),
      sitePotentialActive: countKnown(
        rows.map(({ summary }) =>
          summary.sitePotentialState === null
            ? null
            : !["not_started", "skipped"].includes(summary.sitePotentialState),
        ),
      ),
    };
  }, [rows]);

  const activity = useMemo<ActivityRow[]>(() => {
    return [
      ...rows.flatMap(({ row, summary }) => {
        const entries: ActivityRow[] = [];
        if (row.created_at) {
          entries.push({ kind: "saved", label: `Saved ${savedTitle(row)}`, at: row.created_at });
        }
        if (summary.lastActivityAt) {
          entries.push({
            kind: "investigation",
            label: `${summary.started ? "Worked on" : "Updated"} ${savedTitle(row)}`,
            at: summary.lastActivityAt,
          });
        }
        return entries;
      }),
      ...notes.flatMap((note): ActivityRow[] =>
        note.updated_at
          ? [
              {
                kind: "note",
                label: `Updated notes for ${savedTitleByParcel(saved, note.parcel_id)}`,
                at: note.updated_at,
              },
            ]
          : [],
      ),
    ]
      .filter((item) => validDate(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [notes, rows, saved]);

  async function removeSavedProperty(parcelId: string) {
    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", userId)
      .eq("parcel_id", parcelId);
    if (!mounted.current) return;
    if (error) {
      toast.error(error.message);
      return;
    }
    setResponse((current) =>
      current?.userId === userId
        ? { ...current, saved: current.saved.filter((row) => row.parcel_id !== parcelId) }
        : current,
    );
    toast.success("Saved property removed");
  }

  return (
    <CustomerWorkspaceShell activeTab="investigations">
      <StaffDashboardLinks />
      <section aria-label="My Investigations">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">My Investigations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            See every property you saved, where you left off, and the investigation work already
            attached to it.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Bookmark className="h-4 w-4" />}
            label="Saved properties"
            value={countsAvailable ? counts.properties : "Not loaded"}
          />
          <KpiCard
            icon={<PlayCircle className="h-4 w-4" />}
            label="Investigations started"
            value={countsAvailable ? counts.activeInvestigations : "Not loaded"}
          />
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label="Reports opened"
            value={countsAvailable ? counts.reportsOpened : "Not loaded"}
          />
          <KpiCard
            icon={<Building2 className="h-4 w-4" />}
            label="Site Potential active"
            value={countsAvailable ? counts.sitePotentialActive : "Not loaded"}
          />
        </div>

        <section className="mt-10">
          <SectionTitle icon={<Bookmark className="h-3.5 w-3.5" />}>Your properties</SectionTitle>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Saved status comes from investigation metadata. Unsaved browser drafts may be newer and
            stay unchanged until you open the property.
          </p>

          {currentResponse && !currentResponse.failed && !currentResponse.complete && (
            <div role="status" className="mt-3 text-sm">
              <p>Showing a partial list. Totals and recent activity are unavailable.</p>
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full border px-4"
                onClick={() => {
                  setResponse(null);
                  setReloadRequest((value) => value + 1);
                }}
              >
                Try loading again
              </button>
            </div>
          )}
          {loadingRows ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-3xl border border-border bg-card"
                />
              ))}
            </div>
          ) : currentResponse?.failed ? (
            <div role="alert" className="mt-4 rounded-2xl border border-border bg-card p-6 text-sm">
              <p>
                We could not load your saved investigations. Your saved work has not been changed.
              </p>
              <button
                type="button"
                className="mt-3 min-h-11 rounded-full border border-border px-5 py-2 font-semibold"
                onClick={() => {
                  setResponse(null);
                  setReloadRequest((request) => request + 1);
                }}
              >
                Try loading again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyCard
              icon={<Bookmark className="h-5 w-5" />}
              title="No saved properties yet"
              body="Find an erf, open Property Overview, then save it when you want Easy Erf to keep it in My Investigations."
              cta={{ to: "/", label: "Find a Property" }}
            />
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {rows.map(({ row, summary }) => (
                <InvestigationCard
                  key={row.parcel_id}
                  row={row}
                  summary={summary}
                  onRemove={removeSavedProperty}
                />
              ))}
            </div>
          )}
        </section>

        {currentResponse?.complete && activity.length > 0 && (
          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <Panel icon={<Sparkles className="h-3.5 w-3.5" />} title="Recent activity">
              <ul className="divide-y divide-border">
                {activity.map((item, index) => (
                  <li
                    key={`${item.kind}-${item.at}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]"
                  >
                    <span className="truncate text-foreground">{item.label}</span>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">
                      {formatDate(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<NotebookPen className="h-3.5 w-3.5" />} title="What this dashboard does">
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Use each property card to continue Guided Investigation or open its current Easy
                  Erf Report.
                </p>
                <p>
                  Important evidence confidence still lives inside the property investigation and
                  report. This dashboard deliberately avoids inventing a second readiness score.
                </p>
              </div>
            </Panel>
          </section>
        )}
      </section>
    </CustomerWorkspaceShell>
  );
}

function stringField(row: SavedRow, key: keyof SavedRow): string | null {
  const value = row[key];
  return (typeof value === "string" || typeof value === "number") && String(value).trim()
    ? String(value)
    : null;
}

function savedTitle(row: SavedRow): string {
  const title = stringField(row, "displayTitle") ?? stringField(row, "address");
  if (title) return title;
  const erf = stringField(row, "erfNumber") ?? stringField(row, "erf");
  return erf ? `Erf ${erf}` : isOfficialParcelId(row.parcel_id) ? "Official parcel" : row.parcel_id;
}

function savedTitleByParcel(rows: SavedRow[], parcelId: string) {
  const row = rows.find((candidate) => candidate.parcel_id === parcelId);
  return row ? savedTitle(row) : parcelId;
}

function propertyHref(row: SavedRow) {
  const demo = isDemoParcelId(row.parcel_id);
  const title = savedTitle(row);
  const erf = stringField(row, "erfNumber") ?? stringField(row, "erf");
  const portion = stringField(row, "portion");
  const municipality =
    stringField(row, "municipality") ?? stringField(row, "town") ?? stringField(row, "majorRegion");
  const province = stringField(row, "province");
  const lat = stringField(row, "lat") ?? stringField(row, "latitude");
  const lng = stringField(row, "lng") ?? stringField(row, "longitude");

  return demo
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
}

function withTab(href: string, tab: "investigation" | "stoep-report" | "listings") {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}tab=${tab}`;
}

function InvestigationCard({
  row,
  summary,
  onRemove,
}: {
  row: SavedRow;
  summary: InvestigationSummary;
  onRemove: (parcelId: string) => Promise<void>;
}) {
  const title = savedTitle(row);
  const href = propertyHref(row);
  const projection = summary;
  const erf = stringField(row, "erfNumber") ?? stringField(row, "erf");
  const portion = stringField(row, "portion");
  const municipality = stringField(row, "municipality") ?? stringField(row, "town");
  const province = stringField(row, "province");

  const open = () => window.location.assign(href);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
  const remove = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("Remove this saved property from My Investigations?")) return;
    await onRemove(row.parcel_id);
  };
  const navigateAction = (event: MouseEvent<HTMLButtonElement>, target: string) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(target);
  };

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:shadow-panel">
      <div
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKeyDown}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {isOfficialParcelId(row.parcel_id) &&
                (row.parcel_id.trim().toLowerCase().startsWith("manual:") ? (
                  <StatusChip tone="neutral">Manual parcel record</StatusChip>
                ) : (
                  <StatusChip tone="supported">Official parcel</StatusChip>
                ))}
              {summary.source === "cloud" && (
                <StatusChip tone="neutral">Saved status synced</StatusChip>
              )}
              {projection?.identityStatus === "uncertain" && (
                <StatusChip tone="warning">Identity uncertain</StatusChip>
              )}
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {erf && <span>Erf {erf}</span>}
              {portion && <span>Portion {portion}</span>}
              {municipality && <span>{municipality}</span>}
              {province && <span>{province}</span>}
            </div>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Guided Investigation
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {summary.started && summary.currentStepIndex
                  ? `Step ${summary.currentStepIndex} of ${GUIDED_INVESTIGATION_STEPS.length} · ${summary.currentStepLabel}`
                  : summary.started === false
                    ? "Not started"
                    : "Status unavailable"}
              </div>
            </div>
            {summary.started ? (
              <PlayCircle className="h-5 w-5 text-accent" />
            ) : (
              <Bookmark className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {summary.started
              ? "Continue from the last recorded Guided step. Evidence completion is still derived inside the property investigation."
              : "Open Guided Investigation when you are ready to confirm the parcel and begin the evidence journey."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniStatus label="Identity" value={identityLabel(projection)} />
        <MiniStatus
          label="Market Evidence"
          value={
            summary.marketEvidenceStarted === true
              ? "Started; open for details"
              : summary.marketEvidenceStarted === false
                ? "Not started"
                : "Status unavailable"
          }
        />
        <MiniStatus label="Strategy" value={strategyLabel(projection)} />
        <MiniStatus label="Site Potential" value={sitePotentialLabel(projection)} />
        <MiniStatus
          label="Easy Erf Report"
          value={
            summary.reportStarted === true
              ? "Opened"
              : summary.reportStarted === false
                ? "Not reviewed"
                : "Status unavailable"
          }
        />
        <MiniStatus
          label="Last activity"
          value={summary.lastActivityAt ? formatDate(summary.lastActivityAt) : "Status unavailable"}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={(event) => navigateAction(event, withTab(href, "investigation"))}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          {summary.started === true
            ? "Continue Investigation"
            : summary.started === false
              ? "Start Investigation"
              : "Start / Continue Investigation"}
        </button>
        <button
          type="button"
          onClick={(event) => navigateAction(event, withTab(href, "stoep-report"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          <FileText className="h-3.5 w-3.5" /> Open Report
        </button>
        <button
          type="button"
          onClick={(event) => navigateAction(event, withTab(href, "listings"))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted"
        >
          <Link2 className="h-3.5 w-3.5" /> Open Market evidence
        </button>
        <button
          type="button"
          onClick={remove}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </article>
  );
}

function identityLabel(projection: InvestigationSummary | null) {
  if (!projection || projection.identityStatus === null) return "Status unavailable";
  if (projection.identityStatus === "looks_correct") return "Confirmed by user";
  if (projection.identityStatus === "uncertain") return "Uncertain";
  if (projection.identityStatus === "checked") return "Checked";
  return "Not confirmed";
}

function strategyLabel(projection: InvestigationSummary | null) {
  if (projection?.chosenScenarioId) return "Chosen scenario saved";
  if (!projection || projection.strategyScenarioCount === null) return "Status unavailable";
  if (projection.strategyScenarioCount === 0) return "Not started";
  return `${projection.strategyScenarioCount} scenario${projection.strategyScenarioCount === 1 ? "" : "s"}`;
}

function sitePotentialLabel(projection: InvestigationSummary | null) {
  const state = projection?.sitePotentialState;
  if (!state) return "Status unavailable";
  if (state === "not_started") return "Not started";
  if (state === "inputs_added") return "Inputs added";
  if (state === "ready_to_generate") return "Ready to generate";
  if (state === "generating") return "Generating";
  if (state === "concepts_ready") return "Concepts ready";
  if (state === "design_selected") return "Concept selected";
  if (state === "skipped") return "Skipped";
  if (state === "failed") return "Needs attention";
  return "Not started";
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "supported" | "warning" | "neutral";
}) {
  const classes =
    tone === "supported"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-amber-100 text-amber-900"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${classes}`}
    >
      {children}
    </span>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

function validDate(value: string | null | undefined) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function formatDate(value: string | null) {
  if (!value || !validDate(value)) return "Unknown";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">
        {icon}
      </span>
      {children}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
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

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: { to: "/"; label: string };
}) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
