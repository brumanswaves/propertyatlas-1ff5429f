/**
 * Large report body sections: Market Evidence, Strategy & Financials,
 * Site Potential and the Evidence & Documents appendix.
 *
 * Presentation only. Every value is decided upstream in the report/evidence
 * layer; nothing here invents, upgrades or hides a state.
 */
import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportSectionTitleBlock } from "./ReportEvidenceUi";
import type { MarketFigureKind, MarketSectionModel } from "@/lib/reports/marketSection";
import {
  STRATEGY_FIGURE_LABEL,
  type StrategyFigure,
  type StrategySectionModel,
} from "@/lib/reports/strategySection";
import { APPENDIX_SCOPE_LABEL, type EvidenceAppendixRow } from "@/lib/reports/evidenceAppendix";

const FIGURE_KIND_LABEL: Record<MarketFigureKind, string> = {
  evidence_input: "Evidence input",
  user_assumption: "User assumption",
  calculation: "Deterministic calculation",
  ai_interpretation: "AI interpretation",
};

const FIGURE_KIND_TONE: Record<MarketFigureKind, string> = {
  evidence_input: "bg-[#0F766E] text-white",
  user_assumption: "bg-[#F59E0B] text-[#0D1B2A]",
  calculation: "bg-[#0D1B2A] text-white",
  ai_interpretation: "bg-[#7C3AED] text-white",
};

function FigureKindChip({ kind }: { kind: MarketFigureKind }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
        FIGURE_KIND_TONE[kind],
      )}
    >
      {FIGURE_KIND_LABEL[kind]}
    </span>
  );
}

function sectionShell(extra?: string) {
  return cn(
    "report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6 scroll-mt-24",
    extra,
  );
}

/* ------------------------------------------------------------------ market */

export function ReportMarketSection({
  anchorId,
  model,
  onOpenMarket,
}: {
  anchorId: string;
  model: MarketSectionModel;
  onOpenMarket?: () => void;
}) {
  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock
        eyebrow="Market Evidence"
        title={
          model.strength === "none"
            ? "No market evidence saved for this erf"
            : "What the market evidence actually supports"
        }
      />
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">{model.strengthNote}</p>

      {model.figures.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {model.figures.map((figure) => (
            <article
              key={figure.id}
              data-market-figure={figure.id}
              className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-5"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                {figure.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                {figure.value}
              </div>
              <div className="mt-3">
                <FigureKindChip kind={figure.kind} />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#64748B]">{figure.provenance}</p>
              {figure.caveat && (
                <p className="mt-1 text-[11px] leading-5 text-[#94A3B8]">{figure.caveat}</p>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Subject listing
          </div>
          {model.subjectListing ? (
            <>
              <p className="mt-2 text-sm font-semibold text-[#0D1B2A]">
                {model.subjectListing.title || model.subjectListing.sourceUrl}
              </p>
              <p className="mt-1 text-xs text-[#0D1B2A]/70">
                {model.subjectListingStatus}
                {model.subjectListingAge ? ` · ${model.subjectListingAge}` : ""}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[#94A3B8]">
                Listing evidence reflects the asking market. It is never treated as a sold price or
                a formal valuation.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">
              No subject listing has been attached to this erf.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Asking versus sold
          </div>
          <dl className="mt-3 space-y-2 text-sm text-[#0D1B2A]/80">
            <div className="flex items-center justify-between gap-3">
              <dt>Asking-price evidence</dt>
              <dd className="font-semibold tabular-nums text-[#0D1B2A]">{model.askingCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Sold evidence</dt>
              <dd className="font-semibold tabular-nums text-[#0D1B2A]">{model.soldCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      {model.comparables.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Strongest comparable evidence
          </div>
          <ul className="mt-3 space-y-2">
            {model.comparables.map((comp) => (
              <li
                key={comp.id}
                data-comparable={comp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <div className="text-sm font-semibold text-[#0D1B2A]">{comp.title}</div>
                  <div className="mt-1 text-[11px] text-[#64748B]">
                    {comp.relationshipLabel} · {comp.evidenceType} · {comp.confidenceLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold tabular-nums text-[#0D1B2A]">
                    {comp.priceLabel ?? "Price not captured"}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {comp.sizeLabel ?? "Size not captured"}
                  </div>
                </div>
                {comp.url && (
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noreferrer"
                    className="report-no-print inline-flex items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 py-1 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
                  >
                    Open source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-5 text-[#94A3B8]">
            Asking evidence is never presented as a completed sale. Sold evidence is only shown when
            a source states it.
          </p>
        </div>
      )}

      {model.gaps.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Missing market evidence
          </div>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-[#0D1B2A]/75">
            {model.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {model.nextStep && (
        <button
          type="button"
          onClick={onOpenMarket}
          className="report-no-print mt-5 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
        >
          {model.nextStep} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- strategy */

function StrategyTile({ figure, large }: { figure: StrategyFigure; large?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        {figure.label}
      </div>
      <div
        className={cn(
          "mt-2 font-semibold tracking-tight text-[#0D1B2A]",
          large ? "text-2xl" : "text-base",
        )}
      >
        {figure.value}
      </div>
      <span
        className={cn(
          "mt-3 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
          FIGURE_KIND_TONE[figure.kind],
        )}
      >
        {STRATEGY_FIGURE_LABEL[figure.kind]}
      </span>
    </div>
  );
}

export function ReportStrategySection({
  anchorId,
  model,
  onOpenStrategy,
}: {
  anchorId: string;
  model: StrategySectionModel;
  onOpenStrategy?: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const deeper = [...model.assumptions, ...model.detail];

  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock
        eyebrow="Strategy & Financials"
        title={model.strategyName ?? "No strategy scenario chosen yet"}
      />
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">
        Strategy figures come from your saved Strategy Lab scenario exactly as calculated there.
        They are assumptions and deterministic calculations, never valuations or feasibility
        approvals.
      </p>

      {model.hasScenario ? (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#B24A00]">
            {model.savedStatus}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {model.acquisition && <StrategyTile figure={model.acquisition} large />}
            {model.maximumJustifiedPrice && (
              <StrategyTile figure={model.maximumJustifiedPrice} large />
            )}
          </div>
          {model.headline.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {model.headline.map((figure) => (
                <StrategyTile key={figure.id} figure={figure} />
              ))}
            </div>
          )}
          {deeper.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowDetail((value) => !value)}
                className="report-no-print inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
              >
                {showDetail
                  ? "Hide saved assumptions"
                  : `Show ${deeper.length} saved assumption(s) and outputs`}
              </button>
              <div
                className={cn(
                  "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
                  !showDetail && "hidden report-print-show",
                )}
              >
                {deeper.map((figure) => (
                  <StrategyTile key={figure.id} figure={figure} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
          <p className="text-sm leading-6 text-[#0D1B2A]/75">{model.emptyMessage}</p>
          <button
            type="button"
            onClick={onOpenStrategy}
            className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Open Strategy <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-[#64748B]">
        {model.scenarioCount} saved scenario{model.scenarioCount === 1 ? "" : "s"} in the Strategy
        workspace.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------- site potential */

export const SITE_POTENTIAL_CONCEPT_LABEL =
  "Conceptual opportunity only — not proof of planning approval, legal buildability or approved building plans.";

export function ReportSitePotentialSection({
  anchorId,
  hasConcept,
  skipped,
  conceptName,
  rationale,
  projectStatus,
  brief,
  conceptAssetId,
  disclaimer,
  visual,
  onOpenSitePotential,
  onOpenSourceFile,
}: {
  anchorId: string;
  hasConcept: boolean;
  skipped: boolean;
  conceptName: string | null;
  rationale: string | null;
  projectStatus: string | null;
  brief: string | null;
  conceptAssetId?: string | null;
  disclaimer: string;
  visual?: React.ReactNode;
  onOpenSitePotential?: () => void;
  onOpenSourceFile?: () => void;
}) {
  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock
        eyebrow="Site Potential"
        title={hasConcept ? conceptName || "Selected property concept" : "No concept selected yet"}
      />
      {hasConcept ? (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="overflow-hidden rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F7FBFF]">
              {visual}
            </div>
            <div className="rounded-[1.25rem] border border-[#D9E6F2] bg-[#F7FBFF] p-5">
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                    Project status
                  </dt>
                  <dd className="mt-1 text-[#0D1B2A]/85">
                    {projectStatus ?? "Status not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                    Rationale
                  </dt>
                  <dd className="mt-1 text-[#0D1B2A]/85">
                    {rationale ?? "No rationale saved for this concept."}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                    Brief summary
                  </dt>
                  <dd className="mt-1 text-[#0D1B2A]/85">
                    {brief ?? "No design brief saved yet."}
                  </dd>
                </div>
                {conceptAssetId && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                      Stable asset ID
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-[#0D1B2A]/70">
                      {conceptAssetId}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="report-no-print mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenSitePotential}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
                >
                  Open Site Potential <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {onOpenSourceFile && (
                  <button
                    type="button"
                    onClick={onOpenSourceFile}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
                  >
                    Open source file <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-[#FF6A00]/25 bg-[#FFF7ED] px-4 py-3 text-xs leading-5 text-[#B24A00]">
            {SITE_POTENTIAL_CONCEPT_LABEL} {disclaimer}
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
          <p className="text-sm leading-6 text-[#0D1B2A]/75">
            {skipped
              ? "Site Potential has been skipped for this report."
              : "No Site Potential concept has been selected yet, so this section carries no visual."}
          </p>
          {!skipped && (
            <button
              type="button"
              onClick={onOpenSitePotential}
              className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
            >
              Open Site Potential <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- appendix */

const READ_STATE_TONE: Record<EvidenceAppendixRow["readState"], string> = {
  searchable_matched: "bg-[#DCFCE7] text-[#166534]",
  parent_plan_context: "bg-[#DBEAFE] text-[#1E40AF]",
  pending: "bg-[#E2E8F0] text-[#334155]",
  unreadable: "bg-[#FEF3C7] text-[#92400E]",
  wrong_property: "bg-[#FEE2E2] text-[#991B1B]",
  failed: "bg-[#FEF3C7] text-[#92400E]",
  reference_only: "bg-[#E2E8F0] text-[#334155]",
};

export function ReportEvidenceAppendix({
  anchorId,
  rows,
  completenessPercent,
  onOpenAsset,
}: {
  anchorId: string;
  rows: EvidenceAppendixRow[];
  completenessPercent: number;
  onOpenAsset?: (assetId: string) => void;
}) {
  return (
    <section id={anchorId} className={sectionShell("bg-[#F7FBFF]")}>
      <ReportSectionTitleBlock
        eyebrow="Evidence & Documents"
        title="Every source this report can see"
      />
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">
        Storing a file does not make it evidence. Each row states whether Easy Erf actually read the
        document and whether it matched this erf. Wrong-property and unreadable documents stay
        visible and stay excluded.
      </p>

      {rows.length ? (
        <ul className="mt-5 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              data-appendix-row={row.id}
              className="rounded-2xl border border-[#D9E6F2] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-[#0D1B2A]">{row.name}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#64748B]">
                    {row.category} · {row.providerType} · {APPENDIX_SCOPE_LABEL[row.scope]}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                    READ_STATE_TONE[row.readState],
                  )}
                >
                  {row.readLabel}
                </span>
              </div>
              {row.pageLocator && (
                <p className="mt-2 text-[11px] text-[#64748B]">{row.pageLocator}</p>
              )}
              {row.detail && (
                <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/70">{row.detail}</p>
              )}
              {row.assetId && onOpenAsset && (
                <button
                  type="button"
                  onClick={() => onOpenAsset(row.assetId as string)}
                  className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
                >
                  Open original <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {row.url && (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF]"
                >
                  Open original <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-[#D9E6F2] bg-white px-4 py-3 text-sm text-[#0D1B2A]/60">
          No documents or report-facing sources are attached to this erf yet.
        </p>
      )}

      <p className="mt-4 text-xs text-[#64748B]">Evidence completeness: {completenessPercent}%.</p>
    </section>
  );
}
