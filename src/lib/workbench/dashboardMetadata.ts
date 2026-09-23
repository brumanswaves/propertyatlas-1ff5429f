import { supabase } from "@/integrations/supabase/client";
import { GUIDED_INVESTIGATION_STEPS } from "@/lib/investigation/guidedJourney";

// Only scalar leaves used by list display/navigation. No investigation objects,
// listing arrays, research queries, report bodies, notes or document content.
const displayKeys = [
  "displayTitle",
  "address",
  "erfNumber",
  "erf",
  "portion",
  "municipality",
  "town",
  "majorRegion",
  "province",
  "lat",
  "latitude",
  "lng",
  "longitude",
] as const;
const progressPaths = {
  projectionVersion: "version",
  projectionParcelId: "parcelId",
  identityStatus: "identityStatus",
  marketEvidenceStarted: "marketEvidenceStarted",
  strategyScenarioCount: "strategyScenarioCount",
  chosenScenarioId: "chosenScenarioId",
  reportStarted: "reportStarted",
  workspaceUpdatedAt: "workspaceUpdatedAt",
  startedAt: "investigation->startedAt",
  currentStepId: "investigation->currentStepId",
  lastViewedAt: "investigation->lastViewedAt",
  lastMeaningfulActionAt: "investigation->lastMeaningfulActionAt",
  sitePotentialState: "sitePotential->progressState",
} as const;
export const DASHBOARD_METADATA_SELECT = [
  "user_id",
  "parcel_id",
  "created_at",
  ...displayKeys.map((key) => `${key}:user_data->${key}`),
  ...Object.entries(progressPaths).map(
    ([alias, path]) => `${alias}:user_data->easyErfInvestigation->${path}`,
  ),
].join(",");
export const DASHBOARD_PAGE_SIZE = 100;
const MAX_PAGES = 10;
type DisplayKey = (typeof displayKeys)[number];
export type DashboardMetadata = {
  user_id: string;
  parcel_id: string;
  created_at: string | null;
} & Record<DisplayKey, string | number | null> &
  Record<keyof typeof progressPaths, string | number | boolean | null>;
export interface DashboardNote {
  user_id: string;
  parcel_id: string;
  updated_at: string | null;
}
export interface DashboardProgress {
  source: "cloud" | "none";
  started: boolean | null;
  currentStepIndex: number | null;
  currentStepLabel: string;
  lastActivityAt: string | null;
  identityStatus: string | null;
  marketEvidenceStarted: boolean | null;
  strategyScenarioCount: number | null;
  chosenScenarioId: string | null;
  reportStarted: boolean | null;
  sitePotentialState: string | null;
}
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const date = (value: unknown) =>
  text(value) && Number.isFinite(Date.parse(String(value))) ? String(value) : null;
const flag = (value: unknown) => (typeof value === "boolean" ? value : null);
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function validateDashboardRows(data: unknown, owner: string): DashboardMetadata[] {
  if (!Array.isArray(data)) throw new Error("Invalid property metadata response");
  const seen = new Set<string>();
  const allowed = new Set([
    "user_id",
    "parcel_id",
    "created_at",
    ...displayKeys,
    ...Object.keys(progressPaths),
  ]);
  return data.map((row: unknown) => {
    if (
      !record(row) ||
      row.user_id !== owner ||
      !text(row.parcel_id) ||
      seen.has(String(row.parcel_id))
    )
      throw new Error("Ambiguous property metadata identity");
    for (const [key, value] of Object.entries(row)) {
      if (
        !allowed.has(key) ||
        (value != null && !["string", "number", "boolean"].includes(typeof value))
      )
        throw new Error("Unexpected metadata shape");
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("Invalid metadata number");
    }
    for (const key of displayKeys)
      if (row[key] != null && !["string", "number"].includes(typeof row[key]))
        throw new Error("Invalid display metadata");
    if (row.created_at != null && !date(row.created_at)) throw new Error("Invalid saved timestamp");
    if (row.projectionParcelId != null && row.projectionParcelId !== row.parcel_id)
      throw new Error("Mismatched investigation metadata identity");
    seen.add(String(row.parcel_id));
    return row as DashboardMetadata;
  });
}

/** No default workspace creation or browser-body reads on the list. Saved
 * status is explicitly cloud metadata; unsaved browser drafts stay untouched. */
export function dashboardProgress(row: DashboardMetadata): DashboardProgress {
  const supported = row.projectionVersion === 1 && row.projectionParcelId === row.parcel_id;
  const startedAt = supported ? date(row.startedAt) : null;
  // Null JSON leaves cannot distinguish omitted from explicitly null. Do not
  // manufacture an unstarted state from an absent timestamp.
  const stepIndex = supported
    ? GUIDED_INVESTIGATION_STEPS.findIndex((step) => step.id === row.currentStepId)
    : -1;
  const started = startedAt ? true : null;
  return {
    source: supported ? "cloud" : "none",
    started,
    currentStepIndex: stepIndex >= 0 ? stepIndex + 1 : null,
    currentStepLabel:
      stepIndex >= 0 ? GUIDED_INVESTIGATION_STEPS[stepIndex].label : "Status unavailable",
    lastActivityAt:
      [
        supported ? date(row.lastMeaningfulActionAt) : null,
        supported ? date(row.lastViewedAt) : null,
        supported ? date(row.workspaceUpdatedAt) : null,
        date(row.created_at),
      ]
        .filter((v): v is string => !!v)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    identityStatus:
      supported &&
      ["none", "checked", "looks_correct", "uncertain"].includes(String(row.identityStatus))
        ? String(row.identityStatus)
        : null,
    marketEvidenceStarted: supported ? flag(row.marketEvidenceStarted) : null,
    strategyScenarioCount: supported ? count(row.strategyScenarioCount) : null,
    chosenScenarioId: supported ? text(row.chosenScenarioId) : null,
    reportStarted: supported ? flag(row.reportStarted) : null,
    sitePotentialState:
      supported &&
      [
        "not_started",
        "inputs_added",
        "ready_to_generate",
        "generating",
        "concepts_ready",
        "design_selected",
        "skipped",
        "failed",
      ].includes(String(row.sitePotentialState))
        ? String(row.sitePotentialState)
        : null,
  };
}

export async function readDashboardMetadata(owner: string, signal: AbortSignal) {
  const assertCurrent = () => {
    if (signal.aborted) throw new Error("Cancelled dashboard read");
  };
  if (!owner.trim()) throw new Error("Missing dashboard owner");
  const read = async (table: "saved_properties" | "property_notes", select: string) => {
    const rows: unknown[] = [];
    let expected: number | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      assertCurrent();
      const offset = rows.length;
      const result = await supabase
        .from(table)
        .select(select, { count: "exact" })
        .eq("user_id", owner)
        .order(table === "saved_properties" ? "created_at" : "updated_at", { ascending: false })
        .order("parcel_id", { ascending: true })
        .range(offset, offset + DASHBOARD_PAGE_SIZE - 1)
        .abortSignal(signal);
      assertCurrent();
      if (
        result.error ||
        !Array.isArray(result.data) ||
        !Number.isSafeInteger(result.count) ||
        result.count! < 0
      )
        throw new Error("Dashboard read incomplete");
      if (expected !== null && result.count !== expected)
        throw new Error("Dashboard changed during paging");
      expected = result.count;
      rows.push(...result.data);
      if (rows.length > expected!) throw new Error("Invalid dashboard page");
      if (rows.length === expected) return { rows, complete: true };
      if (!result.data.length) throw new Error("Dashboard page missing");
    }
    return { rows, complete: false };
  };
  const [saved, notes] = await Promise.all([
    read("saved_properties", DASHBOARD_METADATA_SELECT),
    read("property_notes", "user_id,parcel_id,updated_at"),
  ]);
  assertCurrent();
  const validated = validateDashboardRows(saved.rows, owner);
  const noteKeys = new Set<string>();
  const noteRows = notes.rows.map((row) => {
    if (
      !record(row) ||
      row.user_id !== owner ||
      !text(row.parcel_id) ||
      noteKeys.has(String(row.parcel_id)) ||
      Object.keys(row).some((k) => !["user_id", "parcel_id", "updated_at"].includes(k)) ||
      (row.updated_at != null && !date(row.updated_at))
    )
      throw new Error("Invalid note metadata identity");
    noteKeys.add(String(row.parcel_id));
    return row as unknown as DashboardNote;
  });
  return { saved: validated, notes: noteRows, complete: saved.complete && notes.complete };
}
