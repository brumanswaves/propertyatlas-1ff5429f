import { formatAreaM2Value, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Save,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  buildReportComposition,
  isGroupCollapsedByDefault,
  type ReportGroupId,
} from "@/lib/reports/reportComposition";
import { ZoningBuildTab } from "./dossier/ZoningBuildTab";
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
  readStrategyWorkspace,
  saveStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import {
  createErfAssetSignedUrl,
  groupErfAssets,
  type ErfAsset,
  type ErfAssetGroup,
} from "@/lib/workbench/erfFileVault";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { useSitePotentialProject } from "@/lib/sitePotential/sitePotentialService";
import { SITE_POTENTIAL_DISCLAIMER } from "@/lib/sitePotential/config";
import type { InvestorWorkflowView } from "./dossier/investorWorkflow";
import { StrategyLab } from "./strategy/StrategyLab";
import { canonicalReportAction } from "@/lib/investigation/canonicalNextAction";
import { composeEasyErfReport } from "@/lib/reports/composeEasyErfReport";
import { ReportOpening } from "@/components/property/dossier/ReportOpening";
import {
  ReportEvidenceAppendix,
  ReportMarketSection,
  ReportSitePotentialSection,
  ReportStrategySection,
} from "@/components/property/dossier/ReportBodySections";
import { buildMarketSectionModel } from "@/lib/reports/marketSection";
import {
  buildLocationLifestyleSectionModel,
  buildMunicipalServicesSectionModel,
  buildSiteRiskSectionModel,
} from "@/lib/reports/contextSections";
import { buildSgSectionModel } from "@/lib/reports/sgSection";
import {
  ReportContextSection,
  ReportMunicipalSection,
  ReportSgLineageSection,
} from "@/components/property/dossier/ReportContextSections";
import { buildStrategySectionModel } from "@/lib/reports/strategySection";
import { buildEvidenceAppendixRows } from "@/lib/reports/evidenceAppendix";

import {
  FindingCard,
  ReportActionPlan,
  ReportAreaReconciliation,
  ReportFindingsBlock,
} from "@/components/property/dossier/ReportFindingsSection";
import {
  AssetExtractionStatusChip,
  EvidenceBadgeChip,
  IdRow,
  OwnershipDetailRow,
  ReportOwnershipSection,
} from "@/components/property/dossier/ReportEvidenceUi";

import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import {
  buildReportViewModel,
  REPORT_SECTIONS,
  type EvidenceBadge,
  type OwnershipDetail,
} from "@/lib/reports/buildReportViewModel";
import {
  buildDecisionIntelligence,
  type DecisionMatrixRow,
  type DecisionVerdict,
  type EvidenceTimelineItem,
} from "@/lib/reports/buildDecisionIntelligence";
import {
  ASK_EASY_ERF_MAX_QUESTION_CHARACTERS,
  buildAskEasyErfEvidencePayload,
  buildAskEasyErfSelectedEvidencePayload,
  hasAskEasyErfPackEvidence,
  hasEnoughAskEasyErfSelectedEvidence,
  suggestedAskEasyErfQuestions,
  type AskEasyErfAnswer,
  type AskEasyErfEvidencePayload,
  type AskEasyErfEvidenceSourceType,
} from "@/lib/reports/askEasyErf";
import { askEasyErfViaEdgeFunction } from "@/lib/reports/askEasyErfClient";
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import { loadReportPropertyNotes, type PropertyNotes } from "@/lib/workbench/propertyNotes";
import {
  buildReportSnapshot,
  clearReportSnapshots,
  compareReportSnapshots,
  readReportSnapshots,
  saveReportSnapshot,
  snapshotsForActiveParcel,
  type ReportSnapshot,
  type ReportSnapshotState,
  type ReportSnapshotChange,
  type ReportSnapshotChangeType,
} from "@/lib/reports/reportSnapshots";
import {
  buildInvestorDecisionMode,
  type InvestorDecisionMode,
  type InvestorNumberRow,
} from "@/lib/reports/buildInvestorDecisionMode";
import {
  readReportDecisionMode,
  writeReportDecisionMode,
  type ReportDecisionMode,
} from "@/lib/reports/reportDecisionMode";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import type { DossierView } from "@/components/property/dossier/reportViews";
import {
  ReportViewActiveLabel,
  ReportViewSelector,
} from "@/components/property/dossier/ReportViewSelector";

import { createReportPrintLifecycleController } from "@/lib/reports/reportPrintLifecycle";

interface Props {
  parcel: NormalizedOfficialParcel;
  view?: DossierView;
  onSelectView?: (view: DossierView) => void;
}

export type { DossierView } from "@/components/property/dossier/reportViews";

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
    return <StoepAiReportView parcel={parcel} onSelectView={onSelectView} />;
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

const REPORT_ASSET_GROUP_ORDER: ErfAssetGroup[] = [
  "Generated concepts",
  "Official and source documents",
  "Paid reports",
  "Site and topography",
  "Property photographs",
  "Plans and inspiration",
  "Report exports",
  "Other",
];

const REPORT_PRINT_PREPARATION_TIMEOUT_MS = 8000;
const REPORT_PRINT_EMERGENCY_CLEANUP_MS = 2 * 60 * 1000;
const REPORT_PRINT_FOCUS_MIN_HOLD_MS = 30_000;
const REPORT_PRINT_FRAME_ID = "easy-erf-report-print-frame";
const REPORT_PRINT_ROOT_ID = "easy-erf-report-print-root";

const REPORT_PRINT_IFRAME_CSS = `
  @page { size: A4 portrait; margin: 14mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0D1B2A;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  body { min-width: 0; overflow: visible; }
  #${REPORT_PRINT_ROOT_ID} { display: block; }
  .report-print-document {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0D1B2A;
  }
  .report-print-document .report-section {
    break-inside: auto;
    page-break-inside: auto;
    box-shadow: none !important;
  }
  .report-print-document article,
  .report-print-document details,
  .report-print-document li {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .report-print-document .report-opening-header,
  .report-print-document .report-decision-area,
  .report-print-document .report-opening figure {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .report-print-document .report-decision-area { display: block; }
  .report-print-document .report-decision-area > * + * { margin-top: 10mm; }
  .report-no-print { display: none !important; }
  img { max-width: 100%; }
`;
const signedAssetPreviewUrlCache = new Map<string, string>();
const pendingSignedAssetPreviewSettlements = new Set<Promise<void>>();

type SignedAssetPreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable" };

function workspaceAssetCategory(file: ErfAsset) {
  if (file.asset_category === "sg_diagram") return "SG diagram";
  if (file.asset_type === "lightstone_report") return "Lightstone PDF";
  if (file.asset_type === "windeed_report") return "WinDeed PDF";
  if (file.asset_category === "generated_design") return "AI concept visualisation";
  return file.source_label || file.asset_type.replace(/_/g, " ");
}

function formatAssetSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAssetDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function assetTitle(asset: ErfAsset) {
  const title = asset.metadata?.title;
  return typeof title === "string" && title.trim() ? title : asset.original_file_name;
}

function trackSignedAssetPreviewSettlement(promise: Promise<void>) {
  pendingSignedAssetPreviewSettlements.add(promise);
  promise.finally(() => pendingSignedAssetPreviewSettlements.delete(promise));
}

function waitForSignedAssetPreviewSettlements() {
  return Promise.allSettled(Array.from(pendingSignedAssetPreviewSettlements)).then(() => undefined);
}

async function waitForReportPrintPreparation(root: ParentNode | null | undefined) {
  await Promise.race([
    (async () => {
      await waitForSignedAssetPreviewSettlements();
      await waitForPrintableReportImages(root);
    })(),
    new Promise<void>((resolve) => window.setTimeout(resolve, REPORT_PRINT_PREPARATION_TIMEOUT_MS)),
  ]);
}

function waitForPrintableReportImages(root: ParentNode | null | undefined) {
  if (!root) return Promise.resolve();
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          const done = () => {
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
            resolve();
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function createReportPrintFrame() {
  const existing = document.getElementById(REPORT_PRINT_FRAME_ID);
  if (existing instanceof HTMLIFrameElement) existing.remove();
  const iframe = document.createElement("iframe");
  iframe.id = REPORT_PRINT_FRAME_ID;
  iframe.title = "Printable Easy Erf Report";
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "794px",
    height: "1123px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(iframe);
  return iframe;
}

function prepareReportPrintFrame(iframe: HTMLIFrameElement) {
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) return Promise.resolve();
  frameDocument.open();
  frameDocument.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Printable Easy Erf Report</title></head><body><div id="${REPORT_PRINT_ROOT_ID}"></div></body></html>`,
  );
  frameDocument.close();

  const stylesheetPromises = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ).map(
    (link) =>
      new Promise<void>((resolve) => {
        const clone = frameDocument.createElement("link");
        clone.rel = "stylesheet";
        clone.href = link.href;
        clone.media = link.media || "all";
        clone.onload = () => resolve();
        clone.onerror = () => resolve();
        frameDocument.head.appendChild(clone);
      }),
  );

  document.querySelectorAll<HTMLStyleElement>("style").forEach((sourceStyle) => {
    const clone = frameDocument.createElement("style");
    clone.textContent = sourceStyle.textContent;
    frameDocument.head.appendChild(clone);
  });

  const style = frameDocument.createElement("style");
  style.textContent = REPORT_PRINT_IFRAME_CSS;
  frameDocument.head.appendChild(style);

  return Promise.race([
    Promise.allSettled(stylesheetPromises).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, REPORT_PRINT_PREPARATION_TIMEOUT_MS)),
  ]);
}

function SignedAssetPreview({ asset }: { asset: ErfAsset }) {
  const [previewState, setPreviewState] = useState<SignedAssetPreviewState>(() =>
    signedAssetPreviewUrlCache.has(asset.id)
      ? { status: "ready", url: signedAssetPreviewUrlCache.get(asset.id) as string }
      : { status: "loading" },
  );
  const settlePreviewRef = useRef<(() => void) | null>(null);

  const settlePreview = () => {
    settlePreviewRef.current?.();
    settlePreviewRef.current = null;
  };

  useEffect(() => {
    let alive = true;
    let settled = false;
    const settlement = new Promise<void>((resolve) => {
      settlePreviewRef.current = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
    });
    trackSignedAssetPreviewSettlement(settlement);
    if (!signedAssetPreviewUrlCache.has(asset.id)) setPreviewState({ status: "loading" });
    createErfAssetSignedUrl(asset)
      .then((signedUrl) => {
        if (signedUrl) signedAssetPreviewUrlCache.set(asset.id, signedUrl);
        if (!alive) return;
        if (signedUrl) setPreviewState({ status: "ready", url: signedUrl });
        else {
          setPreviewState({ status: "unavailable" });
          settlePreview();
        }
      })
      .catch(() => {
        if (alive) setPreviewState({ status: "unavailable" });
        settlePreview();
      });
    return () => {
      alive = false;
      settlePreview();
    };
  }, [asset]);

  if (previewState.status !== "ready") {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-[1.25rem] bg-[#0D1B2A]/10 px-4 text-center text-xs font-semibold text-[#0D1B2A]/55">
        <span>
          Signed preview unavailable
          {previewState.status === "loading" && (
            <span className="mt-1 block font-normal">Preparing the signed preview URL.</span>
          )}
        </span>
      </div>
    );
  }
  return (
    <img
      src={previewState.url}
      alt={assetTitle(asset)}
      className="aspect-[4/3] w-full rounded-[1.25rem] object-cover"
      onLoad={settlePreview}
      onError={() => {
        signedAssetPreviewUrlCache.delete(asset.id);
        setPreviewState({ status: "unavailable" });
        settlePreview();
      }}
    />
  );
}

async function openVaultAsset(file: ErfAsset) {
  const url = await createErfAssetSignedUrl(file);
  window.open(url, "_blank", "noopener,noreferrer");
}

function sitePotentialReportModeLabel(mode: string | null | undefined) {
  switch (mode) {
    case "vacant_land":
      return "Vacant land concept";
    case "renovation":
      return "Existing-house renovation concept";
    case "other_building":
      return "Other building concept";
    case "skipped":
      return "Skipped";
    default:
      return "Site Potential concept";
  }
}

function StoepAiReportView({
  parcel,
  onSelectView,
}: {
  parcel: NormalizedOfficialParcel;
  onSelectView?: (view: DossierView) => void;
}) {
  const { user } = useAuth();
  const { evidence, marketAddressIntelligence } = useSavedMarketEvidence(parcel.id);
  const fileVault = useErfFileVault(parcel.id);
  const workspaceState = readErfWorkspaceState(parcel.id);
  const strategyWorkspace = readStrategyWorkspace(parcel.id);
  const scenarios = readStrategyScenarios(parcel.id);
  const chosenScenario = getChosenStrategyScenario(parcel.id);
  const generatedDesigns = fileVault.assets.filter(
    (asset) => asset.asset_category === "generated_design",
  );
  const siteProject = useSitePotentialProject(parcel.id, generatedDesigns);
  const selectedDesign = siteProject.selectedDesign;
  const groupedAssets = groupErfAssets(fileVault.assets);
  const selectedSiteMode = siteProject.project?.mode ?? workspaceState.sitePotential.mode;
  const sitePotentialSkipped =
    selectedSiteMode === "skipped" ||
    workspaceState.sitePotential.skipped ||
    workspaceState.sitePotential.progressState === "skipped";
  const notesRequestRef = useRef(0);
  const [reportNotes, setReportNotes] = useState<PropertyNotes | null>(null);

  useEffect(() => {
    notesRequestRef.current += 1;
    const requestId = notesRequestRef.current;
    const userId = user?.id ?? null;
    const parcelId = parcel.id;
    setReportNotes(null);
    void loadReportPropertyNotes(
      parcelId,
      userId,
      () =>
        notesRequestRef.current === requestId &&
        parcel.id === parcelId &&
        (user?.id ?? null) === userId,
    ).then((result) => {
      if (notesRequestRef.current !== requestId) return;
      if (result.status === "loaded") setReportNotes(result.notes);
    });
    return () => {
      notesRequestRef.current += 1;
    };
  }, [parcel.id, user?.id]);

  const report = buildReportViewModel({
    parcel,
    workspaceState,
    savedEvidence: evidence,
    marketAddress: marketAddressIntelligence ?? null,
    assets: fileVault.assets,
    chosenScenario,
    strategyScenarios: scenarios,
    selectedSiteDesign: selectedDesign,
    propertyNotes: reportNotes,
    strategyWorkspace,
    sitePotentialProject: siteProject.project ?? null,
    siteBrief: siteProject.project?.design_brief ?? null,
  });
  const decision = buildDecisionIntelligence(report);
  const investorMode = useMemo(
    () =>
      buildInvestorDecisionMode({
        report,
        decision,
        savedEvidence: evidence,
        chosenScenario,
      }),
    [chosenScenario, decision, evidence, report],
  );
  const [decisionMode, setDecisionMode] = useState<ReportDecisionMode>(() =>
    readReportDecisionMode(parcel.id),
  );
  useEffect(() => {
    setDecisionMode(readReportDecisionMode(parcel.id));
  }, [parcel.id]);
  const updateDecisionMode = (mode: ReportDecisionMode) => {
    setDecisionMode(writeReportDecisionMode(parcel.id, mode));
  };
  const reportDoc = useMemo(
    () =>
      composeEasyErfReport({
        report,
        pack: report.evidencePack ?? undefined,
        perspective: decisionMode === "investor" ? "investor" : "home_buyer",
        decisionMode,
        canonicalNextAction: canonicalReportAction({
          parcel,
          workspaceState,
          assets: fileVault.assets,
          savedEvidence: evidence,
          scenarioCount: scenarios.length,
          chosenScenarioId: chosenScenario?.id ?? null,
          skippedTaskIds: workspaceState.investigation.skippedTaskIds,
        }),
      }),
    [
      chosenScenario?.id,
      decisionMode,
      evidence,
      fileVault.assets,
      parcel,
      report,
      scenarios.length,
      workspaceState,
    ],
  );

  const marketSection = useMemo(
    () =>
      buildMarketSectionModel({
        market: report.market,
        pack: report.evidencePack ?? null,
        officialAreaM2: report.identity.areaM2 ?? null,
      }),
    [report],
  );
  const strategySection = useMemo(
    () => buildStrategySectionModel({ chosen: chosenScenario, scenarioCount: scenarios.length }),
    [chosenScenario, scenarios.length],
  );
  const siteRiskSection = useMemo(
    () => buildSiteRiskSectionModel({ pack: report.evidencePack ?? null }),
    [report.evidencePack],
  );
  const municipalSection = useMemo(
    () => buildMunicipalServicesSectionModel({ pack: report.evidencePack ?? null }),
    [report.evidencePack],
  );
  const locationSection = useMemo(
    () =>
      buildLocationLifestyleSectionModel({
        pack: report.evidencePack ?? null,
        identity: {
          marketAddressLine: report.identity.marketAddressLine,
          municipality: report.identity.municipality,
          province: report.identity.province,
          coordinates: report.identity.coordinates,
        },
        subjectListing: report.market.subjectListing,
      }),
    [report.evidencePack, report.identity, report.market.subjectListing],
  );
  const appendixRows = useMemo(
    () =>
      buildEvidenceAppendixRows({
        assets: fileVault.assets,
        pack: report.evidencePack ?? null,
      }),
    [fileVault.assets, report.evidencePack],
  );

  const sgSection = useMemo(
    () => buildSgSectionModel({ appendixRows, pack: report.evidencePack ?? null }),
    [appendixRows, report.evidencePack],
  );

  const askSuggestionPayload = useMemo(
    () =>
      buildAskEasyErfEvidencePayload({
        report,
        decision,
        assets: fileVault.assets,
        savedEvidence: evidence,
        strategyScenarios: scenarios,
      }),
    [decision, evidence, fileVault.assets, report, scenarios],
  );
  const currentReportSnapshot = useMemo(
    () =>
      buildReportSnapshot({
        report,
        decision,
        assets: fileVault.assets,
        savedEvidence: evidence,
        strategyScenarios: scenarios,
      }),
    [decision, evidence, fileVault.assets, report, scenarios],
  );
  const [reportSnapshotState, setReportSnapshotState] = useState<ReportSnapshotState>(() => ({
    parcelId: parcel.id,
    snapshots: readReportSnapshots(parcel.id),
  }));
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [clearSnapshotsRequested, setClearSnapshotsRequested] = useState(false);
  const [printFrame, setPrintFrame] = useState<HTMLIFrameElement | null>(null);
  const printStylesReadyRef = useRef<Promise<void> | null>(null);
  const printCleanupRef = useRef<(() => void) | null>(null);
  const printInProgressRef = useRef(false);
  useEffect(() => {
    setReportSnapshotState({ parcelId: parcel.id, snapshots: readReportSnapshots(parcel.id) });
    setSnapshotMessage(null);
    setClearSnapshotsRequested(false);
  }, [parcel.id]);
  const reportSnapshots = snapshotsForActiveParcel(parcel.id, reportSnapshotState);
  const snapshotComparison = useMemo(
    () => compareReportSnapshots(reportSnapshots[0] ?? null, currentReportSnapshot),
    [currentReportSnapshot, reportSnapshots],
  );

  const handleSaveReportSnapshot = () => {
    const snapshot = buildReportSnapshot({
      report,
      decision,
      assets: fileVault.assets,
      savedEvidence: evidence,
      strategyScenarios: scenarios,
      savedAt: new Date().toISOString(),
    });
    const result = saveReportSnapshot(snapshot);
    setReportSnapshotState({ parcelId: parcel.id, snapshots: result.snapshots });
    setClearSnapshotsRequested(false);
    setSnapshotMessage(
      result.saved
        ? "Current report snapshot saved."
        : "This report already matches the latest saved snapshot.",
    );
  };

  const handleClearReportSnapshots = () => {
    clearReportSnapshots(parcel.id);
    setReportSnapshotState({ parcelId: parcel.id, snapshots: [] });
    setClearSnapshotsRequested(false);
    setSnapshotMessage("Report snapshot history cleared for this property.");
  };

  const handlePrint = () => {
    if (
      printInProgressRef.current ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    printInProgressRef.current = true;
    const iframe = createReportPrintFrame();
    printStylesReadyRef.current = prepareReportPrintFrame(iframe);
    setPrintFrame(iframe);
  };

  useEffect(() => {
    if (!printFrame || typeof window === "undefined") return;
    const frameWindow = printFrame.contentWindow;
    const frameDocument = printFrame.contentDocument;
    const root = frameDocument?.getElementById(REPORT_PRINT_ROOT_ID);
    if (!frameWindow || !frameDocument || !root) return;
    let lifecycle: ReturnType<typeof createReportPrintLifecycleController> | null = null;
    let preparationCancelled = false;
    let finalCleaned = false;
    const finalCleanup = (updateState = true) => {
      if (finalCleaned) return;
      preparationCancelled = true;
      finalCleaned = true;
      lifecycle?.dispose();
      printCleanupRef.current = null;
      printStylesReadyRef.current = null;
      printInProgressRef.current = false;
      if (updateState) setPrintFrame(null);
      printFrame.remove();
    };
    lifecycle = createReportPrintLifecycleController({
      frameWindow,
      parentWindow: window,
      emergencyCleanupMs: REPORT_PRINT_EMERGENCY_CLEANUP_MS,
      focusMinimumHoldMs: REPORT_PRINT_FOCUS_MIN_HOLD_MS,
      onFinish: () => finalCleanup(),
    });
    const printWhenReady = async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await printStylesReadyRef.current;
      await frameDocument.fonts?.ready.catch(() => undefined);
      await waitForReportPrintPreparation(root);
      if (preparationCancelled) return;
      frameWindow.focus();
      lifecycle?.markPrintStarted();
      frameWindow.print();
    };
    printCleanupRef.current = () => finalCleanup(false);
    lifecycle.register();
    void printWhenReady();
    return () => {
      finalCleanup(false);
    };
  }, [printFrame]);

  useEffect(
    () => () => {
      printCleanupRef.current?.();
    },
    [],
  );

  const readinessStroke = (state: string) =>
    state === "confirmed"
      ? "bg-[#16a34a] text-white"
      : state === "partial"
        ? "bg-[#F59E0B] text-[#0D1B2A]"
        : state === "not_reviewed"
          ? "bg-[#D9E6F2] text-[#0D1B2A]"
          : "bg-[#0D1B2A]/10 text-[#0D1B2A]/70";

  const readinessLabel = (state: string) =>
    state === "confirmed"
      ? "Confirmed"
      : state === "partial"
        ? "Partial"
        : state === "not_reviewed"
          ? "Not reviewed"
          : "Missing";

  const routeTabFor = (tab?: string): DossierView => {
    switch (tab) {
      case "research":
        return "research";
      case "reports":
        return "reports";
      case "listings":
        return "listings";
      case "calculators":
        return "calculators";
      case "zoning-build":
        return "zoning-build";
      case "site-potential":
        return "site-potential";
      case "stoep-report":
        return "stoep-report";
      default:
        return "overview";
    }
  };

  const reportDocument = (printOnly = false) => {
    const composition = buildReportComposition(decisionMode);
    const groupNodes: Record<ReportGroupId, ReactNode> = {
      identity: (
        <>
          <ReportGroupHeading
            letter="A"
            anchorId="report-group-identity"
            title="Decision & identity"
            intro="Who and what this erf officially is, and how the records reconcile."
          />

          {/* IDENTITY */}
          <section
            id="report-identity"
            className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
          >
            <ReportSectionTitle
              eyebrow="Property Identity"
              title="Official identifiers and confirmed address"
            />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <IdRow label="Erf number" value={report.identity.erfNumber} badge="official" />
              <IdRow label="Portion" value={report.identity.portion} badge="official" />
              <IdRow label="LPI" value={report.identity.lpi} badge="official" />
              <IdRow label="Parcel key" value={report.identity.parcelKey} badge="official" />
              <IdRow label="Municipality" value={report.identity.municipality} badge="official" />
              <IdRow label="Province" value={report.identity.province} badge="official" />
              <IdRow
                label="Erf size (m²)"
                value={formatAreaM2Value(report.identity.areaM2)}
                badge="official"
              />
              <IdRow
                label="Coordinates"
                value={
                  report.identity.coordinates
                    ? `${report.identity.coordinates.lat.toFixed(5)}, ${report.identity.coordinates.lng.toFixed(5)}`
                    : null
                }
                badge="official"
              />
              <IdRow
                label="Market address (user-confirmed)"
                value={report.identity.marketAddressLine}
                badge="user_confirmed"
              />
              {report.identity.cadastral.map((row) => (
                <IdRow key={row.label} label={row.label} value={row.value} badge={row.badge} />
              ))}
            </dl>

            {report.identity.addressAndOfficialMismatch && (
              <p className="mt-3 rounded-2xl border border-[#F59E0B]/40 bg-[#fffbeb] px-3 py-2 text-xs leading-5 text-[#92400E]">
                Possible mismatch: the saved market address municipality differs from the official
                parcel municipality. Recheck identity before using downstream data.
              </p>
            )}

            <ReportAreaReconciliation
              identity={report.identity}
              officialAreaLabel={formatAreaM2Value(report.identity.areaM2)}
              discrepancy={
                reportDoc.findings.find((f) => f.id === "finding-area-discrepancy") ?? null
              }
              actions={reportDoc.actions}
              onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
            />
          </section>

          {/* OWNERSHIP */}
          <ReportOwnershipSection
            ownership={report.ownership}
            onOpenReports={() => onSelectView?.("reports")}
          />

          {/* SG / LINEAGE EVIDENCE */}
          <ReportSgLineageSection
            anchorId="report-sg-evidence"
            model={sgSection}
            onOpenAsset={(assetId) => {
              const asset = fileVault.assets.find((file) => file.id === assetId);
              if (asset) void openVaultAsset(asset);
            }}
            onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
          />

          <ReportFindingsBlock
            anchorId="report-sg-findings"
            eyebrow="SG findings"
            title="What the diagrams support about this erf"
            intro="Parent-plan context is kept separate from parcel-specific facts. Context from a parent general plan never becomes a fact about this erf."
            findings={reportDoc.findings.filter((f) =>
              [
                "finding-sg-parent-lineage",
                "finding-registered-extent",
                "finding-servitudes-sg",
              ].includes(f.id),
            )}
            actions={reportDoc.actions}
            onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
            emptyMessage="No Surveyor-General diagram has been read and matched to this erf yet. Upload the SG diagram in the Erf File to add cadastral evidence."
          />
        </>
      ),
      planning: (
        <>
          <ReportGroupHeading
            letter="B"
            anchorId="report-group-planning"
            title="What exists / what can be done"
            intro="Approved structures, planning controls and explored site potential."
          />

          {/* BUILDINGS, PLANS & COMPLIANCE */}
          <ReportFindingsBlock
            anchorId="report-buildings"
            eyebrow="Buildings, Plans & Compliance"
            title="Approved plans and structure compliance"
            intro="Whether structures are approved can only come from municipal building-plan records. Architectural plans, notes and Site Potential concepts are never treated as approved-plan evidence."
            findings={reportDoc.findings.filter((f) => f.category === "buildings")}
            actions={reportDoc.actions}
            onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
            emptyMessage="Approved building plans have not been obtained and no plan comparison has been completed. Request the approved plan set from the municipality to close this section."
          />

          {/* PLANNING */}
          <section
            id="report-planning"
            className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
          >
            <ReportSectionTitle
              eyebrow="Zoning, Planning & Buildability"
              title="Only municipally supported controls are shown"
            />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {report.planning.map((field) => (
                <div
                  key={field.label}
                  className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3"
                >
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                    {field.label}
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-[#0D1B2A]">
                    {field.value ?? (
                      <span className="text-[#0D1B2A]/50 font-normal">Not yet verified</span>
                    )}
                  </dd>
                  <EvidenceBadgeChip
                    badge={field.badge}
                    label={field.value ? "Official" : "Missing"}
                  />
                </div>
              ))}
            </dl>
            {reportDoc.findings.filter((f) => f.category === "planning").length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {reportDoc.findings
                  .filter((f) => f.category === "planning")
                  .map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      actions={reportDoc.actions}
                      onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* ZONING & BUILD — published rules stay separated from confirmed rights */}
          <section
            id="report-zoning-build"
            className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
          >
            <ReportSectionTitle
              eyebrow="Zoning & Build"
              title="What the published planning rules allow, and what is still unconfirmed"
              intro="Published municipal rules are general rules for the matched zone. They are not confirmed rights for this erf until zoning, title conditions, servitudes, departures and approved plans have been checked."
            />
            <div className="mt-4">
              <ZoningBuildTab
                parcel={parcel}
                compact
                onOpenTab={(next) => onSelectView?.(routeTabFor(next))}
              />
            </div>
          </section>

          {/* SITE POTENTIAL */}
          <ReportSitePotentialSection
            anchorId="report-site"
            hasConcept={Boolean(selectedDesign)}
            skipped={sitePotentialSkipped}
            conceptName={
              selectedDesign
                ? siteProject.project?.selected_style
                  ? `Selected concept — ${siteProject.project.selected_style}`
                  : "Selected property concept"
                : null
            }
            rationale={
              selectedDesign
                ? "Concept selected from the saved Site Potential project and linked to the Erf File Vault."
                : null
            }
            projectStatus={sitePotentialReportModeLabel(selectedSiteMode)}
            brief={siteProject.project?.design_brief || null}
            conceptAssetId={selectedDesign?.id ?? null}
            disclaimer={SITE_POTENTIAL_DISCLAIMER}
            visual={selectedDesign ? <SignedAssetPreview asset={selectedDesign} /> : undefined}
            onOpenSitePotential={() => onSelectView?.("site-potential")}
            onOpenSourceFile={
              selectedDesign ? () => void openVaultAsset(selectedDesign) : undefined
            }
          />
        </>
      ),
      market: (
        <>
          <ReportGroupHeading
            letter="C"
            anchorId="report-group-market"
            title="Price & strategy"
            intro="What the market evidence supports, and what the numbers say under your own assumptions."
          />

          {/* MARKET */}
          <ReportMarketSection
            anchorId="report-market"
            model={marketSection}
            onOpenMarket={() => onSelectView?.("listings")}
          />

          {/* STRATEGY & FINANCIALS */}
          <ReportStrategySection
            anchorId="report-strategy"
            model={strategySection}
            onOpenStrategy={() => onSelectView?.("calculators")}
          />
        </>
      ),
      context: (
        <>
          <ReportGroupHeading
            letter="D"
            anchorId="report-group-context"
            title="Physical & ownership context"
            intro="Conditions, services, running costs and surroundings supported by evidence."
          />

          <details
            className="report-disclosure group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5"
            open={!isGroupCollapsedByDefault(composition, "context")}
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#0D1B2A]">
              Show physical, municipal and location context
              <span className="ml-2 text-xs font-normal text-[#64748B]">
                Conditions, services, running costs and surroundings
              </span>
            </summary>
            <div className="mt-4 space-y-5">
              {/* SITE, ENVIRONMENTAL & PHYSICAL RISK */}
              <ReportContextSection
                anchorId="report-site-risk"
                eyebrow="Site, Environmental & Physical Risk"
                title="Physical and environmental conditions supported by evidence"
                model={siteRiskSection}
                onOpenTab={(tab) => onSelectView?.(routeTabFor(tab ?? undefined))}
              />

              {/* MUNICIPAL SERVICES & OWNERSHIP COSTS */}
              <ReportMunicipalSection
                anchorId="report-municipal"
                model={municipalSection}
                onOpenTab={(tab) => onSelectView?.(routeTabFor(tab ?? undefined))}
              />

              {/* LOCATION & LIFESTYLE */}
              <ReportContextSection
                anchorId="report-location"
                eyebrow="Location & Lifestyle"
                title="Where this erf sits, and what is actually known about it"
                model={locationSection}
                onOpenTab={(tab) => onSelectView?.(routeTabFor(tab ?? undefined))}
              />
            </div>
          </details>
        </>
      ),
      next: (
        <>
          {/* DECISION DETAIL — deeper evidence readiness, never a second hero */}
          <section
            id="report-brief"
            className="report-section rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)] scroll-mt-24"
          >
            <ReportSectionTitle
              eyebrow="Decision Detail"
              title="Evidence readiness behind the decision"
              intro="The headline decision is in the report opening. This section shows how that decision was reached: confidence by category, what is known, what is still needed, contradictions and the saved evidence chronology."
            />
            <div className="mt-4">
              <ReportViewActiveLabel mode={decisionMode} />
            </div>

            {/* EXECUTIVE DECISION BRIEF */}
            {decisionMode === "investor" ? (
              <InvestorDecisionBrief data={investorMode} onSelectView={onSelectView} />
            ) : (
              <div className="mt-6 space-y-5">
                <div className="report-decision-hero grid gap-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#0D1B2A] p-5 text-white lg:grid-cols-[260px_1fr]">
                  <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
                      Overall verdict
                    </div>
                    <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                      {decisionVerdictLabel(decision.verdict)}
                    </h3>
                    <div className="mt-4 flex items-center gap-4">
                      <div
                        className="grid h-24 w-24 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
                        style={{
                          background: `conic-gradient(#FF6A00 ${decision.confidencePercent}%, rgba(255,255,255,0.16) 0)`,
                        }}
                        aria-label={`Evidence confidence ${decision.confidencePercent}%`}
                      >
                        <span className="grid h-20 w-20 place-items-center rounded-full bg-[#0D1B2A]">
                          {decision.confidencePercent}%
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-white/68">
                        Evidence confidence measures completeness and recorded-risk coverage. It is
                        not a property-quality score, valuation confidence, or purchase
                        recommendation.
                      </p>
                    </div>
                  </article>
                  <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
                      Evidence-grounded interpretation
                    </div>
                    <p className="mt-3 max-w-4xl text-base leading-7 text-white/82">
                      {decision.summary}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-white/58">
                      This interpretation is assembled from official, uploaded, user-confirmed,
                      market, and saved workspace data. It is not labelled human verified.
                    </p>
                  </article>
                </div>

                <section className="rounded-[1.5rem] border border-[#D9E6F2] bg-[#F7FBFF] p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
                        Property IQ / Confidence Engine
                      </div>
                      <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                        Why the report confidence exists
                      </h3>
                    </div>
                    <p className="max-w-xl text-xs leading-5 text-[#64748B]">
                      Each category is scored from the recorded evidence state. Open a row to see
                      the reason behind the score.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                    {decision.confidenceCategories.map((category) => (
                      <details
                        key={category.id}
                        className="group rounded-2xl border border-[#D9E6F2] bg-white p-3 open:border-[#FF6A00]/35"
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#0D1B2A]">
                              {category.label}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                                readinessStroke(category.state),
                              )}
                            >
                              {readinessLabel(category.state)}
                            </span>
                          </div>
                          <div className="mt-3 text-2xl font-semibold text-[#0D1B2A]">
                            {category.score}
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D9E6F2]">
                            <div
                              className="h-full rounded-full bg-[#FF6A00]"
                              style={{ width: `${category.score}%` }}
                            />
                          </div>
                        </summary>
                        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/66">
                          {category.explanation}
                        </p>
                      </details>
                    ))}
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
                  <DecisionListPanel
                    title="What Easy Erf knows"
                    items={decision.known}
                    empty="No structured facts are strong enough to list yet."
                  />
                  <DecisionListPanel
                    title="What Easy Erf still needs"
                    items={decision.stillNeeded}
                    empty="No immediate evidence gaps were generated from the current structured state."
                    footnote="Completing these items may improve report confidence."
                  />
                </div>

                <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
                  <ReportSectionTitle
                    eyebrow="Contradictions"
                    title="Conflicting structured evidence"
                  />
                  {decision.contradictions.length ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {decision.contradictions.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-[#F59E0B]/35 bg-[#fffbeb] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                                severityTone(item.severity),
                              )}
                            >
                              {item.severity}
                            </span>
                            <h4 className="font-semibold text-[#0D1B2A]">{item.title}</h4>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/72">
                            {item.explanation}
                          </p>
                          <ul className="mt-3 space-y-1 rounded-2xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs text-[#0D1B2A]/70">
                            {item.evidence.map((line) => (
                              <li key={line}>- {line}</li>
                            ))}
                          </ul>
                          <p className="mt-3 text-xs font-semibold text-[#92400E]">
                            Next action: {item.nextAction}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 text-sm leading-6 text-[#0D1B2A]/72">
                      No direct contradictions were detected in the currently available structured
                      evidence.
                      <span className="mt-1 block text-xs text-[#64748B]">
                        Missing evidence is not proof that no conflict exists.
                      </span>
                    </div>
                  )}
                </section>

                <section className="rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
                  <ReportSectionTitle
                    eyebrow="Immediate next actions"
                    title="Move the report forward"
                  />
                  {decision.immediateActions.length ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      {decision.immediateActions.map((action, index) => (
                        <button
                          key={`${index}-${action.label}`}
                          type="button"
                          onClick={() => onSelectView?.(routeTabFor(action.tab))}
                          className="report-no-print rounded-2xl border border-[#FF6A00]/20 bg-white p-3 text-left text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/45 hover:bg-[#fffaf2]"
                        >
                          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
                            Action {index + 1}
                          </span>
                          <span className="mt-1 flex items-center justify-between gap-2">
                            {action.label}
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl border border-[#FF6A00]/20 bg-white px-3 py-2 text-sm text-[#0D1B2A]/66">
                      No immediate action is generated from the current structured evidence.
                    </p>
                  )}
                </section>

                <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
                  <ReportSectionTitle eyebrow="Decision Matrix" title="Key questions and answers" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {decision.matrix.map((row) => (
                      <DecisionMatrixCard key={row.id} row={row} />
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
                  <ReportSectionTitle
                    eyebrow="Evidence Timeline"
                    title="Saved evidence chronology"
                  />
                  <ol className="mt-4 space-y-3">
                    {decision.timeline.map((item) => (
                      <EvidenceTimelineRow key={item.id} item={item} />
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </section>

          <ReportGroupHeading
            letter="E"
            anchorId="report-group-next"
            title="What happens next"
            intro="Open uncertainties, the due-diligence plan and every source behind this report."
          />

          {/* RISK REGISTER */}
          <section
            id="report-risk"
            className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 scroll-mt-24"
          >
            <ReportSectionTitle
              eyebrow="Risk & Actions"
              title="Evidence gaps and open uncertainties"
            />
            {report.risks.length === 0 ? (
              <p className="mt-3 text-sm text-[#0D1B2A]/70">
                No blocking risks identified in current evidence. Continue to verify sources.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {report.risks.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                          r.severity === "high"
                            ? "bg-[#dc2626] text-white"
                            : r.severity === "medium"
                              ? "bg-[#F59E0B] text-[#0D1B2A]"
                              : "bg-[#D9E6F2] text-[#0D1B2A]",
                        )}
                      >
                        {r.severity}
                      </span>
                      <span className="font-semibold text-[#0D1B2A]">{r.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/70">{r.why}</p>
                    <p className="mt-1 text-[11px] text-[#64748B]">Evidence: {r.evidence}</p>
                    <button
                      type="button"
                      onClick={() => onSelectView?.(routeTabFor(r.actionTab))}
                      className="report-no-print mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
                    >
                      {r.nextAction} <ArrowRight className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 border-t border-[#0D1B2A]/10 pt-4">
              <ReportSectionTitle
                eyebrow="Due diligence plan"
                title="Open actions ranked by priority"
              />
              <ReportActionPlan
                actions={reportDoc.actions.filter((action) => action.status !== "completed")}
                onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
              />
            </div>
          </section>

          {/* EVIDENCE & DOCUMENTS APPENDIX */}
          <ReportEvidenceAppendix
            anchorId="report-documents"
            rows={appendixRows}
            completenessPercent={report.documents.completenessPercent}
            onOpenAsset={(assetId) => {
              const asset = fileVault.assets.find((file) => file.id === assetId);
              if (asset) void openVaultAsset(asset);
            }}
          />

          {/* CHANGE TRACKING — a secondary supporting section, never part of the opening */}
          <ReportChangeTrackingSection
            comparison={snapshotComparison}
            snapshots={reportSnapshots}
            message={snapshotMessage}
            clearRequested={clearSnapshotsRequested}
            onSave={handleSaveReportSnapshot}
            onRequestClear={() => setClearSnapshotsRequested(true)}
            onCancelClear={() => setClearSnapshotsRequested(false)}
            onConfirmClear={handleClearReportSnapshots}
          />

          <section className="report-section report-no-print mt-1 rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
              Take action on this erf
            </div>
            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-[#0D1B2A]">
                  Assemble a local property team
                </h4>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
                  Find relevant local professionals and services based on this erf's location and
                  property context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectView?.("local-services")}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
              >
                Find Local Property Team <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </>
      ),
    };

    return (
      <div
        className={cn("report-page space-y-5", printOnly && "report-print-document")}
        aria-label={printOnly ? "Printable Easy Erf Report" : undefined}
      >
        <ReportOpening
          doc={reportDoc}
          printOnly={printOnly}
          onPrint={handlePrint}
          onOpenTab={(tab) => onSelectView?.(routeTabFor(tab))}
          heroSlot={selectedDesign ? <SignedAssetPreview asset={selectedDesign} /> : undefined}
          heroCaption={
            selectedDesign
              ? "AI-generated concept visualisation saved to this erf. It is an interpretation, not a photograph or approved plan."
              : null
          }
          modeSlot={<ReportViewSelector mode={decisionMode} onChange={updateDecisionMode} />}
          askSlot={
            <AskEasyErfPanel
              suggestionPayload={askSuggestionPayload}
              evidencePack={report.evidencePack ?? null}
              decisionMode={decisionMode}
              onSelectView={onSelectView}
            />
          }
        />

        {/* STICKY REPORT NAV — five primary destinations, ordered by the decision lens */}
        <nav className="report-nav-sticky report-no-print sticky top-16 z-10 -mx-2 flex items-center gap-2 overflow-x-auto rounded-full border border-[#0D1B2A]/10 bg-white/95 px-2 py-2 backdrop-blur">
          <ul className="flex min-w-max gap-1 text-xs">
            {composition.destinations.map((destination) => (
              <li key={destination.id}>
                <a
                  href={`#${destination.anchorId}`}
                  className="inline-flex items-center rounded-full px-3 py-1.5 font-semibold text-[#0D1B2A]/75 hover:bg-[#F7FBFF] hover:text-[#0D1B2A]"
                >
                  {destination.label}
                </a>
              </li>
            ))}
          </ul>
          <ReportViewSelector mode={decisionMode} onChange={updateDecisionMode} compact />
        </nav>

        {composition.groupOrder.map((groupId) => (
          <Fragment key={groupId}>{groupNodes[groupId]}</Fragment>
        ))}
      </div>
    );
  };

  return (
    <>
      {reportDocument()}
      {printFrame?.contentDocument?.getElementById(REPORT_PRINT_ROOT_ID)
        ? createPortal(
            reportDocument(true),
            printFrame.contentDocument.getElementById(REPORT_PRINT_ROOT_ID) as HTMLElement,
          )
        : null}
    </>
  );
}

function ReportGroupHeading({
  letter,
  anchorId,
  title,
  intro,
}: {
  letter: string;
  anchorId?: string;
  title: string;
  intro: string;
}) {
  return (
    <div
      id={anchorId}
      className="report-group-heading scroll-mt-24 mt-8 flex items-start gap-3 border-t border-[#0D1B2A]/10 pt-6 first:mt-0"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-[11px] font-bold text-white">
        {letter}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-[#0D1B2A]">{title}</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">{intro}</p>
      </div>
    </div>
  );
}

function InvestorDecisionBrief({
  data,
  onSelectView,
}: {
  data: InvestorDecisionMode;
  onSelectView?: (view: DossierView) => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <section className="report-investor-brief rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#0D1B2A] p-5 text-white">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              Investor Decision Brief
            </div>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight">{data.readinessStatus}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
              {data.readinessExplanation}
            </p>
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs leading-5 text-white/62">
              Investor Mode is a presentation lens over saved evidence and user-entered assumptions.
              It does not create a valuation, forecast, offer recommendation, or purchase advice.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              Next investor action
            </div>
            <h4 className="mt-2 text-lg font-semibold">{data.primaryAction.label}</h4>
            <p className="mt-2 text-sm leading-6 text-white/68">{data.primaryAction.body}</p>
            {data.primaryAction.tab && (
              <button
                type="button"
                onClick={() => onSelectView?.(routeTabForInvestor(data.primaryAction.tab))}
                className="report-no-print mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff7a1a]"
              >
                Open next step <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InvestorStatusCard title="Evidence strength" value={data.evidenceStrength} />
        <InvestorStatusCard title="Acquisition price" value={data.acquisitionPriceStatus} />
        <InvestorStatusCard title="Market evidence" value={data.marketEvidenceStatus} />
        <InvestorStatusCard title="Chosen strategy" value={data.chosenStrategyStatus} />
        <InvestorStatusCard title="Strategy calculations" value={data.calculationStatus} />
      </section>

      <section className="rounded-[1.5rem] border border-[#D9E6F2] bg-[#F7FBFF] p-5">
        <ReportSectionTitle
          eyebrow="Investor Numbers"
          title="Real inputs and deterministic outputs"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.numberRows.map((row) => (
            <InvestorNumberCard key={row.id} row={row} />
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#64748B]">
          Projected rows come from user assumptions and deterministic calculators. Missing values
          are shown as not provided or not calculated.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <InvestorListPanel
          title="Evidence supporting the case"
          items={data.supportingEvidence}
          empty="No case-supporting evidence is strong enough to list yet."
        />
        <InvestorListPanel
          title="Evidence weakening the case"
          items={data.weakeningEvidence}
          empty="No weakening evidence is recorded yet."
        />
        <InvestorListPanel
          title="Assumptions the case depends on"
          items={data.assumptions}
          empty="No strategy assumptions are available yet."
        />
        <InvestorListPanel
          title="Missing information that could change the decision"
          items={data.missingInputs}
          empty="No investor-specific missing information was generated."
        />
      </section>

      <section className="rounded-[1.5rem] border border-[#F59E0B]/35 bg-[#FFFBEB] p-5">
        <ReportSectionTitle
          eyebrow="Downside View"
          title="Issues that could weaken the investor case"
        />
        {data.downsideRisks.length ? (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {data.downsideRisks.map((risk) => (
              <li
                key={risk}
                className="rounded-2xl border border-[#F59E0B]/25 bg-white px-4 py-3 text-sm leading-6 text-[#0D1B2A]/74"
              >
                {risk}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-[#F59E0B]/20 bg-white px-4 py-3 text-sm text-[#0D1B2A]/66">
            No investor-specific downside issue is currently supported by the saved evidence.
          </p>
        )}
      </section>

      {data.nextActions.length > 0 && (
        <section className="rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
          <ReportSectionTitle
            eyebrow="Additional next actions"
            title="Keep the investor case grounded"
          />
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.nextActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => action.tab && onSelectView?.(routeTabForInvestor(action.tab))}
                className="report-no-print rounded-2xl border border-[#FF6A00]/20 bg-white p-3 text-left text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/45 hover:bg-[#fffaf2]"
              >
                <span className="flex items-center justify-between gap-2">
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-[#0D1B2A]/62">
                  {action.body}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InvestorStatusCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-[1.25rem] border border-[#D9E6F2] bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        {title}
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#0D1B2A]">{value}</p>
    </article>
  );
}

function InvestorNumberCard({ row }: { row: InvestorNumberRow }) {
  return (
    <article className="rounded-2xl border border-[#D9E6F2] bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        {row.label}
      </div>
      <p
        className={cn(
          "mt-2 text-lg font-semibold",
          row.state === "available" ? "text-[#0D1B2A]" : "text-[#0D1B2A]/48",
        )}
      >
        {row.value}
      </p>
      <EvidenceBadgeChip
        badge={
          row.provenance === "User assumption"
            ? "assumption"
            : row.provenance === "Saved subject listing" ||
                row.provenance === "Saved market evidence"
              ? "listing"
              : "user_confirmed"
        }
        label={row.provenance}
      />
    </article>
  );
}

function InvestorListPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
      <h4 className="text-base font-semibold text-[#0D1B2A]">{title}</h4>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[#0D1B2A]/72">
          {items.map((item) => (
            <li key={item} className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-sm text-[#0D1B2A]/58">
          {empty}
        </p>
      )}
    </section>
  );
}

function routeTabForInvestor(tab?: string): DossierView {
  switch (tab) {
    case "research":
      return "research";
    case "reports":
      return "reports";
    case "listings":
      return "listings";
    case "calculators":
      return "calculators";
    case "site-potential":
      return "site-potential";
    case "stoep-report":
      return "stoep-report";
    default:
      return "overview";
  }
}

function ReportSectionTitle({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
      {intro && <p className="mt-2 max-w-3xl text-xs leading-5 text-[#64748B]">{intro}</p>}
    </div>
  );
}

function ReportChangeTrackingSection({
  comparison,
  snapshots,
  message,
  clearRequested,
  onSave,
  onRequestClear,
  onCancelClear,
  onConfirmClear,
}: {
  comparison: ReturnType<typeof compareReportSnapshots>;
  snapshots: ReportSnapshot[];
  message: string | null;
  clearRequested: boolean;
  onSave: () => void;
  onRequestClear: () => void;
  onCancelClear: () => void;
  onConfirmClear: () => void;
}) {
  const hasPrevious = Boolean(comparison.previous);
  const hasChanges = comparison.changes.length > 0;
  const canSave = !comparison.isDuplicate;
  const grouped: Record<ReportSnapshotChangeType, ReportSnapshotChange[]> = {
    added: comparison.changes.filter((change) => change.type === "added"),
    resolved: comparison.changes.filter((change) => change.type === "resolved"),
    changed: comparison.changes.filter((change) => change.type === "changed"),
    removed: comparison.changes.filter((change) => change.type === "removed"),
  };

  return (
    <section
      id="report-change-tracking"
      className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.32)] scroll-mt-24"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ReportSectionTitle
          eyebrow="Report changes"
          title="What changed since the previous report"
        />
        <div className="report-no-print flex flex-wrap gap-2">
          {canSave && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff7a1a]"
            >
              <Save className="h-3.5 w-3.5" />
              Save current report snapshot
            </button>
          )}
          {snapshots.length > 0 && (
            <button
              type="button"
              onClick={onRequestClear}
              className="inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
            >
              Clear snapshot history
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#0D1B2A]/68">
        Changes are calculated from saved Easy Erf report snapshots on this device. They do not
        represent official registry notifications or automatic monitoring of external sources.
      </p>

      {message && (
        <div className="report-no-print mt-4 rounded-2xl border border-[#16A34A]/20 bg-[#ECFDF5] px-4 py-3 text-sm font-semibold text-[#166534]">
          {message}
        </div>
      )}

      {!hasPrevious ? (
        <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
          <p className="text-sm font-semibold text-[#0D1B2A]">
            No previous report snapshot has been saved for this property.
          </p>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/68">
            Save the current report to establish a baseline for future comparisons.
          </p>
        </div>
      ) : !hasChanges ? (
        <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
          <p className="text-sm font-semibold text-[#0D1B2A]">
            No meaningful changes were detected since the previous saved report.
          </p>
          <dl className="mt-3 grid gap-2 text-xs text-[#0D1B2A]/70 sm:grid-cols-2">
            <SnapshotDateRow label="Previous snapshot" value={comparison.previous?.savedAt} />
            <SnapshotDateRow label="Current report" value={comparison.current.reportGeneratedAt} />
          </dl>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {(["added", "resolved", "changed", "removed"] as const).map((type) => (
              <div
                key={type}
                className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3 text-center"
              >
                <div className="text-2xl font-semibold text-[#0D1B2A]">
                  {comparison.counts[type]}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {changeGroupLabel(type)}
                </div>
              </div>
            ))}
          </div>
          {(["added", "resolved", "changed", "removed"] as const).map(
            (type) =>
              grouped[type].length > 0 && (
                <div key={type}>
                  <h4 className="text-sm font-semibold text-[#0D1B2A]">{changeGroupLabel(type)}</h4>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {grouped[type].map((change) => (
                      <ChangeCard key={change.id} change={change} />
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="mt-4 border-t border-[#D9E6F2] pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            Previous snapshot date
          </p>
          <p className="mt-1 text-sm font-semibold text-[#0D1B2A]">
            {formatSnapshotDate(snapshots[0]?.savedAt)}
          </p>
          <details className="report-no-print mt-3 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#0D1B2A]">
              View recent snapshot history
            </summary>
            <ol className="mt-3 space-y-1 text-sm text-[#0D1B2A]/70">
              {snapshots.slice(0, 5).map((snapshot) => (
                <li key={`${snapshot.savedAt}-${snapshot.parcelId}`}>
                  {formatSnapshotDate(snapshot.savedAt)}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {clearRequested && (
        <div className="report-no-print mt-4 rounded-2xl border border-[#F59E0B]/35 bg-[#FFFBEB] p-4">
          <p className="text-sm font-semibold text-[#0D1B2A]">
            Clear saved report snapshots for this property?
          </p>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">
            This only clears browser snapshot history for this parcel on this device. It does not
            delete evidence, files, or official source reviews.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmClear}
              className="rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white"
            >
              Yes, clear history
            </button>
            <button
              type="button"
              onClick={onCancelClear}
              className="rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SnapshotDateRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-[#D9E6F2] bg-white px-3 py-2">
      <dt className="font-semibold text-[#64748B]">{label}</dt>
      <dd className="mt-1 text-[#0D1B2A]">{formatSnapshotDate(value)}</dd>
    </div>
  );
}

function ChangeCard({ change }: { change: ReportSnapshotChange }) {
  return (
    <article className="report-change-card rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
            changeTone(change.type),
          )}
        >
          {change.type}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
          {change.category}
        </span>
      </div>
      <h5 className="mt-2 text-sm font-semibold text-[#0D1B2A]">{change.label}</h5>
      {(change.previousValue || change.currentValue) && (
        <dl className="mt-2 grid gap-2 text-xs text-[#0D1B2A]/70 sm:grid-cols-2">
          {change.previousValue && (
            <div>
              <dt className="font-semibold text-[#64748B]">Previous</dt>
              <dd>{change.previousValue}</dd>
            </div>
          )}
          {change.currentValue && (
            <div>
              <dt className="font-semibold text-[#64748B]">Current</dt>
              <dd>{change.currentValue}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}

function changeGroupLabel(type: ReportSnapshotChangeType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function changeTone(type: ReportSnapshotChangeType) {
  switch (type) {
    case "added":
      return "bg-[#ECFDF5] text-[#166534]";
    case "resolved":
      return "bg-[#EFF6FF] text-[#1D4ED8]";
    case "removed":
      return "bg-[#FEF2F2] text-[#991B1B]";
    default:
      return "bg-[#FFF7ED] text-[#B24A00]";
  }
}

function formatSnapshotDate(value?: string | null) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}


function decisionVerdictLabel(verdict: DecisionVerdict) {
  switch (verdict) {
    case "proceed":
      return "Proceed";
    case "proceed_with_conditions":
      return "Proceed with conditions";
    case "investigate_further":
      return "Investigate further";
    case "high_risk":
      return "High risk";
  }
}

function severityTone(severity: "low" | "medium" | "high") {
  return severity === "high"
    ? "bg-[#dc2626] text-white"
    : severity === "medium"
      ? "bg-[#F59E0B] text-[#0D1B2A]"
      : "bg-[#D9E6F2] text-[#0D1B2A]";
}

function matrixAnswerLabel(answer: DecisionMatrixRow["answer"]) {
  switch (answer) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "conditional":
      return "Conditional";
    case "unknown":
      return "Unknown";
  }
}

function matrixAnswerTone(answer: DecisionMatrixRow["answer"]) {
  switch (answer) {
    case "yes":
      return "bg-[#dcfce7] text-[#166534]";
    case "no":
      return "bg-[#fee2e2] text-[#991b1b]";
    case "conditional":
      return "bg-[#fffbeb] text-[#92400E]";
    case "unknown":
      return "bg-[#D9E6F2] text-[#0D1B2A]";
  }
}

function DecisionListPanel({
  title,
  items,
  empty,
  footnote,
}: {
  title: string;
  items: string[];
  empty: string;
  footnote?: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#D9E6F2] bg-white p-5">
      <h3 className="text-base font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[#0D1B2A]/72">
          {items.map((item) => (
            <li key={item} className="rounded-2xl bg-[#F7FBFF] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-sm text-[#0D1B2A]/60">
          {empty}
        </p>
      )}
      {footnote && <p className="mt-3 text-xs text-[#64748B]">{footnote}</p>}
    </section>
  );
}

function DecisionMatrixCard({ row }: { row: DecisionMatrixRow }) {
  return (
    <article className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#0D1B2A]">{row.question}</h4>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
            matrixAnswerTone(row.answer),
          )}
        >
          {matrixAnswerLabel(row.answer)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/66">{row.explanation}</p>
    </article>
  );
}

function EvidenceTimelineRow({ item }: { item: EvidenceTimelineItem }) {
  return (
    <li className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time className="text-xs font-semibold text-[#0D1B2A]">
          {new Date(item.occurredAt).toLocaleDateString()}
        </time>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
          {item.source}
        </span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-[#0D1B2A]">{item.label}</h4>
      <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">{item.detail}</p>
    </li>
  );
}

/*
 * Ownership rows, evidence badges, id rows and the per-asset extraction chip
 * now live in ./dossier/ReportEvidenceUi so their rendered output can be
 * asserted in behavioural tests.
 */

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
