import { ExternalLink, FileText, ShieldCheck, Sparkles } from "lucide-react";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "@/lib/research/publicSourceRegistry";
import {
  RESEARCH_CATEGORY_LABELS,
  type ResearchSourceCategory,
  type ResearchSource,
} from "@/lib/research/sourceTypes";
import { cn } from "@/lib/utils";

interface Props {
  parcel: NormalizedOfficialParcel;
}

const CATEGORY_ORDER: ResearchSourceCategory[] = [
  "csg-sg-documents",
  "deeds-ownership",
  "municipal-valuation-rates",
  "zoning-land-use",
  "planning-notices",
  "environmental-heritage-risk",
  "listings-market-evidence",
  "neighbourhood-intelligence",
  "roads-access-infrastructure",
  "legal-entity-distress",
  "tenders-catalysts",
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

export function ErfResearchDossier({ parcel }: Props) {
  const completeness = dataCompleteness(parcel);
  const sources = buildPublicResearchSources(parcel);
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    sources: sources.filter((source) => source.category === category),
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
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FieldList
          title="Known public fields"
          rows={parcel.knownFields}
          empty="No public identity fields were recognized."
        />
        <MissingList fields={parcel.missingFields} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Public source checklist
        </div>
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.category}>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                {RESEARCH_CATEGORY_LABELS[group.category]}
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

      <PlaceholderGrid />
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
        {source.missingFields.length > 0 && (
          <span className="text-[10.5px] text-muted-foreground">
            Missing: {source.missingFields.join(", ")}
          </span>
        )}
      </div>
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

function PlaceholderGrid() {
  const items = [
    [
      "Paid reports",
      "Lightstone, WinDeed, deeds, valuation and comparables slots. Paid provider data not yet attached.",
    ],
    [
      "Notes and evidence",
      "Save notes, tags, links, listings, report interests and manual findings against this parcel id.",
    ],
    [
      "Calculators",
      "Transfer duty, bond, build, flip, yield and developer scenarios will use user-entered assumptions.",
    ],
    [
      "Sponsored / partner help",
      "Clearly labelled conveyancer, planner, architect, engineer and finance partner slots can live here later.",
    ],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {items.map(([title, body]) => (
        <div key={title} className="rounded-2xl border border-dashed border-border bg-card/70 p-4">
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h4>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </section>
  );
}
