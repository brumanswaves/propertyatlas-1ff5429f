import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileSearch,
  FolderOpen,
  Landmark,
  MapPin,
  Ruler,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveParcelArea,
  type ResolvedParcelArea,
} from "@/lib/evidence/parcelArea";
import {
  deriveInvestigationFacts,
  type BuildPropertyInvestigationInput,
} from "@/lib/investigation/propertyInvestigation";
import type { InvestigationFacts } from "@/lib/investigation/guidedTaskRegistry";
import type {
  ParcelPlanningAssessment,
  ZoningRule,
} from "@/lib/planning/municipalityPlanningTypes";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";

type EvidenceTone = "supported" | "progress" | "assumption" | "missing" | "uncertain";

export interface FirstReadStatus {
  id: string;
  label: string;
  status: string;
  detail: string;
  tone: EvidenceTone;
}

export interface FirstReadFact {
  label: string;
  value: string;
  note?: string;
}

export interface FirstReadPlanningRow {
  label: string;
  value: string;
  state: string;
  source: string;
}

export interface PropertyFirstReadModel {
  title: string;
  addressLine: string | null;
  placeLine: string | null;
  area: ResolvedParcelArea | null;
  facts: FirstReadFact[];
  evidenceStatuses: FirstReadStatus[];
  planningRows: FirstReadPlanningRow[];
  planningSummary: string;
  marketSummary: string;
  documentSummary: string;
  strategySummary: string;
  sitePotentialSummary: string;
  investigateLabel: "Investigate this property" | "Continue investigation";
}

export interface PropertyFirstReadProps {
  parcel: NormalizedOfficialParcel;
  displayTitle: string;
  displaySubtitle?: string | null;
  workingAddressLine?: string | null;
  investigationInput: BuildPropertyInvestigationInput;
  planning: ParcelPlanningAssessment;
  assets: ErfAsset[];
  savedEvidence: SavedMarketEvidence[];
  chosenScenario: ErfStrategyScenario | null;
  mapSlot: ReactNode;
  askSlot?: ReactNode;
  onInvestigate: () => void;
  onOpenExpertTools: () => void;
}

function hasText(value: unknown): value is string | number {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatArea(areaM2: number): string {
  return `${areaM2.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
}

function formatCoordinate(value: number | null | undefined): string | null {
  return Number.isFinite(value) ? Number(value).toFixed(6) : null;
}

function formatRuleValue(rule: ZoningRule): string {
  if (rule.value == null) return rule.statement;
  if (rule.unit === "percent") return `${rule.value}%`;
  if (rule.unit === "m") return `${rule.value} m`;
  if (rule.unit === "units") return String(rule.value);
  if (rule.unit === "ratio") return String(rule.value);
  return `${rule.value}${rule.unit ? ` ${rule.unit}` : ""}`;
}

function areaSourceLabel(area: ResolvedParcelArea): string {
  if (area.sourceKind === "verified_extent") return "Verified registered extent";
  if (area.sourceKind === "csg_geom_area") return "CSG cadastral area";
  if (area.sourceKind === "shape_area_approximate") return "Approximate map geometry area";
  return "Official source area";
}

function areaFactLabel(area: ResolvedParcelArea): string {
  if (area.sourceKind === "verified_extent") return "Registered extent";
  if (area.sourceKind === "csg_geom_area") return "Official cadastral area";
  if (area.sourceKind === "shape_area_approximate") return "Approximate parcel area";
  return "Official parcel area";
}

function liveAssets(assets: ErfAsset[]): ErfAsset[] {
  return assets.filter(
    (asset) => asset.status !== "deleted" && asset.status !== "archived" && asset.status !== "failed",
  );
}

function identityStatus(facts: InvestigationFacts): FirstReadStatus {
  if (facts.identityUncertain) {
    return {
      id: "identity",
      label: "Identity",
      status: "Uncertain",
      detail: "The user flagged the selected official parcel for further checking.",
      tone: "uncertain",
    };
  }
  if (facts.identityConfirmed) {
    return {
      id: "identity",
      label: "Identity",
      status: "Checked by user",
      detail: "Official identifiers are present and the user checked the selected parcel.",
      tone: "supported",
    };
  }
  return {
    id: "identity",
    label: "Identity",
    status: facts.hasOfficialParcelKey ? "Official identifiers found" : "Needs evidence",
    detail: facts.hasOfficialParcelKey
      ? "CSG identifiers are available, but the user has not confirmed the parcel yet."
      : "No official LPI or parcel key has been recorded.",
    tone: facts.hasOfficialParcelKey ? "progress" : "missing",
  };
}

function buildEvidenceStatuses(
  facts: InvestigationFacts,
  planning: ParcelPlanningAssessment,
): FirstReadStatus[] {
  const zoningMethod = planning.detection.method;
  const zoningDocumentSupported = zoningMethod === "document_supported";
  const zoningOfficialPolygonSupported = zoningMethod === "official_polygon";
  const zoningSupported = zoningDocumentSupported || zoningOfficialPolygonSupported;

  return [
    identityStatus(facts),
    {
      id: "address",
      label: "Address",
      status: facts.marketAddressSaved ? "Working address saved" : "Not confirmed",
      detail: facts.marketAddressSaved
        ? "User-supplied working address; it is separate from official parcel identity."
        : "Add a working address when it is known.",
      tone: facts.marketAddressSaved ? "progress" : "missing",
    },
    {
      id: "sg",
      label: "SG diagram",
      status: facts.sgDiagramSearchable
        ? "Document evidence ready"
        : facts.sgDiagramParentLineageOnly
          ? "Parent lineage only"
          : facts.sgDiagramCount > 0
            ? "Uploaded for reference"
            : "Not attached",
      detail: facts.sgDiagramSearchable
        ? "A subject-matched SG diagram has searchable evidence."
        : facts.sgDiagramCount > 0
          ? `${facts.sgDiagramCount} SG file${facts.sgDiagramCount === 1 ? "" : "s"} stored; subject evidence is not yet searchable.`
          : "No SG diagram is stored for this erf.",
      tone: facts.sgDiagramSearchable
        ? "supported"
        : facts.sgDiagramCount > 0
          ? "progress"
          : "missing",
    },
    {
      id: "ownership",
      label: "Ownership / deed",
      status: facts.titleDeedSearchable
        ? "Title deed evidence ready"
        : facts.paidReportSearchable
          ? "Report evidence available"
          : facts.paidReportCount > 0
            ? "Report uploaded for reference"
            : "Not established",
      detail: facts.titleDeedSearchable
        ? "A subject-matched title deed has searchable evidence."
        : facts.paidReportCount > 0
          ? "A paid report is stored, but ownership is not claimed without readable supporting evidence."
          : "No searchable ownership or deed evidence is recorded.",
      tone: facts.titleDeedSearchable
        ? "supported"
        : facts.paidReportCount > 0
          ? "progress"
          : "missing",
    },
    {
      id: "zoning",
      label: "Zoning / planning",
      status: zoningDocumentSupported
        ? "Document supported"
        : zoningOfficialPolygonSupported
          ? "Official polygon supported"
          : facts.zoningWorkingAssumption
            ? "Working assumption"
            : facts.zoningRegistryPublished
              ? "Published context only"
              : "Not established",
      detail: zoningDocumentSupported
        ? "A recorded document supports the zone."
        : zoningOfficialPolygonSupported
          ? "An official planning polygon supports the zone; confirm property-specific restrictions."
        : facts.zoningWorkingAssumption
          ? "The selected zone is an assumption until property-specific evidence is attached."
          : "Published municipal rules do not confirm rights for this erf.",
      tone: zoningSupported
        ? "supported"
        : facts.zoningWorkingAssumption
          ? "assumption"
          : facts.zoningRegistryPublished
            ? "progress"
            : "missing",
    },
    {
      id: "buildings",
      label: "Buildings / plans",
      status: facts.approvedPlansOnFile ? "Approved-plan evidence on file" : "Not established",
      detail: facts.approvedPlansOnFile
        ? "A plan with recorded municipal approval evidence is stored."
        : "No municipally approved plan evidence is recorded.",
      tone: facts.approvedPlansOnFile ? "supported" : "missing",
    },
    {
      id: "market",
      label: "Market",
      status: facts.marketEvidenceCount > 0 ? "Evidence saved" : "Not started",
      detail:
        facts.marketEvidenceCount > 0
          ? `${facts.marketEvidenceCount} saved market evidence item${facts.marketEvidenceCount === 1 ? "" : "s"}.`
          : "No subject listing or comparable evidence is saved.",
      tone: facts.marketEvidenceCount > 0 ? "progress" : "missing",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: facts.hasChosenScenario
        ? "Scenario chosen"
        : facts.scenarioCount > 0
          ? "Draft scenarios saved"
          : "Not started",
      detail: facts.hasChosenScenario
        ? "A saved scenario is selected for the Easy Erf Report."
        : facts.scenarioCount > 0
          ? "Choose a saved scenario when it is ready for the report."
          : "No strategy scenario has been saved.",
      tone: facts.hasChosenScenario ? "supported" : facts.scenarioCount > 0 ? "progress" : "missing",
    },
    {
      id: "site-potential",
      label: "Site Potential",
      status: facts.sitePotentialAccepted
        ? "Build envelope accepted"
        : facts.siteSkipped
          ? "Skipped by user"
          : "Not started",
      detail: facts.sitePotentialAccepted
        ? "An indicative build envelope is accepted from the confirmed site inputs. It is not an approved plan."
        : facts.siteSkipped
          ? "This optional step was deliberately skipped."
          : "No accepted Site Potential build envelope is recorded.",
      tone: facts.sitePotentialAccepted ? "progress" : facts.siteSkipped ? "supported" : "missing",
    },
  ];
}

function planningState(planning: ParcelPlanningAssessment): string {
  if (planning.detection.method === "document_supported") {
    return "Document supported / confirm restrictions";
  }
  if (planning.detection.method === "official_polygon") {
    return "Official polygon supported / confirm restrictions";
  }
  if (planning.detection.method === "manual_selection") return "Working assumption";
  return "Not established";
}

function buildPlanningRows(planning: ParcelPlanningAssessment): FirstReadPlanningRow[] {
  const rows: FirstReadPlanningRow[] = [];
  const state = planningState(planning);
  const zone = planning.detection.zoneName ?? planning.detection.zoneCode;

  if (zone) {
    rows.push({
      label: "Current zone",
      value: zone,
      state,
      source: planning.detection.suppliedBy || "Source not recorded",
    });
  }

  for (const rule of planning.publishedRules.slice(0, 5)) {
    const source = planning.sources.find((item) => item.id === rule.sourceId);
    rows.push({
      label: rule.label,
      value: formatRuleValue(rule),
      state:
        planning.detection.method === "manual_selection"
          ? "Working assumption from a published general rule"
          : "Published rule for the supported zone; not a confirmed property right",
      source: source?.title ?? rule.citation ?? "Published municipal planning source",
    });
  }

  if (planning.envelope.theoreticalGroundFloorM2 != null) {
    rows.push({
      label: "Derived ground-floor footprint",
      value: formatArea(planning.envelope.theoreticalGroundFloorM2),
      state:
        planning.detection.method === "manual_selection"
          ? "Working estimate from an unverified coverage assumption"
          : "Theoretical estimate; not an approved development right",
      source: planning.envelope.caveat,
    });
  }

  return rows;
}

// The pure model builder is exported so evidence/provenance behavior is testable without a browser.
// eslint-disable-next-line react-refresh/only-export-components
export function buildPropertyFirstReadModel({
  parcel,
  displayTitle,
  displaySubtitle,
  workingAddressLine,
  investigationInput,
  planning,
  assets,
  savedEvidence,
  chosenScenario,
}: Omit<PropertyFirstReadProps, "mapSlot" | "onInvestigate" | "onOpenExpertTools">): PropertyFirstReadModel {
  const facts = deriveInvestigationFacts(investigationInput);
  const area = resolveParcelArea(parcel.rawProperties);
  const coordinates = [
    formatCoordinate(parcel.coordinates?.lat),
    formatCoordinate(parcel.coordinates?.lng),
  ].filter(Boolean);
  const factsList: FirstReadFact[] = [];
  const addFact = (label: string, value: unknown, note?: string) => {
    if (!hasText(value)) return;
    factsList.push({ label, value: String(value), note });
  };

  addFact("Erf", parcel.erfNumber);
  addFact("Portion", parcel.portion);
  if (area) addFact(areaFactLabel(area), formatArea(area.areaM2), areaSourceLabel(area));
  addFact("LPI", parcel.lpi);
  addFact("Parcel key", parcel.parcelKey);
  addFact("Municipality", parcel.municipality);
  addFact("Province", parcel.province);
  addFact("Locality", parcel.suburbOrArea);
  addFact("Registration region", parcel.town, "CSG administrative / registration context");
  if (coordinates.length === 2) addFact("Coordinates", coordinates.join(", "), "Map context");
  addFact("Official source", parcel.sourceLabel);

  const activeListingCount = savedEvidence.filter(
    (item) => item.listingRole === "subject_active_listing",
  ).length;
  const comparableCount = savedEvidence.filter(
    (item) => item.listingRole === "comparable_evidence" && item.includeInSummary,
  ).length;
  const storedAssets = liveAssets(assets);

  return {
    title: displayTitle,
    addressLine: workingAddressLine?.trim() || null,
    placeLine:
      [parcel.suburbOrArea, parcel.municipality, parcel.province].filter(Boolean).join(" · ") ||
      displaySubtitle ||
      null,
    area,
    facts: factsList,
    evidenceStatuses: buildEvidenceStatuses(facts, planning),
    planningRows: buildPlanningRows(planning),
    planningSummary:
      planning.detection.method === "not_detected"
        ? "No property-specific planning control has been established. Add zoning evidence before relying on a build envelope."
        : planning.headlineWarning,
    marketSummary:
      savedEvidence.length === 0
        ? "No subject listing or comparable market evidence is saved yet."
        : `${activeListingCount} active subject listing${activeListingCount === 1 ? "" : "s"} and ${comparableCount} included comparable${comparableCount === 1 ? "" : "s"} are saved.`,
    documentSummary:
      storedAssets.length === 0
        ? "No source documents are stored yet."
        : `${storedAssets.length} file${storedAssets.length === 1 ? "" : "s"} stored in this erf file.`,
    strategySummary: chosenScenario
      ? `${chosenScenario.label} is the scenario chosen for the Easy Erf Report.`
      : facts.scenarioCount > 0
        ? `${facts.scenarioCount} draft scenario${facts.scenarioCount === 1 ? "" : "s"} saved; none chosen for the report.`
        : "No strategy scenario has been saved.",
    sitePotentialSummary: facts.sitePotentialAccepted
      ? "An indicative build envelope has been accepted from the confirmed site inputs. It is not an approved plan."
      : facts.siteSkipped
        ? "Site Potential was skipped for this investigation."
        : "No accepted Site Potential build envelope is recorded.",
    investigateLabel: investigationInput.workspaceState.investigation.startedAt
      ? "Continue investigation"
      : "Investigate this property",
  };
}

const STATUS_STYLES: Record<EvidenceTone, string> = {
  supported: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  progress: "bg-sky-50 text-sky-800 ring-sky-200",
  assumption: "bg-amber-50 text-amber-900 ring-amber-200",
  missing: "bg-slate-100 text-slate-700 ring-slate-200",
  uncertain: "bg-rose-50 text-rose-800 ring-rose-200",
};

const SUMMARY_CARDS = [
  { key: "marketSummary", title: "Market", icon: TrendingUp },
  { key: "documentSummary", title: "Documents", icon: FolderOpen },
  { key: "strategySummary", title: "Strategy", icon: ClipboardCheck },
  { key: "sitePotentialSummary", title: "Site Potential", icon: Sparkles },
] as const;

export function PropertyFirstRead(props: PropertyFirstReadProps) {
  const model = buildPropertyFirstReadModel(props);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      <section className="overflow-hidden rounded-lg bg-[#0D1B2A] text-white shadow-[0_26px_70px_-40px_rgba(13,27,42,0.8)]">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
          <div className="flex flex-col justify-between p-6 md:p-8 lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFB86B] ring-1 ring-white/10">
                <ShieldCheck className="h-4 w-4" /> Property first read
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">{model.title}</h1>
              {model.addressLine && (
                <p className="mt-3 text-lg font-medium text-white/88">{model.addressLine}</p>
              )}
              {model.placeLine && (
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-white/62">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A33]" />
                  {model.placeLine}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-400/12 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                  {props.parcel.sourceLabel}
                </span>
                {model.area && (
                  <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/78 ring-1 ring-white/10">
                    {formatArea(model.area.areaM2)} · {areaSourceLabel(model.area)}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-8">
              <p className="max-w-xl text-sm leading-6 text-white/68">
                Use Easy Erf&apos;s guided property investigation to gather records, confirm planning
                controls, analyse site potential and bring everything together in one report. This
                first read stays read-only until you choose to investigate.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={props.onInvestigate}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#FF7D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB86B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1B2A]"
                >
                  {model.investigateLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={props.onOpenExpertTools}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/16 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  Open expert tools
                </button>
              </div>
            </div>
          </div>
          <div className="min-h-[20rem] bg-[#13283D] p-4 md:p-5">{props.mapSlot}</div>
        </div>
      </section>

      <section aria-labelledby="property-facts-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">Canonical parcel</p>
            <h2 id="property-facts-heading" className="mt-1 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              Property facts
            </h2>
          </div>
          <Landmark className="h-7 w-7 text-[#0D1B2A]/28" />
        </div>
        <dl className="mt-4 grid overflow-hidden rounded-lg border border-[#0D1B2A]/10 bg-white shadow-[0_18px_50px_-42px_rgba(13,27,42,0.5)] sm:grid-cols-2 lg:grid-cols-3">
          {model.facts.map((fact) => (
            <div key={fact.label} className="min-w-0 border-b border-r border-[#0D1B2A]/8 p-4 last:border-b-0">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{fact.label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-[#0D1B2A]">{fact.value}</dd>
              {fact.note && <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/55">{fact.note}</p>}
            </div>
          ))}
        </dl>
        {model.area?.warning && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            {model.area.warning}
          </p>
        )}
      </section>

      {props.askSlot}

      <section aria-labelledby="evidence-status-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">Recorded state only</p>
            <h2 id="evidence-status-heading" className="mt-1 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              Evidence status
            </h2>
          </div>
          <FileSearch className="h-7 w-7 text-[#0D1B2A]/28" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {model.evidenceStatuses.map((item) => (
            <article key={item.id} className="rounded-lg border border-[#0D1B2A]/10 bg-white p-4 shadow-[0_16px_42px_-38px_rgba(13,27,42,0.45)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#0D1B2A]">{item.label}</h3>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", STATUS_STYLES[item.tone])}>
                  {item.status}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/62">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#0D1B2A]/10 bg-[#F4F8FC] p-5 md:p-6" aria-labelledby="planning-snapshot-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">Provenance visible</p>
            <h2 id="planning-snapshot-heading" className="mt-1 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              Planning snapshot
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/65">{model.planningSummary}</p>
          </div>
          <Ruler className="h-7 w-7 shrink-0 text-[#0D1B2A]/28" />
        </div>
        {model.planningRows.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-lg border border-[#0D1B2A]/10 bg-white">
            {model.planningRows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="grid gap-2 border-b border-[#0D1B2A]/8 p-4 last:border-b-0 md:grid-cols-[1fr_0.8fr_1.25fr]">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{row.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">{row.value}</div>
                </div>
                <div className="text-xs font-semibold leading-5 text-amber-800">{row.state}</div>
                <div className="text-xs leading-5 text-[#0D1B2A]/58">{row.source}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-[#0D1B2A]/18 bg-white/72 p-4 text-sm leading-6 text-[#0D1B2A]/62">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6A00]" />
            No planning controls are shown because no supported zone or working assumption is recorded.
          </div>
        )}
      </section>

      <section aria-labelledby="workspace-summary-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">At a glance</p>
            <h2 id="workspace-summary-heading" className="mt-1 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              Erf file summary
            </h2>
          </div>
          <Building2 className="h-7 w-7 text-[#0D1B2A]/28" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SUMMARY_CARDS.map(({ key, title, icon: Icon }) => (
            <article key={key} className="rounded-lg border border-[#0D1B2A]/10 bg-white p-4">
              <Icon className="h-6 w-6 text-[#FF6A00]" />
              <h3 className="mt-4 text-sm font-semibold text-[#0D1B2A]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{model[key]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-[#0D1B2A] p-6 text-white md:flex md:items-center md:justify-between md:gap-8 md:p-8">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            <CheckCircle2 className="h-4 w-4" /> Ready when you are
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Turn this first read into a guided investigation.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/66">
            Easy Erf will preserve the current investigation and continue from the next recorded task. Opening this overview alone does not mark work as started.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onInvestigate}
          className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#FF7D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB86B] md:mt-0"
        >
          {model.investigateLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}
