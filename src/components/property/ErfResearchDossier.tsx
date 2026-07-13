import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookmarkCheck, CheckCircle2, Copy, ExternalLink, Save, ShieldCheck } from "lucide-react";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "@/lib/research/publicSourceRegistry";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import {
  calculateAcquisition,
  calculateBond,
  calculateBrrrr,
  calculateBuyHold,
  calculateDevelopment,
  calculateFlip,
  calculateScenarioComparison,
} from "@/lib/research/calculators";
import {
  RESEARCH_SOURCE_QUALITY_LABELS,
  RESEARCH_SOURCE_USEFULNESS_LABELS,
  type ResearchSource,
} from "@/lib/research/sourceTypes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openExternalUrl } from "@/lib/external";
import { SavedLinksManager } from "./SavedLinksManager";
import { NotesTab } from "./tabs/NotesTab";
import { MarketEvidenceTab } from "./tabs/ListingsTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import { InvestorDueDiligenceProgress } from "./dossier/InvestorDueDiligenceProgress";
import { ReportBuilderOverview } from "./dossier/ReportBuilderOverview";
import {
  getChosenStrategyScenario,
  readErfWorkspaceState,
  readStrategyScenarios,
  saveStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import {
  readAllWorkspaceAttachments,
  type ErfWorkspaceAttachmentRecord,
  type PaidReportProvider,
} from "@/lib/workbench/erfWorkspaceFiles";
import type { InvestorWorkflowView } from "./dossier/investorWorkflow";
import { StrategyLab } from "./strategy/StrategyLab";

interface Props {
  parcel: NormalizedOfficialParcel;
  view?: DossierView;
  onSelectView?: (view: DossierView) => void;
}

export type DossierView =
  | "overview"
  | "research"
  | "site-potential"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report";

const DOSSIER_STATUSES = [
  { id: "not_started", label: "Not started" },
  { id: "researching", label: "Researching" },
  { id: "needs_paid_report", label: "Needs paid report" },
  { id: "watchlist", label: "Watchlist" },
  { id: "interested", label: "Interested" },
  { id: "passed", label: "Passed" },
] as const;

const STATUS_TONE: Record<ResearchSource["status"], string> = {
  available: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "open-search": "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  "manual-check": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "paid-report": "bg-purple-500/15 text-purple-800 dark:text-purple-300",
  unavailable: "bg-muted text-muted-foreground",
};

const TYPE_LABEL: Record<ResearchSource["sourceType"], string> = {
  official: "Official",
  municipal: "Municipal",
  "public-web": "Public web",
  "generated-search": "Generated search",
  "paid-provider": "Paid provider",
  "user-supplied": "User supplied",
  sponsored: "Sponsored",
  unavailable: "Unavailable",
};

const CONFIDENCE_LABEL: Record<NonNullable<ResearchSource["confidence"]>, string> = {
  confirmed_for_parcel: "Confirmed for parcel",
  official_relevant: "Official relevant",
  external_relevant: "External relevant",
  paid_report: "Paid report",
  future_integration: "Future integration",
};

const RESEARCH_SECTIONS = [
  {
    id: "official-identity",
    title: "Official parcel identity",
    match: (source: ResearchSource) =>
      source.dossierGroup === "official-parcel-identity" ||
      source.category === "csg-sg-documents" ||
      source.category === "official",
  },
  {
    id: "municipal-valuation",
    title: "Municipal valuation and rates",
    match: (source: ResearchSource) =>
      source.dossierGroup === "municipal-evidence" ||
      source.category === "municipal-valuation-rates",
  },
  {
    id: "zoning-planning",
    title: "Zoning and planning",
    match: (source: ResearchSource) =>
      source.dossierGroup === "planning-zoning" ||
      source.category === "zoning-land-use" ||
      source.category === "planning-notices",
  },
  {
    id: "listings-market",
    title: "Listings & Comps",
    match: (source: ResearchSource) =>
      source.category === "listings-market-evidence" ||
      source.dossierGroup === "market-intelligence",
  },
  {
    id: "environment-risk",
    title: "Environmental and coastal risk",
    match: (source: ResearchSource) =>
      source.dossierGroup === "environmental-coastal-risk" ||
      source.category === "environmental-heritage-risk" ||
      source.category === "environmental",
  },
  {
    id: "ownership-deeds",
    title: "Ownership and deeds",
    match: (source: ResearchSource) =>
      source.dossierGroup === "deeds-ownership" || source.category === "deeds-ownership",
  },
  {
    id: "paid-reports",
    title: "Paid reports",
    match: (source: ResearchSource) =>
      source.dossierGroup === "paid-reports" || source.category === "paid-reports",
  },
] as const;

const WORKFLOW_STEPS = [
  "Confirm parcel identity",
  "Check municipal valuation",
  "Review zoning and buildability",
  "Screen environmental and heritage risk",
  "Save notes or upload paid reports",
];

const STOEP_STEPS_PREVIEW = [
  "Property First Read",
  "Confirm Official Identity",
  "Check Buildability",
  "Check Market Evidence",
  "Choose Strategy",
  "Run the Numbers",
  "Generate Easy Erf Report",
  "Improve Confidence",
];

const STRATEGY_LAB_CARDS = [
  {
    title: "Land Flip",
    body: "Estimate buy, hold and resale assumptions without treating the result as a valuation.",
  },
  {
    title: "Build and Sell",
    body: "Model land plus build cost, selling price assumptions and rough margin.",
  },
  {
    title: "Hold vs Cash",
    body: "Compare a hold scenario against cash tied up, rates, finance and maintenance assumptions.",
  },
  {
    title: "Max Offer",
    body: "Work backwards from target margin and risk buffer to an indicative offer ceiling.",
  },
];

const REPORT_VAULT_ITEMS = [
  { title: "Lightstone", actions: ["Purchase Lightstone", "Upload PDF"] },
  { title: "WinDeed", actions: ["Purchase WinDeed", "Upload PDF"] },
  { title: "SG diagram / documents", actions: ["Upload PDF"] },
  { title: "CSG parcel evidence", actions: ["Upload PDF"] },
  { title: "Zoning certificate", actions: ["Upload PDF"] },
  { title: "Title deed or other evidence", actions: ["Upload PDF"] },
];

function dataCompleteness(parcel: NormalizedOfficialParcel): {
  score: number;
  known: number;
  total: number;
} {
  const checks = [
    parcel.erfNumber,
    parcel.portion,
    parcel.lpi,
    parcel.parcelKey,
    parcel.municipality,
    parcel.province,
    parcel.suburbOrArea,
    parcel.coordinates,
  ];
  const known = checks.filter(
    (value) => value !== null && value !== undefined && String(value).trim() !== "",
  ).length;
  return { known, total: checks.length, score: Math.round((known / checks.length) * 100) };
}

function identityConfidence(parcel: NormalizedOfficialParcel): string {
  if (parcel.lpi || parcel.parcelKey) return "High";
  if (parcel.erfNumber && parcel.portion && (parcel.municipality || parcel.province)) {
    return "Medium";
  }
  if (parcel.coordinates) return "Approximate";
  return "Needs verification";
}

function stoepScoreBand(
  parcel: NormalizedOfficialParcel,
  completenessScore: number,
): {
  label: string;
  detail: string;
} {
  if (parcel.lpi || parcel.parcelKey) {
    return {
      label: "Early signal: stronger identity",
      detail: `${completenessScore}% identity completeness. Estimated only - not a value, rating, or investment recommendation.`,
    };
  }
  if (parcel.erfNumber && (parcel.municipality || parcel.province)) {
    return {
      label: "Early signal: needs confirmation",
      detail: `${completenessScore}% identity completeness. Verify official identifiers before strategy decisions.`,
    };
  }
  return {
    label: "Early signal: limited evidence",
    detail: `${completenessScore}% identity completeness. More official evidence is needed before confidence improves.`,
  };
}

function stoepFirstRead(parcel: NormalizedOfficialParcel): string {
  const identity = [
    parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "an official public erf",
    parcel.portion != null && String(parcel.portion) !== "0" ? `Portion ${parcel.portion}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const location = [parcel.suburbOrArea, parcel.municipality, parcel.province]
    .filter(Boolean)
    .join(", ");
  const identifier = parcel.lpi
    ? "It has a CSG LPI, so the official identity can be checked against cadastral sources."
    : parcel.parcelKey
      ? "It has a parcel key, so the official identity can be checked against public parcel sources."
      : "It still needs stronger official identifiers such as an LPI, parcel key, or verified SG record.";

  return `This looks like ${identity}${location ? ` in ${location}` : ""}. ${identifier} Easy Erf can organize the first read, source links, notes, comps, assumptions, and report evidence, but ownership, valuation, zoning, deeds, rates and GIS precision are not confirmed unless verified evidence is added.`;
}

function knownFieldRows(parcel: NormalizedOfficialParcel): NormalizedOfficialParcel["knownFields"] {
  const generated = [
    parcel.erfNumber != null
      ? { label: "Erf number", value: String(parcel.erfNumber), source: parcel.sourceLabel }
      : null,
    parcel.portion != null
      ? { label: "Portion", value: String(parcel.portion), source: parcel.sourceLabel }
      : null,
    parcel.lpi ? { label: "LPI", value: parcel.lpi, source: parcel.sourceLabel } : null,
    parcel.parcelKey
      ? { label: "Parcel key", value: parcel.parcelKey, source: parcel.sourceLabel }
      : null,
    parcel.municipality
      ? { label: "Municipality", value: parcel.municipality, source: parcel.sourceLabel }
      : null,
    parcel.province
      ? { label: "Province", value: parcel.province, source: parcel.sourceLabel }
      : null,
    parcel.suburbOrArea
      ? { label: "Suburb / area", value: parcel.suburbOrArea, source: parcel.sourceLabel }
      : null,
    parcel.coordinates
      ? {
          label: "Coordinates",
          value: `${parcel.coordinates.lat}, ${parcel.coordinates.lng}`,
          source: parcel.sourceLabel,
        }
      : null,
  ].filter((row): row is NormalizedOfficialParcel["knownFields"][number] => row !== null);
  const existingKeys = new Set(parcel.knownFields.map((field) => field.label.toLowerCase()));
  return [
    ...parcel.knownFields,
    ...generated.filter((field) => !existingKeys.has(field.label.toLowerCase())),
  ];
}

function extractDefaultPrice(parcel: NormalizedOfficialParcel): number {
  const priceField = parcel.knownFields.find((field) =>
    /asking|price|value|valuation/i.test(`${field.label} ${field.source}`),
  );
  if (!priceField) return 0;
  const value = Number(String(priceField.value).replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

export function ErfResearchDossier({ parcel, view = "overview", onSelectView }: Props) {
  const [completedSourceIds, setCompletedSourceIds] = useState<Set<string>>(() => new Set());
  const completeness = dataCompleteness(parcel);
  const sources = buildPublicResearchSources(parcel).filter(
    (source) => source.id !== "sg-document-list",
  );
  const sgDoc = useMemo(
    () =>
      buildSgDocumentUrl({
        lpi: parcel.lpi,
        parcelKey: parcel.parcelKey,
        erfNumber: parcel.erfNumber,
        portion: parcel.portion,
        province: parcel.province,
        majorRegion: parcel.municipality,
        minorRegion: parcel.suburbOrArea,
      }),
    [parcel],
  );
  const summary = [
    parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "Official parcel",
    parcel.suburbOrArea,
    parcel.municipality,
    parcel.province,
  ]
    .filter(Boolean)
    .join(", ");
  const primarySources = sources.filter((source) => source.userUsefulness === "primary");
  const secondarySources = sources.filter((source) => source.userUsefulness === "secondary");
  const moreSources = sources.filter((source) => source.userUsefulness === "hidden_by_default");
  const visibleSources = [...primarySources, ...secondarySources];
  const knownRows = knownFieldRows(parcel);
  const scoreBand = stoepScoreBand(parcel, completeness.score);
  const selectWorkflowView = (target: InvestorWorkflowView) => onSelectView?.(target);
  useEffect(() => {
    setCompletedSourceIds(new Set());
  }, [parcel.id]);
  const markSourceComplete = (source: ResearchSource) => {
    setCompletedSourceIds((current) => new Set(current).add(source.id));
  };
  const curatedSections = RESEARCH_SECTIONS.map((section) => ({
    ...section,
    sources: visibleSources.filter(section.match),
  })).filter(
    (section) =>
      section.sources.length > 0 &&
      section.id !== "listings-market" &&
      section.id !== "paid-reports",
  );
  const nextSteps = [
    [
      "Open Research tab",
      "Review official, municipal, environmental, and generated source cards.",
      "research",
    ],
    [
      "Build Listings & Comps",
      "Find, classify and save verified market evidence manually.",
      "listings",
    ],
    [
      "Check reports",
      "Mark paid report interest for ownership, valuation, deeds, or comparables.",
      "reports",
    ],
    ["Save evidence", "Capture notes and source links against this normalized parcel id.", "notes"],
    [
      "Run estimates",
      "Use your own assumptions for transfer, holding, flip, and offer scenarios.",
      "calculators",
    ],
  ] as const;

  if (view === "research") {
    return (
      <div className="space-y-4">
        {curatedSections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-border bg-card p-4">
            <SectionTitle>{section.title}</SectionTitle>
            <div className="grid gap-2">
              {section.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  featured={source.userUsefulness === "primary"}
                  checked={completedSourceIds.has(source.id)}
                  onAction={markSourceComplete}
                />
              ))}
            </div>
          </section>
        ))}

        {moreSources.length > 0 && (
          <details className="rounded-2xl border border-dashed border-border bg-card p-4">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              More sources ({moreSources.length})
            </summary>
            <div className="mt-3 grid gap-2">
              {moreSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  checked={completedSourceIds.has(source.id)}
                  onAction={markSourceComplete}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (view === "listings") {
    return <MarketEvidenceTab parcel={parcel} />;
  }

  if (view === "reports") {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <div>
          <ReportsTab parcelId={parcel.id} summary={summary} sgDoc={sgDoc} />
        </div>
      </section>
    );
  }

  if (view === "notes") {
    return (
      <div className="space-y-4">
        <DossierStatusControl parcel={parcel} />
        <section className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle>User Workspace</SectionTitle>
          <div className="mt-3 space-y-5">
            <SavedLinksManager parcelId={parcel.id} />
            <NotesTab parcelId={parcel.id} showSourceBadge={false} />
          </div>
        </section>
      </div>
    );
  }

  if (view === "calculators") {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Strategy</SectionTitle>
        <StrategyLab
          parcelId={parcel.id}
          defaultPrice={extractDefaultPrice(parcel)}
          onOpenReport={() => onSelectView?.("stoep-report")}
        />
      </section>
    );
  }

  if (view === "stoep-report") {
    return <StoepAiReportView parcel={parcel} />;
  }

  return (
    <div className="space-y-6">
      <ReportBuilderOverview parcel={parcel} onSelectView={selectWorkflowView} />
      <ManualResearchFields parcel={parcel} />
    </div>
  );
}

function InfoTile({
  label,
  value,
  sub,
  mono = false,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#eadfd1] bg-white/80 px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8a7562]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-[15px] font-semibold text-[#263735]",
          mono && "font-mono text-[12px]",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-[#7f6b59]">{sub}</div>}
    </div>
  );
}

function FieldList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: NormalizedOfficialParcel["knownFields"];
  empty: string;
}) {
  return (
    <section className="rounded-[2rem] border border-[#eadfd1] bg-[#fffdf9] p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-[#263735]">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#6b5b4d]">{empty}</p>
      ) : (
        <dl className="mt-3 divide-y divide-[#eadfd1] text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-[#7f6b59]">{row.label}</dt>
              <dd
                className="max-w-[60%] truncate text-right font-semibold text-[#263735]"
                title={`${row.value} (${row.source})`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function MissingList({ fields }: { fields: string[] }) {
  return (
    <section className="rounded-[2rem] border border-[#eadfd1] bg-[#fffdf9] p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-[#263735]">Missing or not attached</h4>
      <ul className="mt-3 grid gap-2 text-sm text-[#6b5b4d]">
        {fields.map((field) => (
          <li key={field} className="rounded-2xl bg-[#fff8ed] px-3 py-2">
            {field}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#263735]">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function SourceCard({
  source,
  featured = false,
  checked = false,
  onAction,
}: {
  source: ResearchSource;
  featured?: boolean;
  checked?: boolean;
  onAction?: (source: ResearchSource) => void;
}) {
  const disabled =
    !source.url || source.status === "unavailable" || source.status === "paid-report";
  return (
    <article
      className={cn(
        "rounded-xl border bg-background p-3",
        checked
          ? "border-emerald-300 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-200"
          : featured
            ? "border-primary/40 shadow-sm ring-1 ring-primary/10"
            : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{source.name}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {source.reveals}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            STATUS_TONE[source.status],
          )}
        >
          {source.status.replace("-", " ")}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {TYPE_LABEL[source.sourceType]}
        </span>
        {source.sourceQuality && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {RESEARCH_SOURCE_QUALITY_LABELS[source.sourceQuality]}
          </span>
        )}
        {source.userUsefulness && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              source.userUsefulness === "primary"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {RESEARCH_SOURCE_USEFULNESS_LABELS[source.userUsefulness]}
          </span>
        )}
        {source.confidence && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CONFIDENCE_LABEL[source.confidence]}
          </span>
        )}
        {source.parcelSpecific && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Parcel-specific evidence
          </span>
        )}
        {checked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Checked
          </span>
        )}
        {source.missingFields.length > 0 && (
          <span className="text-[10.5px] text-muted-foreground">
            Missing: {source.missingFields.join(", ")}
          </span>
        )}
      </div>
      {source.fieldsFound && source.fieldsFound.length > 0 && (
        <ul className="mt-2 grid gap-1 text-[10.5px] text-muted-foreground">
          {source.fieldsFound.map((field) => (
            <li key={field} className="rounded-lg bg-muted/40 px-2 py-1">
              {field}
            </li>
          ))}
        </ul>
      )}
      {source.actionInstruction && (
        <p className="mt-2 rounded-lg bg-muted/35 px-2.5 py-2 text-[10.5px] leading-relaxed text-foreground">
          {source.actionInstruction}
        </p>
      )}
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        {source.complianceNote}
      </p>
      {disabled ? (
        <button
          type="button"
          disabled
          className="mt-3 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground opacity-70"
        >
          {source.actionLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            onAction?.(source);
            openExternalUrl(source.url!, event);
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
        >
          {checked ? "Checked" : source.actionLabel} <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </article>
  );
}

type ManualResearchForm = {
  askingPrice: string;
  municipalValue: string;
  zoningNote: string;
  ratesNote: string;
  agentName: string;
  listingUrl: string;
  userConfidenceNote: string;
};

const EMPTY_MANUAL_RESEARCH: ManualResearchForm = {
  askingPrice: "",
  municipalValue: "",
  zoningNote: "",
  ratesNote: "",
  agentName: "",
  listingUrl: "",
  userConfidenceNote: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFromRecord(record: Record<string, unknown>, key: keyof ManualResearchForm): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function ManualResearchFields({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const { user } = useAuth();
  const [form, setForm] = useState<ManualResearchForm>(EMPTY_MANUAL_RESEARCH);
  const [existingUserData, setExistingUserData] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);

    if (!user) {
      setExistingUserData({});
      setForm(EMPTY_MANUAL_RESEARCH);
      setLoaded(true);
      return () => {
        alive = false;
      };
    }

    supabase
      .from("saved_properties")
      .select("user_data")
      .eq("user_id", user.id)
      .eq("parcel_id", parcel.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error(error.message);
        const userData = isRecord(data?.user_data) ? data.user_data : {};
        const manualResearch = isRecord(userData.manualResearch) ? userData.manualResearch : {};
        setExistingUserData(userData);
        setForm({
          askingPrice: stringFromRecord(manualResearch, "askingPrice"),
          municipalValue: stringFromRecord(manualResearch, "municipalValue"),
          zoningNote: stringFromRecord(manualResearch, "zoningNote"),
          ratesNote: stringFromRecord(manualResearch, "ratesNote"),
          agentName: stringFromRecord(manualResearch, "agentName"),
          listingUrl: stringFromRecord(manualResearch, "listingUrl"),
          userConfidenceNote: stringFromRecord(manualResearch, "userConfidenceNote"),
        });
        setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [parcel.id, user]);

  async function saveManualResearch() {
    if (!user) {
      toast.message("Sign in to save manual research fields");
      return;
    }

    setSaving(true);
    const userData = {
      ...existingUserData,
      normalizedParcelId: parcel.id,
      displayTitle:
        existingUserData.displayTitle ??
        (parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "Official parcel dossier"),
      erfNumber: parcel.erfNumber ?? existingUserData.erfNumber ?? null,
      portion: parcel.portion ?? existingUserData.portion ?? null,
      lpi: parcel.lpi ?? existingUserData.lpi ?? null,
      parcelKey: parcel.parcelKey ?? existingUserData.parcelKey ?? null,
      municipality: parcel.municipality ?? existingUserData.municipality ?? null,
      province: parcel.province ?? existingUserData.province ?? null,
      latitude: parcel.coordinates?.lat ?? existingUserData.latitude ?? null,
      longitude: parcel.coordinates?.lng ?? existingUserData.longitude ?? null,
      lat: parcel.coordinates?.lat ?? existingUserData.lat ?? null,
      lng: parcel.coordinates?.lng ?? existingUserData.lng ?? null,
      manualResearch: form,
      manualResearchUpdatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("saved_properties").upsert(
      {
        user_id: user.id,
        parcel_id: parcel.id,
        user_data: userData as unknown as Record<string, unknown> as never,
      },
      { onConflict: "user_id,parcel_id" },
    );

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExistingUserData(userData);
    toast.success("Manual research fields saved");
  }

  const fields = [
    ["Asking price", "askingPrice", "e.g. R 2,400,000"],
    ["Municipal value", "municipalValue", "e.g. R 1,700,000"],
    ["Zoning note", "zoningNote", "User-entered zoning note"],
    ["Rates note", "ratesNote", "User-entered rates note"],
    ["Agent name", "agentName", "Agent or agency contact"],
    ["Listing URL", "listingUrl", "Verified listing URL"],
    ["Confidence note", "userConfidenceNote", "Why you trust or question this evidence"],
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <SectionTitle>Manual Research Fields</SectionTitle>
      <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
        Private user-entered fields saved against this normalized parcel id. These are not official
        parcel data and do not attach verified ownership, valuation, transfer, rates or zoning data.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, key, placeholder]) => (
          <label key={key} className={key === "userConfidenceNote" ? "sm:col-span-2" : ""}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <input
              value={form[key]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              placeholder={placeholder}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={!loaded || saving}
        onClick={saveManualResearch}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-60"
      >
        <Save className="h-3 w-3" /> {saving ? "Saving" : "Save manual fields"}
      </button>
    </section>
  );
}

type DossierStatusId = (typeof DOSSIER_STATUSES)[number]["id"];

function DossierStatusControl({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DossierStatusId>("not_started");
  const [tagsText, setTagsText] = useState("");
  const [existingUserData, setExistingUserData] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!user) {
      setLoaded(true);
      setExistingUserData({});
      return () => {
        alive = false;
      };
    }

    setLoaded(false);
    supabase
      .from("saved_properties")
      .select("research_status,tags,user_data")
      .eq("user_id", user.id)
      .eq("parcel_id", parcel.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast.error(error.message);
        }
        setExistingUserData(isRecord(data?.user_data) ? data.user_data : {});
        const savedStatus = data?.research_status;
        if (savedStatus && DOSSIER_STATUSES.some((item) => item.id === savedStatus)) {
          setStatus(savedStatus as DossierStatusId);
        } else {
          setStatus("not_started");
        }
        setTagsText((data?.tags ?? []).join(", "));
        setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [parcel.id, user]);

  async function save() {
    if (!user) {
      toast.message("Sign in to save this dossier status");
      return;
    }

    setSaving(true);
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const userData = {
      ...existingUserData,
      normalizedParcelId: parcel.id,
      provider: parcel.sourceLabel,
      sourceLayer: parcel.layer ?? null,
      displayTitle: parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "Official parcel dossier",
      erfNumber: parcel.erfNumber ?? null,
      portion: parcel.portion ?? null,
      lpi: parcel.lpi ?? null,
      parcelKey: parcel.parcelKey ?? null,
      municipality: parcel.municipality ?? null,
      town: parcel.town ?? null,
      province: parcel.province ?? null,
      longitude: parcel.coordinates?.lng ?? null,
      latitude: parcel.coordinates?.lat ?? null,
      lng: parcel.coordinates?.lng ?? null,
      lat: parcel.coordinates?.lat ?? null,
      source: parcel.source,
      fetchedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("saved_properties").upsert(
      {
        user_id: user.id,
        parcel_id: parcel.id,
        research_status: status,
        status,
        tags,
        user_data: userData as unknown as Record<string, unknown> as never,
      },
      { onConflict: "user_id,parcel_id" },
    );

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExistingUserData(userData);
    toast.success("Dossier status saved");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionTitle icon={<BookmarkCheck className="h-3.5 w-3.5" />}>
            Dossier Status
          </SectionTitle>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Save a private research state against this official parcel id. This does not attach
            ownership, valuation, transfer or rates data.
          </p>
        </div>
        {!user && (
          <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            Sign in to save status
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="flex flex-wrap gap-2">
          {DOSSIER_STATUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!loaded}
              onClick={() => setStatus(item.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60",
                status === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="Tags, comma separated"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px]"
          />
          <button
            type="button"
            disabled={saving || !loaded}
            onClick={save}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-3 w-3" /> {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRand(value: number): string {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function paidReportProviderLabel(provider: PaidReportProvider) {
  return provider === "lightstone" ? "Lightstone" : "WinDeed";
}

function workspaceAttachmentCategory(file: ErfWorkspaceAttachmentRecord) {
  if (file.kind === "sg-diagram") return "SG diagram";
  if (file.provider) return `${paidReportProviderLabel(file.provider)} PDF`;
  return file.sourceLabel || "Workspace file";
}

function formatAttachmentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAttachmentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function openWorkspaceAttachment(file: ErfWorkspaceAttachmentRecord) {
  const url = URL.createObjectURL(file.file);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function StoepAiReportView({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const { evidence } = useSavedMarketEvidence(parcel.id);
  const [uploadedFiles, setUploadedFiles] = useState<ErfWorkspaceAttachmentRecord[]>([]);
  const workspaceState = readErfWorkspaceState(parcel.id);
  const scenarios = readStrategyScenarios(parcel.id);
  const chosenScenario = getChosenStrategyScenario(parcel.id);
  const identityLabel = parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "Selected erf";
  const reviewedSources = workspaceState.reviewedSourceIds.length;
  const sgFiles = workspaceState.sgDiagramAttachmentCount;
  const missing = [
    reviewedSources || sgFiles ? null : "reviewed official sources or SG diagram evidence",
    evidence.length ? null : "saved market evidence",
    chosenScenario ? null : "saved strategy scenario",
  ].filter(Boolean);

  useEffect(() => {
    let alive = true;
    readAllWorkspaceAttachments(parcel.id)
      .then((records) => {
        if (alive) setUploadedFiles(records);
      })
      .catch(() => {
        if (alive) setUploadedFiles([]);
      });
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string }>).detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      readAllWorkspaceAttachments(parcel.id)
        .then((records) => {
          if (alive) setUploadedFiles(records);
        })
        .catch(() => {
          if (alive) setUploadedFiles([]);
        });
    };
    window.addEventListener("erfstoep:workspace-files-updated", refresh);
    return () => {
      alive = false;
      window.removeEventListener("erfstoep:workspace-files-updated", refresh);
    };
  }, [parcel.id]);

  return (
    <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
      <div className="inline-flex rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
        Easy Erf Report
      </div>
      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
        Report shell for {identityLabel}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
        This page assembles the report from saved identity checks, reviewed sources, market evidence
        and saved strategy assumptions. Missing data stays labelled; Easy Erf does not fabricate
        ownership, valuation, zoning, sales history or paid-provider data.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Identity",
            workspaceState.identityStatus === "none"
              ? "Needs check"
              : workspaceState.identityStatus,
          ],
          ["Sources", `${reviewedSources} reviewed / ${sgFiles} SG files`],
          ["Market", `${evidence.length} saved evidence item${evidence.length === 1 ? "" : "s"}`],
          [
            "Strategy",
            chosenScenario
              ? `Chosen: ${chosenScenario.label}`
              : `${scenarios.length} saved scenario${scenarios.length === 1 ? "" : "s"}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              {label}
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0D1B2A]">{value}</p>
          </div>
        ))}
      </div>

      {chosenScenario && (
        <section className="mt-5 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Chosen strategy scenario
          </div>
          <h4 className="mt-2 text-base font-semibold text-[#0D1B2A]">{chosenScenario.label}</h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
            Easy Erf Report uses the chosen scenario first. If no chosen scenario exists, it falls
            back to the newest saved scenario.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {chosenScenario.summary.slice(0, 4).map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#D9E6F2] bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {item.label}
                </div>
                <p className="mt-2 text-sm font-semibold text-[#0D1B2A]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        id="uploaded-files-and-source-documents"
        className="mt-5 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4 scroll-mt-24"
      >
        <h4 className="text-base font-semibold text-[#0D1B2A]">
          Uploaded files and source documents
        </h4>
        <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
          Stored for reference. Easy Erf AI extraction and PDF analysis are not enabled yet.
        </p>
        {uploadedFiles.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {uploadedFiles.map((file) => (
              <article key={file.id} className="rounded-2xl border border-[#D9E6F2] bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {workspaceAttachmentCategory(file)}
                </div>
                <p className="mt-2 break-words text-sm font-semibold text-[#0D1B2A]">
                  {file.fileName}
                </p>
                <p className="mt-1 text-xs text-[#0D1B2A]/60">
                  {formatAttachmentSize(file.fileSize)} - uploaded{" "}
                  {formatAttachmentDate(file.uploadedAt)}
                </p>
                <p className="mt-1 text-xs text-[#0D1B2A]/60">
                  Status:{" "}
                  {file.status === "uploaded_reference_only"
                    ? "uploaded for reference only"
                    : "stored for reference"}
                  .
                </p>
                <button
                  type="button"
                  onClick={() => openWorkspaceAttachment(file)}
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
                >
                  Open file
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-white px-4 py-3 text-sm text-[#0D1B2A]/60">
            No uploaded SG diagrams, Lightstone PDFs, or WinDeed PDFs are stored for this erf yet.
          </p>
        )}
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#fbf8f1] p-4">
          <h4 className="text-base font-semibold text-[#0D1B2A]">Draft report outline</h4>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-[#0D1B2A]/70">
            <li>1. Official parcel identity and known public fields</li>
            <li>2. Reviewed sources and SG diagram evidence</li>
            <li>3. Market evidence, comps and address notes</li>
            <li>
              4. Strategy assumptions and scenario summary
              {chosenScenario ? ` - chosen scenario: ${chosenScenario.label}` : ""}
            </li>
            <li>5. Risks, missing evidence and recommended next actions</li>
          </ol>
        </article>
        <article className="rounded-[1.5rem] border border-[#FF6A00]/20 bg-[#fff8ec] p-4">
          <h4 className="text-base font-semibold text-[#0D1B2A]">Missing before final report</h4>
          {missing.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#0D1B2A]/70">
              {missing.map((item) => (
                <li key={item}>Needs {item}.</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#0D1B2A]/70">
              Enough saved workflow state exists for a first report draft. Review every source
              before sharing.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

type CalculatorTab =
  | "acquisition"
  | "rental"
  | "bond"
  | "flip"
  | "brrrr"
  | "development"
  | "scenarios";

const CALCULATOR_TABS: { id: CalculatorTab; label: string }[] = [
  { id: "acquisition", label: "Acquisition" },
  { id: "rental", label: "Buy & hold" },
  { id: "bond", label: "Bond" },
  { id: "flip", label: "Flip" },
  { id: "brrrr", label: "BRRRR" },
  { id: "development", label: "Development" },
  { id: "scenarios", label: "Scenarios" },
];

function calculatorDefaults(defaultPrice: number): Record<string, string> {
  const price = defaultPrice > 0 ? String(defaultPrice) : "";
  return {
    purchasePrice: price,
    depositPercent: "10",
    transferDuty: "",
    conveyancerFees: "",
    bondRegistrationFees: "",
    initiationFees: "6037",
    inspectionAllowance: "",
    renovationBudget: "",
    furnitureBudget: "",
    cashBuffer: "",
    closingCosts: "",
    downPayment: "",
    monthlyRent: "",
    otherIncome: "",
    vacancyPercent: "5",
    monthlyRates: "",
    monthlyLevies: "",
    insurance: "",
    utilitiesPaidByOwner: "",
    capitalExpenditureReserve: "",
    maintenancePercent: "5",
    managementPercent: "8",
    otherMonthlyCosts: "",
    monthlyBondPayment: "",
    interestRate: "11.75",
    termYears: "20",
    extraMonthlyPayment: "",
    appreciationPercent: "5",
    rentGrowthPercent: "5",
    expenseGrowthPercent: "6",
    holdingPeriodYears: "5",
    sellingCostPercent: "6",
    acquisitionCosts: "",
    contingencyPercent: "10",
    holdingMonths: "6",
    monthlyHoldingCost: "",
    expectedResalePrice: "",
    agentCommissionPercent: "5",
    sellingCosts: "",
    targetProfit: "",
    targetRoiPercent: "20",
    delayMonths: "3",
    resaleSensitivityPercent: "5",
    allInCost: "",
    afterRepairValue: "",
    refinanceLtv: "75",
    refinanceFees: "",
    monthlyExpenses: "",
    monthlyDebtService: "",
    targetDscr: "1.2",
    landPrice: price,
    buildableSqm: "",
    buildCostPerSqm: "",
    professionalFeesPercent: "12",
    municipalServiceCosts: "",
    financeHoldingCosts: "",
    expectedGrossValue: "",
    lowResalePrice: "",
    baseResalePrice: "",
    highResalePrice: "",
    lowRent: "",
    baseRent: "",
    highRent: "",
    lowCost: "",
    baseCost: "",
    highCost: "",
    lowInterestRate: "12.5",
    baseInterestRate: "11.75",
    highInterestRate: "11",
  };
}

function OfficialCalculatorPanel({
  parcelId,
  defaultPrice,
  onOpenReport,
}: {
  parcelId: string;
  defaultPrice: number;
  onOpenReport?: () => void;
}) {
  const [active, setActive] = useState<CalculatorTab>("acquisition");
  const [values, setValues] = useState(() => calculatorDefaults(defaultPrice));
  const [savedScenarios, setSavedScenarios] = useState(() => readStrategyScenarios(parcelId));
  useEffect(() => {
    setSavedScenarios(readStrategyScenarios(parcelId));
    setValues(calculatorDefaults(defaultPrice));
  }, [defaultPrice, parcelId]);
  const n = (key: string) => toNumber(values[key] ?? "");
  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const reset = () => setValues(calculatorDefaults(defaultPrice));

  const loanAmount = Math.max(0, n("purchasePrice") * (1 - n("depositPercent") / 100));
  const monthlyBond =
    n("monthlyBondPayment") ||
    calculateBond({
      loanAmount,
      interestRate: n("interestRate"),
      termYears: n("termYears"),
      extraMonthlyPayment: n("extraMonthlyPayment"),
      monthlyNoi: 0,
      monthlyRent: n("monthlyRent"),
    }).monthlyBondPayment;
  const acquisition = calculateAcquisition({
    purchasePrice: n("purchasePrice"),
    depositPercent: n("depositPercent"),
    transferDuty: n("transferDuty"),
    conveyancerFees: n("conveyancerFees"),
    bondRegistrationFees: n("bondRegistrationFees"),
    initiationFees: n("initiationFees"),
    inspectionAllowance: n("inspectionAllowance"),
    renovationBudget: n("renovationBudget"),
    furnitureBudget: n("furnitureBudget"),
    cashBuffer: n("cashBuffer"),
  });
  const rental = calculateBuyHold({
    purchasePrice: n("purchasePrice"),
    totalCashInvested: acquisition.totalCashRequired,
    monthlyRent: n("monthlyRent"),
    otherIncome: n("otherIncome"),
    vacancyPercent: n("vacancyPercent"),
    monthlyRates: n("monthlyRates"),
    monthlyLevies: n("monthlyLevies"),
    insurance: n("insurance"),
    utilitiesPaidByOwner: n("utilitiesPaidByOwner"),
    capitalExpenditureReserve: n("capitalExpenditureReserve"),
    maintenancePercent: n("maintenancePercent"),
    managementPercent: n("managementPercent"),
    otherMonthlyCosts: n("otherMonthlyCosts"),
    monthlyBondPayment: monthlyBond,
    appreciationPercent: n("appreciationPercent"),
    rentGrowthPercent: n("rentGrowthPercent"),
    expenseGrowthPercent: n("expenseGrowthPercent"),
    holdingPeriodYears: n("holdingPeriodYears"),
    sellingCostPercent: n("sellingCostPercent"),
    loanAmount,
  });
  const bond = calculateBond({
    loanAmount,
    interestRate: n("interestRate"),
    termYears: n("termYears"),
    extraMonthlyPayment: n("extraMonthlyPayment"),
    monthlyNoi: rental.monthlyNoi,
    monthlyRent: n("monthlyRent"),
  });
  const flip = calculateFlip({
    purchasePrice: n("purchasePrice"),
    acquisitionCosts: n("acquisitionCosts"),
    renovationBudget: n("renovationBudget"),
    contingencyPercent: n("contingencyPercent"),
    holdingMonths: n("holdingMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    expectedResalePrice: n("expectedResalePrice"),
    agentCommissionPercent: n("agentCommissionPercent"),
    sellingCosts: n("sellingCosts"),
    targetProfit: n("targetProfit"),
    targetRoiPercent: n("targetRoiPercent"),
    delayMonths: n("delayMonths"),
    resaleSensitivityPercent: n("resaleSensitivityPercent"),
  });
  const brrrr = calculateBrrrr({
    purchasePrice: n("purchasePrice"),
    renovationBudget: n("renovationBudget"),
    allInCost: n("allInCost"),
    afterRepairValue: n("afterRepairValue"),
    refinanceLtv: n("refinanceLtv"),
    refinanceFees: n("refinanceFees"),
    monthlyRent: n("monthlyRent"),
    monthlyExpenses: n("monthlyExpenses"),
    monthlyDebtService: n("monthlyDebtService") || monthlyBond,
    targetDscr: n("targetDscr"),
  });
  const development = calculateDevelopment({
    landPrice: n("landPrice"),
    buildableSqm: n("buildableSqm"),
    buildCostPerSqm: n("buildCostPerSqm"),
    professionalFeesPercent: n("professionalFeesPercent"),
    contingencyPercent: n("contingencyPercent"),
    municipalServiceCosts: n("municipalServiceCosts"),
    financeHoldingCosts: n("financeHoldingCosts"),
    expectedGrossValue: n("expectedGrossValue"),
  });
  const scenarios = calculateScenarioComparison([
    {
      label: "Low",
      resalePrice: n("lowResalePrice"),
      rent: n("lowRent"),
      renovationOrBuildCost: n("highCost"),
      interestRate: n("lowInterestRate"),
      purchasePrice: n("purchasePrice"),
      monthlyExpenses: n("monthlyExpenses"),
      loanAmount,
      termYears: n("termYears"),
      cashInvested: acquisition.totalCashRequired,
    },
    {
      label: "Base",
      resalePrice: n("baseResalePrice"),
      rent: n("baseRent"),
      renovationOrBuildCost: n("baseCost"),
      interestRate: n("baseInterestRate"),
      purchasePrice: n("purchasePrice"),
      monthlyExpenses: n("monthlyExpenses"),
      loanAmount,
      termYears: n("termYears"),
      cashInvested: acquisition.totalCashRequired,
    },
    {
      label: "High",
      resalePrice: n("highResalePrice"),
      rent: n("highRent"),
      renovationOrBuildCost: n("lowCost"),
      interestRate: n("highInterestRate"),
      purchasePrice: n("purchasePrice"),
      monthlyExpenses: n("monthlyExpenses"),
      loanAmount,
      termYears: n("termYears"),
      cashInvested: acquisition.totalCashRequired,
    },
  ]);
  const dealSummary = [
    ["Deal type", active === "rental" ? "Rental hold" : active.toUpperCase()],
    ["Cash required", formatRand(acquisition.totalCashRequired)],
    ["Monthly cash flow", formatRand(rental.cashFlowAfterDebt)],
    ["ROI", formatPercent(active === "flip" ? flip.roi : rental.cashOnCashReturn)],
    ["DSCR", rental.dscr.toFixed(2)],
    [
      "Profit estimate",
      formatRand(active === "flip" ? flip.profit : rental.totalProfitOverHolding),
    ],
    [
      "Biggest risk flag",
      rental.dscr > 0 && rental.dscr < 1.2
        ? "Debt service coverage is tight"
        : rental.cashFlowAfterDebt < 0
          ? "Negative monthly cash flow"
          : "Verify rent, rates and vacancy assumptions",
    ],
    [
      "Next action",
      "Save assumptions in Notes or order a paid report when provider data is connected.",
    ],
  ] as [string, string][];

  function saveScenario() {
    const { scenarios } = saveStrategyScenario(parcelId, {
      label: `${activeLabel(active)} scenario`,
      strategy: active,
      inputs: values,
      summary: dealSummary.map(([label, value]) => ({ label, value })),
    });
    setSavedScenarios(scenarios);
    toast.success("Strategy scenario saved for this erf.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Strategy Lab
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
              Choose what this erf could become
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
              Strategy Lab helps you test what this erf could be: acquisition, buy-and-hold, bond,
              flip, BRRRR, development, or custom scenarios. Enter your assumptions, save a
              scenario, then send the saved strategy into the Easy Erf Report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#fbf8f1]"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={saveScenario}
              className="rounded-full bg-[#FF6A00] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#ff7d1f]"
            >
              <Save className="mr-1 inline h-3.5 w-3.5" />
              Save scenario
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {CALCULATOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[12px] font-semibold",
                active === tab.id
                  ? "border-[#0D1B2A] bg-[#0D1B2A] text-white"
                  : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/58">
          Estimates only. Easy Erf is not attaching official valuation, rates, transfer, deeds or
          paid provider data here.
        </p>
      </section>
      <section className="rounded-2xl border border-amber-200 bg-[#fff8ed] p-4">
        <div className="text-sm font-semibold text-foreground">Deal Summary</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {dealSummary.map(([label, value]) => (
            <ResultTile key={label} label={label} value={value} />
          ))}
        </div>
      </section>
      {active === "acquisition" && (
        <CalculatorSection
          fields={[
            ["Purchase price", "purchasePrice"],
            ["Deposit percent", "depositPercent"],
            ["Transfer duty", "transferDuty"],
            ["Conveyancer / transfer fees", "conveyancerFees"],
            ["Bond registration fees", "bondRegistrationFees"],
            ["Initiation fees", "initiationFees"],
            ["Inspection / survey allowance", "inspectionAllowance"],
            ["Renovation / improvement budget", "renovationBudget"],
            ["Furniture / setup budget", "furnitureBudget"],
            ["Cash buffer", "cashBuffer"],
          ]}
          values={values}
          setValue={setValue}
          results={[
            ["Total cash required", formatRand(acquisition.totalCashRequired)],
            ["Loan amount", formatRand(acquisition.loanAmount)],
            ["Loan-to-value", formatPercent(acquisition.loanToValue)],
            ["Total acquisition cost", formatRand(acquisition.totalAcquisitionCost)],
            ["Cost basis before financing", formatRand(acquisition.costBasisBeforeFinancing)],
          ]}
        />
      )}
      {active === "rental" && (
        <CalculatorSection
          fields={[
            ["Monthly rent", "monthlyRent"],
            ["Other monthly income", "otherIncome"],
            ["Vacancy percent", "vacancyPercent"],
            ["Monthly rates", "monthlyRates"],
            ["Monthly levies", "monthlyLevies"],
            ["Insurance", "insurance"],
            ["Utilities paid by owner", "utilitiesPaidByOwner"],
            ["Capital expenditure reserve", "capitalExpenditureReserve"],
            ["Maintenance percent", "maintenancePercent"],
            ["Property management percent", "managementPercent"],
            ["Other monthly costs", "otherMonthlyCosts"],
            ["Bond payment override", "monthlyBondPayment"],
            ["Appreciation percent", "appreciationPercent"],
            ["Rent growth percent", "rentGrowthPercent"],
            ["Expense growth percent", "expenseGrowthPercent"],
            ["Holding period years", "holdingPeriodYears"],
            ["Selling cost percent", "sellingCostPercent"],
          ]}
          values={values}
          setValue={setValue}
          results={[
            ["Gross yield", formatPercent(rental.grossYield)],
            ["Net yield", formatPercent(rental.netYield)],
            ["Monthly NOI", formatRand(rental.monthlyNoi)],
            ["Annual NOI", formatRand(rental.annualNoi)],
            ["Cash flow after debt", formatRand(rental.cashFlowAfterDebt)],
            ["Annual cash flow", formatRand(rental.annualCashFlowAfterDebt)],
            ["Cash-on-cash return", formatPercent(rental.cashOnCashReturn)],
            ["Cap rate", formatPercent(rental.capRate)],
            ["DSCR", rental.dscr.toFixed(2)],
            ["Break-even rent", formatRand(rental.breakEvenRent)],
            ["Break-even occupancy", formatPercent(rental.breakEvenOccupancy)],
            ["1 percent rule", formatPercent(rental.onePercentRuleRatio)],
            ["50 percent rule NOI", formatRand(rental.fiftyPercentRuleNoiEstimate)],
            ["Value after hold", formatRand(rental.estimatedFutureValue)],
            ["Sale proceeds after costs", formatRand(rental.estimatedSaleProceeds)],
            ["Equity built", formatRand(rental.equityBuilt)],
            ["Holding-period profit", formatRand(rental.totalProfitOverHolding)],
            ["Simple annualized return", formatPercent(rental.simpleAnnualizedReturn)],
          ]}
        />
      )}
      {active === "bond" && (
        <CalculatorSection
          fields={[
            ["Interest rate", "interestRate"],
            ["Term years", "termYears"],
            ["Extra monthly payment", "extraMonthlyPayment"],
            ["Monthly rent", "monthlyRent"],
          ]}
          values={values}
          setValue={setValue}
          results={[
            ["Monthly bond payment", formatRand(bond.monthlyBondPayment)],
            ["Annual debt service", formatRand(bond.annualDebtService)],
            ["Total interest", formatRand(bond.totalInterest)],
            ["Payoff estimate", `${bond.payoffEstimateYears} years`],
            ["DSCR using rental NOI", bond.dscr.toFixed(2)],
            ["Break-even occupancy", formatPercent(bond.breakEvenOccupancy)],
          ]}
        />
      )}
      {active === "flip" && (
        <CalculatorSection
          fields={[
            ["Acquisition costs", "acquisitionCosts"],
            ["Renovation budget", "renovationBudget"],
            ["Contingency percent", "contingencyPercent"],
            ["Holding months", "holdingMonths"],
            ["Monthly holding cost", "monthlyHoldingCost"],
            ["Expected resale price", "expectedResalePrice"],
            ["Agent commission percent", "agentCommissionPercent"],
            ["Selling costs", "sellingCosts"],
            ["Target profit", "targetProfit"],
            ["Target ROI percent", "targetRoiPercent"],
            ["Delay sensitivity months", "delayMonths"],
            ["Resale sensitivity percent", "resaleSensitivityPercent"],
          ]}
          values={values}
          setValue={setValue}
          results={[
            ["Total project cost", formatRand(flip.totalProjectCost)],
            ["Net sale proceeds", formatRand(flip.netSaleProceeds)],
            ["Profit", formatRand(flip.profit)],
            ["ROI", formatPercent(flip.roi)],
            ["Annualized ROI", formatPercent(flip.annualizedRoi)],
            ["Required resale price", formatRand(flip.requiredResalePriceForTargetProfit)],
            ["Maximum purchase price", formatRand(flip.maximumPurchasePriceForTargetProfit)],
            ["70 percent rule offer", formatRand(flip.seventyPercentRuleOffer)],
            ["Contingency impact", formatRand(flip.contingencyCost)],
            ["Delay sensitivity", formatRand(flip.delaySensitivity)],
            ["Resale downside profit", formatRand(flip.resaleDownsideProfit)],
            ["Resale upside profit", formatRand(flip.resaleUpsideProfit)],
          ]}
        />
      )}
      {active === "brrrr" && (
        <div className="space-y-3">
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            BRRRR means Buy, Rehab, Rent, Refinance, Repeat. It estimates whether a renovation and
            refinance can return your cash while leaving a rentable property with equity.
          </p>
          <CalculatorSection
            fields={[
              ["Renovation budget", "renovationBudget"],
              ["All-in cost override", "allInCost"],
              ["After-repair value", "afterRepairValue"],
              ["Refinance LTV", "refinanceLtv"],
              ["Refinance fees", "refinanceFees"],
              ["Monthly rent", "monthlyRent"],
              ["Monthly expenses", "monthlyExpenses"],
              ["Monthly debt service", "monthlyDebtService"],
              ["Target DSCR", "targetDscr"],
            ]}
            values={values}
            setValue={setValue}
            results={[
              [
                "All-in cost",
                formatRand(n("allInCost") || n("purchasePrice") + n("renovationBudget")),
              ],
              ["Refinance loan amount", formatRand(brrrr.refinanceLoanAmount)],
              ["Cash returned", formatRand(brrrr.cashReturned)],
              ["Cash left in deal", formatRand(brrrr.cashLeftInDeal)],
              ["Cash-on-cash return", formatPercent(brrrr.cashOnCashReturn)],
              ["Equity created", formatRand(brrrr.equityCreated)],
              ["Refinance DSCR", brrrr.dscr.toFixed(2)],
              ["Rent needed for target DSCR", formatRand(brrrr.rentNeededForTargetDscr)],
            ]}
          />
        </div>
      )}
      {active === "development" && (
        <CalculatorSection
          fields={[
            ["Land price", "landPrice"],
            ["Buildable sqm", "buildableSqm"],
            ["Build cost per sqm", "buildCostPerSqm"],
            ["Professional fees percent", "professionalFeesPercent"],
            ["Contingency percent", "contingencyPercent"],
            ["Municipal / service costs", "municipalServiceCosts"],
            ["Finance / holding costs", "financeHoldingCosts"],
            ["Expected gross sale/rental value", "expectedGrossValue"],
          ]}
          values={values}
          setValue={setValue}
          results={[
            ["Hard cost", formatRand(development.hardCost)],
            ["Soft cost", formatRand(development.softCost)],
            ["Total development cost", formatRand(development.totalDevelopmentCost)],
            ["Profit", formatRand(development.profit)],
            ["Margin", formatPercent(development.margin)],
            ["Return on cost", formatPercent(development.returnOnCost)],
            ["Break-even sale price", formatRand(development.breakEvenSalePrice)],
            ["Price per sqm", formatRand(development.pricePerSqm)],
          ]}
        />
      )}
      {active === "scenarios" && (
        <div className="space-y-3">
          <CalculatorSection
            fields={[
              ["Low resale/value", "lowResalePrice"],
              ["Base resale/value", "baseResalePrice"],
              ["High resale/value", "highResalePrice"],
              ["Low rent", "lowRent"],
              ["Base rent", "baseRent"],
              ["High rent", "highRent"],
              ["Low cost", "lowCost"],
              ["Base cost", "baseCost"],
              ["High cost", "highCost"],
              ["Low interest rate", "lowInterestRate"],
              ["Base interest rate", "baseInterestRate"],
              ["High interest rate", "highInterestRate"],
            ]}
            values={values}
            setValue={setValue}
            results={[]}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {scenarios.map((scenario) => (
              <div
                key={scenario.label}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{scenario.label}</div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      scenario.status === "green" && "bg-emerald-500/15 text-emerald-700",
                      scenario.status === "yellow" && "bg-amber-500/15 text-amber-700",
                      scenario.status === "red" && "bg-rose-500/15 text-rose-700",
                    )}
                  >
                    {scenario.status}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[12px] text-muted-foreground">
                  <span>Profit: {formatRand(scenario.profit)}</span>
                  <span>Monthly cash flow: {formatRand(scenario.monthlyCashFlow)}</span>
                  <span>DSCR: {scenario.dscr.toFixed(2)}</span>
                  <span>ROI: {formatPercent(scenario.roi)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        {savedScenarios.length > 0
          ? `${savedScenarios.length} saved strategy scenario${savedScenarios.length === 1 ? "" : "s"} will feed the Easy Erf Report shell.`
          : "Save a scenario to move Strategy progress. Estimates remain based on your assumptions."}
        {savedScenarios.length > 0 && (
          <button
            type="button"
            onClick={onOpenReport}
            className="mt-3 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Continue to Easy Erf Report
          </button>
        )}
      </div>
    </div>
  );
}

function activeLabel(active: CalculatorTab) {
  return CALCULATOR_TABS.find((tab) => tab.id === active)?.label ?? "Strategy";
}

function CalculatorSection({
  fields,
  values,
  setValue,
  results,
}: {
  fields: [string, string][];
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  results: [string, string][];
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, key]) => (
          <label key={key} className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <input
              inputMode="decimal"
              value={values[key] ?? ""}
              onChange={(event) => setValue(key, event.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
      {results.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {results.map(([label, value]) => (
            <ResultTile key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
