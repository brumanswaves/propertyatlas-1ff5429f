import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  Bookmark,
  Building2,
  ChevronRight,
  FileText,
  Link2,
  MapPinned,
  NotebookPen,
  PlayCircle,
  Sparkles,
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
import { GUIDED_INVESTIGATION_STEPS } from "@/lib/investigation/guidedJourney";
import { readErfWorkspaceState, type ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import {
  buildSavedInvestigationProjection,
  readSavedInvestigationProjection,
  type SavedInvestigationProjectionV1,
} from "@/lib/workbench/savedInvestigationProjection";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: `My Investigations | ${BRAND.site}` },
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

interface SavedRow {
  parcel_id: string;
  created_at: string | null;
  research_status: string | null;
  status: string | null;
  tags: string[] | null;
  user_data: unknown;
}

interface NoteRow {
  parcel_id: string;
  updated_at: string | null;
}

interface ActivityRow {
  kind: "saved" | "note" | "market" | "investigation";
  label: string;
  at: string;
}

interface InvestigationSummary {
  projection: SavedInvestigationProjectionV1 | null;
  source: "cloud" | "browser" | "none";
  started: boolean;
  currentStepIndex: number | null;
  currentStepLabel: string;
  lastActivityAt: string | null;
}

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const greetingName = getUserGreetingName(user);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingRows(true);
    void (async () => {
      const [savedResult, notesResult] = await Promise.all([
        supabase
          .from("saved_properties")
          .select("parcel_id, created_at, research_status, status, tags, user_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("property_notes").select("parcel_id, updated_at").eq("user_id", user.id),
      ]);

      if (!active) return;
      if (savedResult.error) toast.error("Could not load your saved properties.");
      setSaved((savedResult.data ?? []) as SavedRow[]);
      setNotes((notesResult.data ?? []) as NoteRow[]);
      setLoadingRows(false);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const rows = useMemo(
    () =>
      saved.map((row) => ({
        row,
        summary: investigationSummary(row, user?.id ?? null),
        marketEvidence: savedMarketEvidence(row),
      })),
    [saved, user?.id],
  );

  const counts = useMemo(() => {
    const activeInvestigations = rows.filter(({ summary }) => summary.started).length;
    const reportsOpened = rows.filter(({ summary }) => summary.projection?.reportStarted).length;
    const sitePotentialActive = rows.filter(({ summary }) => {
      const state = summary.projection?.sitePotential.progressState;
      return Boolean(state && state !== "not_started" && state !== "skipped");
    }).length;
    return {
      properties: rows.length,
      activeInvestigations,
      reportsOpened,
      sitePotentialActive,
    };
  }, [rows]);

  const activity = useMemo<ActivityRow[]>(() => {
    const marketRows = rows.flatMap(({ row, marketEvidence }) =>
      marketEvidence.map((item) => ({ row, item })),
    );
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
          ? [{ kind: "note", label: `Updated notes for ${savedTitleByParcel(saved, note.parcel_id)}`, at: note.updated_at }]
          : [],
      ),
      ...marketRows.flatMap(({ row, item }): ActivityRow[] => {
        const at = item.updatedAt ?? item.savedAt;
        return at ? [{ kind: "market", label: `Updated Market Evidence for ${savedTitle(row)}`, at }] : [];
      }),
    ]
      .filter((item) => validDate(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [notes, rows, saved]);

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
    setSaved((current) => current.filter((row) => row.parcel_id !== parcelId));
    toast.success("Saved property removed");
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> My Easy Erf
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              My Investigations
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Welcome back, {greetingName}. See every property you saved, where you left off, and the investigation work already attached to it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-soft hover:bg-muted"
            >
              <FileText className="h-3.5 w-3.5" /> My Reports
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
            >
              <MapPinned className="h-3.5 w-3.5" /> Find another property
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Bookmark className="h-4 w-4" />} label="Saved properties" value={counts.properties} />
          <KpiCard icon={<PlayCircle className="h-4 w-4" />} label="Investigations started" value={counts.activeInvestigations} />
          <KpiCard icon={<FileText className="h-4 w-4" />} label="Reports opened" value={counts.reportsOpened} />
          <KpiCard icon={<Building2 className="h-4 w-4" />} label="Site Potential active" value={counts.sitePotentialActive} />
        </div>

        <section className="mt-10">
          <SectionTitle icon={<Bookmark className="h-3.5 w-3.5" />}>Your properties</SectionTitle>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Investigation status comes from the same saved property/workspace state used by Easy Erf. It is a durable dashboard summary, not a separate progress score.
          </p>

          {loadingRows ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => (
                <div key={item} className="h-64 animate-pulse rounded-3xl border border-border bg-card" />
              ))}
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
              {rows.map(({ row, summary, marketEvidence }) => (
                <InvestigationCard
                  key={row.parcel_id}
                  row={row}
                  summary={summary}
                  marketEvidenceCount={marketEvidence.length}
                  onRemove={removeSavedProperty}
                />
              ))}
            </div>
          )}
        </section>

        {activity.length > 0 && (
          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <Panel icon={<Sparkles className="h-3.5 w-3.5" />} title="Recent activity">
              <ul className="divide-y divide-border">
                {activity.map((item, index) => (
                  <li key={`${item.kind}-${item.at}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                    <span className="truncate text-foreground">{item.label}</span>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">{formatDate(item.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<NotebookPen className="h-3.5 w-3.5" />} title="What this dashboard does">
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>Use each property card to continue Guided Investigation or open its current Easy Erf Report.</p>
                <p>Important evidence confidence still lives inside the property investigation and report. This dashboard deliberately avoids inventing a second readiness score.</p>
              </div>
            </Panel>
          </section>
        )}

        {rows.some(({ marketEvidence }) => marketEvidence.length > 0) && (
          <section className="mt-10">
            <SectionTitle icon={<Link2 className="h-3.5 w-3.5" />}>Market Evidence</SectionTitle>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {rows
                .filter(({ marketEvidence }) => marketEvidence.length > 0)
                .map(({ row }) => (
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
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(data: unknown, key: string): string | null {
  if (!isRecord(data)) return null;
  const value = data[key];
  return value === null || value === undefined || String(value).trim() === "" ? null : String(value);
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

function workspaceHasMeaningfulState(workspace: ErfWorkspaceState) {
  return Boolean(
    workspace.investigation.startedAt ||
      workspace.identityStatus !== "none" ||
      workspace.sgDiagramAttachmentCount > 0 ||
      workspace.marketEvidenceStarted ||
      workspace.strategyScenarioCount > 0 ||
      workspace.reportStarted ||
      workspace.planning.zoneCode ||
      workspace.sitePotential.progressState !== "not_started",
  );
}

function investigationSummary(row: SavedRow, userId: string | null): InvestigationSummary {
  const cloud = readSavedInvestigationProjection(row.user_data);
  let projection = cloud;
  let source: InvestigationSummary["source"] = cloud ? "cloud" : "none";

  if (!projection && userId) {
    const browserWorkspace = readErfWorkspaceState(row.parcel_id, undefined, userId);
    if (workspaceHasMeaningfulState(browserWorkspace)) {
      projection = buildSavedInvestigationProjection(
        row.parcel_id,
        browserWorkspace,
        browserWorkspace.updatedAt,
      );
      source = "browser";
    }
  }

  const started = Boolean(projection?.investigation.startedAt);
  const currentStepId = projection?.investigation.currentStepId;
  const currentIndex = currentStepId
    ? GUIDED_INVESTIGATION_STEPS.findIndex((step) => step.id === currentStepId)
    : -1;
  const currentStep = currentIndex >= 0 ? GUIDED_INVESTIGATION_STEPS[currentIndex] : null;
  const lastActivityAt = newestDate([
    projection?.investigation.lastMeaningfulActionAt,
    projection?.investigation.lastViewedAt,
    projection?.workspaceUpdatedAt,
    row.created_at,
  ]);

  return {
    projection,
    source,
    started,
    currentStepIndex: currentStep ? currentIndex + 1 : started ? 1 : null,
    currentStepLabel: currentStep?.label ?? (started ? "Confirm property" : "Not started"),
    lastActivityAt,
  };
}

function savedTitle(row: SavedRow): string {
  const title =
    stringField(row.user_data, "displayTitle") ??
    stringField(row.user_data, "address") ??
    stringField(row.user_data, "researchQuery");
  if (title) return title;
  const erf = stringField(row.user_data, "erfNumber") ?? stringField(row.user_data, "erf");
  return erf ? `Erf ${erf}` : isOfficialParcelId(row.parcel_id) ? "Official parcel" : row.parcel_id;
}

function savedTitleByParcel(rows: SavedRow[], parcelId: string) {
  const row = rows.find((candidate) => candidate.parcel_id === parcelId);
  return row ? savedTitle(row) : parcelId;
}

function propertyHref(row: SavedRow) {
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

function withTab(href: string, tab: "investigation" | "stoep-report") {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}tab=${tab}`;
}

function InvestigationCard({
  row,
  summary,
  marketEvidenceCount,
  onRemove,
}: {
  row: SavedRow;
  summary: InvestigationSummary;
  marketEvidenceCount: number;
  onRemove: (parcelId: string) => Promise<void>;
}) {
  const title = savedTitle(row);
  const href = propertyHref(row);
  const projection = summary.projection;
  const erf = stringField(row.user_data, "erfNumber") ?? stringField(row.user_data, "erf");
  const portion = stringField(row.user_data, "portion");
  const municipality = stringField(row.user_data, "municipality") ?? stringField(row.user_data, "town");
  const province = stringField(row.user_data, "province");

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
              {isOfficialParcelId(row.parcel_id) && (
                <StatusChip tone="supported">Official parcel</StatusChip>
              )}
              {summary.source === "cloud" && <StatusChip tone="neutral">Saved status synced</StatusChip>}
              {projection?.identityStatus === "uncertain" && (
                <StatusChip tone="warning">Identity uncertain</StatusChip>
              )}
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">{title}</h2>
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
                  : "Not started"}
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
        <MiniStatus label="Market Evidence" value={marketEvidenceCount ? `${marketEvidenceCount} saved` : "Not started"} />
        <MiniStatus label="Strategy" value={strategyLabel(projection)} />
        <MiniStatus label="Site Potential" value={sitePotentialLabel(projection)} />
        <MiniStatus label="Easy Erf Report" value={projection?.reportStarted ? "Opened" : "Not reviewed"} />
        <MiniStatus label="Last activity" value={summary.lastActivityAt ? formatDate(summary.lastActivityAt) : "No activity yet"} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={(event) => navigateAction(event, withTab(href, "investigation"))}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          {summary.started ? "Continue Investigation" : "Start Investigation"}
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

function identityLabel(projection: SavedInvestigationProjectionV1 | null) {
  if (!projection) return "Not confirmed";
  if (projection.identityStatus === "looks_correct") return "Confirmed by user";
  if (projection.identityStatus === "uncertain") return "Uncertain";
  if (projection.identityStatus === "checked") return "Checked";
  return "Not confirmed";
}

function strategyLabel(projection: SavedInvestigationProjectionV1 | null) {
  if (!projection || projection.strategyScenarioCount === 0) return "Not started";
  if (projection.chosenScenarioId) return "Chosen scenario saved";
  return `${projection.strategyScenarioCount} scenario${projection.strategyScenarioCount === 1 ? "" : "s"}`;
}

function sitePotentialLabel(projection: SavedInvestigationProjectionV1 | null) {
  const state = projection?.sitePotential.progressState;
  if (!state || state === "not_started") return "Not started";
  if (state === "inputs_added") return "Inputs added";
  if (state === "ready_to_generate") return "Ready to generate";
  if (state === "generating") return "Generating";
  if (state === "concepts_ready") return "Concepts ready";
  if (state === "design_selected") return "Concept selected";
  if (state === "skipped") return "Skipped";
  if (state === "failed") return "Needs attention";
  return "Not started";
}

function StatusChip({ children, tone }: { children: ReactNode; tone: "supported" | "warning" | "neutral" }) {
  const classes =
    tone === "supported"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-amber-100 text-amber-900"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${classes}`}>{children}</span>;
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

function validDate(value: string | null | undefined) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function newestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => validDate(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function formatDate(value: string | null) {
  if (!value || !validDate(value)) return "Unknown";
  return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(value: number | undefined | null): string {
  if (!value) return "No price entered";
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function MarketEvidenceDashboardRow({ row }: { row: SavedRow }) {
  const evidence = savedMarketEvidence(row);
  const summary = calculateMarketEvidenceSummary(evidence);
  const primary = evidence[0];
  const rate = summary.averageLandPricePerM2
    ? `Avg land R/m² ${Math.round(summary.averageLandPricePerM2).toLocaleString("en-ZA")}`
    : "No R/m² summary yet";

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

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">{icon}</span>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
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
        <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">{icon}</span>
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
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{body}</p>
      {cta && (
        <Link to={cta.to} className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
