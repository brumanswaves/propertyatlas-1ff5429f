import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookmarkCheck, ExternalLink, FileText, Save, ShieldCheck, Sparkles } from "lucide-react";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "@/lib/research/publicSourceRegistry";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import type { ResearchContext } from "@/lib/research/links";
import {
  RESEARCH_DOSSIER_GROUP_LABELS,
  type ResearchDossierGroup,
  type ResearchSource,
} from "@/lib/research/sourceTypes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SavedLinksManager } from "./SavedLinksManager";
import { NotesTab } from "./tabs/NotesTab";
import { ListingsTab } from "./tabs/ListingsTab";
import { ReportsTab } from "./tabs/ReportsTab";

interface Props {
  parcel: NormalizedOfficialParcel;
}

const DOSSIER_STATUSES = [
  { id: "not_started", label: "Not started" },
  { id: "researching", label: "Researching" },
  { id: "needs_paid_report", label: "Needs paid report" },
  { id: "watchlist", label: "Watchlist" },
  { id: "interested", label: "Interested" },
  { id: "passed", label: "Passed" },
] as const;

const DOSSIER_GROUP_ORDER: ResearchDossierGroup[] = [
  "official-parcel-identity",
  "municipal-evidence",
  "planning-zoning",
  "deeds-ownership",
  "market-intelligence",
  "building-improvement",
  "rental-tourism",
  "environmental-coastal-risk",
  "generated-searches",
  "user-workspace",
  "paid-reports",
];

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

function toResearchContext(parcel: NormalizedOfficialParcel): ResearchContext {
  return {
    area: parcel.suburbOrArea ?? undefined,
    town: parcel.town ?? parcel.suburbOrArea ?? undefined,
    suburb: parcel.suburbOrArea ?? undefined,
    municipality: parcel.municipality ?? undefined,
    province: parcel.province ?? undefined,
    erf: parcel.erfNumber != null ? String(parcel.erfNumber) : undefined,
    lng: parcel.coordinates?.lng,
    lat: parcel.coordinates?.lat,
  };
}

export function ErfResearchDossier({ parcel }: Props) {
  const completeness = dataCompleteness(parcel);
  const sources = buildPublicResearchSources(parcel);
  const researchCtx = useMemo(() => toResearchContext(parcel), [parcel]);
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
  const listingSources = sources.filter((source) => source.category === "listings-market-evidence");
  const grouped = DOSSIER_GROUP_ORDER.map((group) => ({
    group,
    sources: sources.filter((source) => source.dossierGroup === group),
  })).filter((group) => group.sources.length > 0);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="bg-gradient-brand p-4 text-white">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
              <ShieldCheck className="h-3 w-3" /> Official public parcel
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5">Public research dossier</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            {parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "Official erf"}
            {parcel.portion != null && String(parcel.portion) !== "0"
              ? ` / Portion ${parcel.portion}`
              : ""}
          </h3>
          <p className="mt-1 text-xs text-white/75">
            {parcel.suburbOrArea ?? parcel.municipality ?? parcel.province ?? "South Africa"}
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <InfoTile label="Source" value={parcel.sourceLabel} />
          <InfoTile label="Normalized parcel id" value={parcel.id} mono />
          <InfoTile
            label="Data completeness"
            value={`${completeness.score}%`}
            sub={`${completeness.known}/${completeness.total} public identity fields`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI research summary
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground">
          This dossier has public parcel identity fields from {parcel.sourceLabel}. Ownership,
          valuation, transfers, rates and paid provider data are not attached unless a verified
          source or paid report is added.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Next best checks: open the official source links, verify SG documents where available,
          search municipal valuation and zoning sources, save listing evidence manually, and attach
          paid reports if higher confidence is needed. External searches may return nearby or
          unrelated results and must be verified manually.
        </p>
        <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            PropertyAtlas organizes public and third-party property research links. It is not a
            deeds office, municipality, attorney, conveyancer, valuer, surveyor or financial
            advisor. Verify all information with the relevant official source before making
            decisions.
          </p>
          <p>
            Estimated values and historical municipal valuations are informational only and are not
            formal valuations.
          </p>
          <p>
            Some records require paid third-party reports from providers such as Lightstone,
            WinDeed, SearchWorks or DeedsWeb.
          </p>
          <p>
            Owner and deeds information may be restricted, paid, outdated or subject to lawful-use
            requirements.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FieldList
          title="Known public fields"
          rows={parcel.knownFields}
          empty="No public identity fields were recognized."
        />
        <MissingList fields={parcel.missingFields} />
      </section>

      <DossierStatusControl parcel={parcel} />

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<FileText className="h-3.5 w-3.5" />}>
          Public Source Library
        </SectionTitle>
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.group}>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                {RESEARCH_DOSSIER_GROUP_LABELS[group.group]}
              </h4>
              <div className="grid gap-2">
                {group.sources.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>User Workspace</SectionTitle>
        <div className="mt-3 space-y-5">
          <SavedLinksManager parcelId={parcel.id} />
          <NotesTab parcelId={parcel.id} showSourceBadge={false} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Listing Research</SectionTitle>
        <ListingSearchStrip sources={listingSources} />
        <div className="mt-4">
          <ListingsTab parcelId={parcel.id} ctx={researchCtx} showSourceBadge={false} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Calculators</SectionTitle>
        <OfficialCalculatorPanel />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Paid Reports</SectionTitle>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Paid provider data not yet attached.
        </p>
        <PaidReportSlots />
        <div className="mt-4">
          <ReportsTab parcelId={parcel.id} summary={summary} sgDoc={sgDoc} />
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card/70 p-4">
        <SectionTitle>Sponsored/Partner Next Steps</SectionTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["Conveyancer", "Bond originator", "Town planner", "Architect / engineer"].map(
            (label) => (
              <div key={label} className="rounded-xl border border-border bg-background p-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Partner slot
                </span>
                <div className="mt-2 text-[13px] font-semibold">{label}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Clearly labelled future partner placement. No sponsor recommendation is active
                  yet.
                </p>
              </div>
            ),
          )}
        </div>
      </section>
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
    <div className="min-w-0 rounded-xl border border-border bg-background px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn("mt-1 truncate text-[13px] font-semibold", mono && "font-mono text-[11px]")}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sub}</div>}
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
    <section className="rounded-2xl border border-border bg-card p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <dl className="mt-2 divide-y divide-border text-[12px]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd
                className="max-w-[60%] truncate text-right font-medium"
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
    <section className="rounded-2xl border border-border bg-card p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Missing or not attached
      </h4>
      <ul className="mt-2 grid gap-1.5 text-[12px] text-muted-foreground">
        {fields.map((field) => (
          <li key={field} className="rounded-lg bg-muted/40 px-2.5 py-1.5">
            {field}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function SourceCard({ source }: { source: ResearchSource }) {
  const disabled =
    !source.url || source.status === "unavailable" || source.status === "paid-report";
  return (
    <article className="rounded-xl border border-border bg-background p-3">
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
        <a
          href={source.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
        >
          {source.actionLabel} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

type DossierStatusId = (typeof DOSSIER_STATUSES)[number]["id"];

function DossierStatusControl({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DossierStatusId>("not_started");
  const [tagsText, setTagsText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!user) {
      setLoaded(true);
      return () => {
        alive = false;
      };
    }

    setLoaded(false);
    supabase
      .from("saved_properties")
      .select("research_status,tags")
      .eq("user_id", user.id)
      .eq("parcel_id", parcel.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast.error(error.message);
        }
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

    const { error } = await supabase.from("saved_properties").upsert(
      {
        user_id: user.id,
        parcel_id: parcel.id,
        research_status: status,
        status,
        tags,
      },
      { onConflict: "user_id,parcel_id" },
    );

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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

function ListingSearchStrip({ sources }: { sources: ResearchSource[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        These listing searches are unverified. Save only URLs you have manually checked against the
        erf, coordinates, agency details, or other evidence.
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const disabled = !source.url || source.status === "unavailable";
          return disabled ? (
            <span
              key={source.id}
              className="rounded-full border border-dashed border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
              title={
                source.missingFields.length > 0
                  ? `Missing: ${source.missingFields.join(", ")}`
                  : source.complianceNote
              }
            >
              {source.name}
            </span>
          ) : (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"
              title={source.complianceNote}
            >
              <ExternalLink className="h-3 w-3" />
              {source.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRand(value: number): string {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function OfficialCalculatorPanel() {
  const [purchasePrice, setPurchasePrice] = useState("");
  const [buildCost, setBuildCost] = useState("");
  const [holdingCost, setHoldingCost] = useState("");
  const [transferDuty, setTransferDuty] = useState("");
  const [resalePrice, setResalePrice] = useState("");
  const [targetProfit, setTargetProfit] = useState("");

  const purchase = toNumber(purchasePrice);
  const build = toNumber(buildCost);
  const holding = toNumber(holdingCost);
  const transfer = toNumber(transferDuty);
  const resale = toNumber(resalePrice);
  const profitTarget = toNumber(targetProfit);
  const landPlusBuild = purchase + build;
  const totalCost = landPlusBuild + holding + transfer;
  const flipProfit = resale - totalCost;
  const targetOffer =
    resale > 0 ? Math.max(0, resale - build - holding - transfer - profitTarget) : 0;

  const fields = [
    ["Purchase price", purchasePrice, setPurchasePrice],
    ["Build / improvement cost", buildCost, setBuildCost],
    ["Holding costs", holdingCost, setHoldingCost],
    ["Transfer duty estimate", transferDuty, setTransferDuty],
    ["Expected resale / exit price", resalePrice, setResalePrice],
    ["Target profit", targetProfit, setTargetProfit],
  ] as const;

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Estimates only. Enter your own assumptions; PropertyAtlas is not attaching official
        valuation, rates, transfer or paid provider data here.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(([label, value, setter]) => (
          <label key={label} className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setter(event.target.value)}
              placeholder="R 0"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ResultTile label="Total land/build/holding" value={formatRand(totalCost)} />
        <ResultTile label="Estimated flip profit" value={formatRand(flipProfit)} />
        <ResultTile label="Target offer price" value={formatRand(targetOffer)} />
      </div>
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

function PaidReportSlots() {
  const slots = [
    "Lightstone",
    "WinDeed",
    "Deeds/ownership report",
    "Valuation report",
    "Comparable sales report",
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {slots.map((slot) => (
        <div key={slot} className="rounded-xl border border-border bg-background p-3">
          <div className="text-[13px] font-semibold">{slot}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Paid provider data not yet attached.
          </p>
        </div>
      ))}
    </div>
  );
}
