/**
 * Site & environmental risk, municipal services & ownership costs, location &
 * lifestyle, and SG diagrams & lineage sections.
 *
 * Presentation only. Unknown values render as an explicit missing state with a
 * next action — never as a clearance, a zero amount or an invented figure.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportSectionTitleBlock } from "./ReportEvidenceUi";
import {
  CONTEXT_SOURCE_LABEL,
  type ContextFact,
  type ContextSectionModel,
  type MunicipalSectionModel,
} from "@/lib/reports/contextSections";
import type { SgEvidenceBlock, SgSectionModel } from "@/lib/reports/sgSection";
import type { StillToVerifySummary } from "@/lib/reports/contextSections";
import { createErfAssetPreviewSignedUrl } from "@/lib/workbench/erfFileVault";

function sectionShell(extra?: string) {
  return cn(
    "report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6 scroll-mt-24",
    extra,
  );
}

function FactRow({ fact }: { fact: ContextFact }) {
  const known = fact.value !== null;
  return (
    <div
      data-context-fact={fact.id}
      className={cn(
        "rounded-2xl border p-4",
        known ? "border-[#D9E6F2] bg-[#F7FBFF]" : "border-[#0D1B2A]/10 bg-white",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        {fact.label}
      </div>
      <div
        className={cn("mt-2 text-sm font-semibold", known ? "text-[#0D1B2A]" : "text-[#0D1B2A]/45")}
      >
        {known ? fact.value : "Not established"}
      </div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
        {CONTEXT_SOURCE_LABEL[fact.source]}
      </div>
      <p className="mt-1 text-[11px] leading-5 text-[#64748B]">{fact.provenance}</p>
      {fact.caveat && <p className="mt-1 text-[11px] leading-5 text-[#94A3B8]">{fact.caveat}</p>}
    </div>
  );
}

export function ReportContextSection({
  anchorId,
  eyebrow,
  title,
  model,
  onOpenTab,
  children,
}: {
  anchorId: string;
  eyebrow: string;
  title: string;
  model: ContextSectionModel;
  onOpenTab?: (tab: string | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock eyebrow={eyebrow} title={title} />
      <div className="mt-4 rounded-2xl border border-[#0D1B2A]/10 bg-[#0D1B2A] p-5 text-white">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
          What the evidence supports
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">{model.headline}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{model.headlineDetail}</p>
      </div>

      {children}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {model.facts.map((fact) => (
          <FactRow key={fact.id} fact={fact} />
        ))}
      </div>

      {model.missingChecks.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#92400E]">
            Outstanding checks
          </div>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#0D1B2A]/80">
            {model.missingChecks.map((check) => (
              <li key={check.id}>
                <span className="font-semibold text-[#0D1B2A]">{check.label}</span> — {check.action}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-[#94A3B8]">{model.note}</p>

      {model.nextStep && (
        <button
          type="button"
          onClick={() => onOpenTab?.(model.nextStepTab)}
          className="report-no-print mt-4 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
        >
          {model.nextStep} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

export function ReportMunicipalSection({
  anchorId,
  model,
  onOpenTab,
}: {
  anchorId: string;
  model: MunicipalSectionModel;
  onOpenTab?: (tab: string | null) => void;
}) {
  return (
    <ReportContextSection
      anchorId={anchorId}
      eyebrow="Municipal Services & Ownership Costs"
      title="What it actually costs to hold this erf"
      model={model}
      onOpenTab={onOpenTab}
    >
      <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
          Estimated monthly ownership cost
        </div>
        {model.monthlyEstimate ? (
          <>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              {model.monthlyEstimate.value}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#64748B]">
              {model.monthlyEstimate.basis}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">
            No monthly ownership cost can be shown. No document states a monthly rates, levy or
            service amount for this erf, and Easy Erf will not estimate one.
          </p>
        )}
      </div>
    </ReportContextSection>
  );
}

export function registerSgPreviewSettlement(
  onPreviewSettlement: ((settlement: Promise<void>) => void) | undefined,
  settlement: Promise<void>,
) {
  onPreviewSettlement?.(settlement);
}

function SgPreview({
  block,
  onPreviewSettlement,
}: {
  block: SgEvidenceBlock;
  onPreviewSettlement?: (settlement: Promise<void>) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const settleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    const settlement = new Promise<void>((resolve) => {
      settleRef.current = resolve;
    });
    registerSgPreviewSettlement(onPreviewSettlement, settlement);
    void createErfAssetPreviewSignedUrl(block.asset).then((signedUrl) => {
      if (!alive) return;
      if (signedUrl) setUrl(signedUrl);
      else {
        setFailed(true);
        settleRef.current?.();
      }
    });
    return () => {
      alive = false;
      settleRef.current?.();
      settleRef.current = null;
    };
  }, [block.asset, onPreviewSettlement]);

  if (!url || failed) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-[#F8FAFC] px-4 text-center text-xs font-semibold text-[#64748B]">
        {url ? "Diagram preview unavailable" : "No visual preview was generated for this diagram."}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`${block.asset.original_file_name} visual preview`}
      className="max-h-[28rem] w-full rounded-2xl border border-[#D9E6F2] bg-white object-contain"
      onLoad={() => settleRef.current?.()}
      onError={() => {
        setFailed(true);
        settleRef.current?.();
      }}
    />
  );
}

export function ReportSgLineageSection({
  anchorId,
  model,
  onOpenAsset,
  onOpenTab,
  onPreviewSettlement,
}: {
  anchorId: string;
  model: SgSectionModel;
  onOpenAsset?: (assetId: string) => void;
  onOpenTab?: (tab: string) => void;
  onPreviewSettlement?: (settlement: Promise<void>) => void;
}) {
  const selectedEvidence = model.evidence[0] ?? null;
  const selectedAppendixRow = selectedEvidence
    ? model.files.find((file) => file.assetId === selectedEvidence.asset.id) ?? null
    : null;
  const file = selectedAppendixRow ?? { locator: null };
  const additionalDiagramCount = Math.max(
    model.supportingDiagramCount,
    model.files.filter((file) => file.assetId !== selectedEvidence?.asset.id).length,
  );

  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock
        eyebrow="Cadastral evidence"
        title="SG Diagram Summary"
      />

      {model.contextNote && (
        <p className="mt-3 rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] px-4 py-3 text-xs leading-5 text-[#92400E]">
          {model.contextNote}
        </p>
      )}

      {model.emptyMessage ? (
        <p className="mt-4 text-sm leading-6 text-[#0D1B2A]/70">{model.emptyMessage}</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Diagram selected for this report
            </div>
            {!selectedEvidence ? (
              <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">
                No identity-gated Surveyor-General diagram is selected for this report.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {[selectedEvidence].map((block) => (
                  <li
                    key={block.asset.id}
                    data-sg-file={block.asset.id}
                    className="rounded-xl border border-[#D9E6F2] bg-white px-3 py-2"
                  >
                    <div className="text-sm font-semibold break-all text-[#0D1B2A]">
                      {block.asset.original_file_name}
                    </div>
                    <div className="mt-1 text-[11px] text-[#64748B]">
                      {block.readLabel}
                      {file.locator ? ` · ${file.locator}` : ""}
                    </div>
                    {block.isUserConfirmed && (
                      <div className="mt-2 text-[11px] font-semibold text-[#92400E]">
                        User-confirmed attachment, not official verification
                      </div>
                    )}
                    {block.isParentContext && (
                      <div className="mt-2 text-[11px] font-semibold text-[#92400E]">
                        PLAN / PARENT CONTEXT only
                      </div>
                    )}
                    {onOpenAsset && (
                      <button
                        type="button"
                        onClick={() => onOpenAsset(block.asset.id)}
                        className="report-no-print mt-2 inline-flex items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 py-1 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
                      >
                        Open source file <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {additionalDiagramCount > 0 && (
              <p className="mt-3 text-xs leading-5 text-[#64748B]">
                {additionalDiagramCount} additional readable SG diagram
                {additionalDiagramCount === 1 ? " is" : "s are"} listed in the Evidence Appendix.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#D9E6F2] bg-white p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Cadastral identity context
            </div>
            {model.lineage.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">
                No cadastral identifiers have been read yet.
              </p>
            ) : (
              <dl className="mt-3 space-y-3">
                {model.lineage.map((row) => (
                  <div key={row.label} className="border-b border-[#D9E6F2] pb-3 last:border-0">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                      {row.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-[#0D1B2A]">{row.value}</dd>
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      {row.scope === "parent_context" ? "Parent-plan context · " : ""}
                      {row.provenance}
                    </p>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      {model.evidence.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            What Easy Erf found
          </div>
          {model.evidence.map((block) => (
            <article key={block.asset.id} className="grid gap-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <SgPreview block={block} onPreviewSettlement={onPreviewSettlement} />
                <div className="mt-2 text-xs font-semibold text-[#0D1B2A]">{block.asset.original_file_name}</div>
                <div className="mt-1 text-[11px] text-[#64748B]">{block.readLabel}</div>
                {block.isParentContext && <div className="mt-2 text-[11px] font-semibold text-[#92400E]">PLAN / PARENT CONTEXT only</div>}
                {block.isUserConfirmed && <div className="mt-2 text-[11px] font-semibold text-[#92400E]">User-confirmed attachment, not official verification</div>}
                {onOpenAsset && (
                  <button type="button" onClick={() => onOpenAsset(block.asset.id)} className="report-no-print mt-3 inline-flex items-center gap-1 rounded-full border border-[#0D1B2A]/15 px-3 py-1 text-[11px] font-semibold text-[#0D1B2A] hover:bg-white">
                    Open source file <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">Findings</div>
                {block.isUserConfirmed && <p className="mt-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Easy Erf read this document, but it has not been automatically bound to this erf.</p>}
                {block.summary && <p className="mt-3 text-sm leading-6 text-[#0D1B2A]/75">{block.summary}</p>}
                {block.findings.length ? (
                  <ul className="mt-3 space-y-2">
                    {block.findings.slice(0, 6).map((finding) => (
                      <li key={`${finding.label}-${finding.value}`} className="rounded-xl border border-[#D9E6F2] bg-white px-3 py-2 text-xs">
                        <span className="font-semibold text-[#0D1B2A]">{finding.label}:</span> {finding.value}
                        <span className="ml-2 text-[10px] uppercase tracking-[0.08em] text-[#64748B]">{finding.scope === "parent_plan" ? "parent context" : "subject"} · {finding.confidence} confidence</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-[#64748B]">No structured findings were stored for this document.</p>}
                {block.findings.length > 6 && (
                  <details className="report-no-print mt-3 rounded-xl border border-[#D9E6F2] bg-white px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-[#B24A00]">
                      Show all {block.findings.length} findings
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {block.findings.slice(6).map((finding) => (
                        <li key={`${finding.label}-${finding.value}`} className="text-xs leading-5 text-[#0D1B2A]/75">
                          <span className="font-semibold">{finding.label}:</span> {finding.value}
                          <span className="ml-2 text-[10px] uppercase tracking-[0.08em] text-[#64748B]">{finding.scope === "parent_plan" ? "parent context" : "subject"} · {finding.confidence} confidence</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {onOpenTab && (
        <button
          type="button"
          onClick={() => onOpenTab("reports")}
          className="report-no-print mt-5 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
        >
          Manage diagrams in the Erf File <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}


export function ReportStillToVerifySection({
  anchorId,
  summary,
  canonicalItems = [],
  onOpenDisclosure,
}: {
  anchorId: string;
  summary: StillToVerifySummary;
  canonicalItems?: string[];
  onOpenDisclosure?: () => void;
}) {
  return (
    <section id={anchorId} className={sectionShell()}>
      <ReportSectionTitleBlock
        eyebrow="Still to verify"
        title={
          summary.count
            ? `${summary.count} item(s) still worth checking`
            : "Nothing outstanding across the tracked context checks"
        }
      />
      {summary.topItems.length > 0 && (
        <ul className="mt-4 space-y-2">
          {summary.topItems.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4 text-sm leading-6 text-[#0D1B2A]/80"
            >
              <span className="font-semibold text-[#0D1B2A]">{item.label}</span> — {item.action}
            </li>
          ))}
        </ul>
      )}
      {canonicalItems.length > 0 && (
        <ul className="mt-3 space-y-2">
          {canonicalItems.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 text-sm leading-6 text-[#0D1B2A]/80"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm leading-6 text-[#0D1B2A]/70">{summary.action}</p>
      {summary.count > summary.topItems.length && (
        <button
          type="button"
          onClick={onOpenDisclosure}
          className="report-no-print mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#B24A00]"
        >
          See all {summary.count} outstanding item(s) in the full due diligence area
        </button>
      )}
    </section>
  );
}
