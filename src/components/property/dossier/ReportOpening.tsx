import type { ReactNode } from "react";
import { ArrowRight, Copy, ExternalLink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { FiveQuestionReportGrid } from "@/components/reports/FiveQuestionReportGrid";
import { buildSelfServiceFiveQuestionContent } from "@/lib/reports/fiveQuestionReport";
import {
  riskStatusLabel,
  type EasyErfReportDocument,
  type RiskStripStatus,
} from "@/lib/reports/composeEasyErfReport";

/**
 * The Easy Erf Report opening.
 *
 * One continuous-scroll block: header, Ask Easy Erf, decision area, property at
 * a glance, up to four primary metrics, the critical risk strip and a single
 * Next Best Action. Every value is composed upstream — this component renders,
 * it never decides what the evidence means.
 */
export function ReportOpening({
  doc,
  askSlot,
  modeSlot,
  heroSlot,
  heroCaption,
  printOnly = false,
  onOpenTab,
  onPrint,
}: {
  doc: EasyErfReportDocument;
  askSlot?: ReactNode;
  modeSlot?: ReactNode;
  heroSlot?: ReactNode;
  heroCaption?: string | null;
  printOnly?: boolean;
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void;
  onPrint?: () => void;
}) {
  const header = doc.header;
  const snapshot = doc.decisionSnapshot;
  const action = doc.nextBestAction;
  const fiveQuestionContent = buildSelfServiceFiveQuestionContent(doc);

  return (
    <div className="report-opening space-y-4">
      {/* A. HEADER */}
      <section
        id="report-opening-header"
        className="report-section report-opening-header rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)] scroll-mt-24"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="report-brandbar flex flex-wrap items-center gap-3">
              <AtlasPin
                variant="horizontal"
                title="Easy Erf"
                className="h-[26px] w-auto shrink-0 sm:h-[30px]"
              />
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                {header.title}
                <span className="rounded-full bg-[#FF6A00] px-2 py-[1px] text-[9px] tracking-[0.14em] text-white">
                  Living report
                </span>
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A] sm:text-3xl">
              {header.addressLine ?? header.officialLine ?? "Selected erf"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#0D1B2A]/70">
              {header.erfNumber && <span>Erf {header.erfNumber}</span>}
              {header.municipality && <span>· {header.municipality}</span>}
              {header.province && <span>· {header.province}</span>}
              {header.propertyType && <span>· {header.propertyType}</span>}
            </div>
            <p className="mt-2 text-xs text-[#64748B]">
              Updated {new Date(header.generatedAtLabel).toLocaleString()} —{" "}
              {header.evidenceStatusLabel}.
            </p>
          </div>
          {!printOnly && onPrint && (
            <div className="report-no-print flex items-center gap-2">
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff8ec]"
              >
                Print / Save PDF
              </button>
            </div>
          )}
        </div>
      </section>

      {/* A2. REPORT VIEW — the one obvious lens control, before Ask Easy Erf */}
      {!printOnly && modeSlot && (
        <section id="report-view-mode" className="report-section scroll-mt-24">
          {modeSlot}
        </section>
      )}

      {/* B. ASK EASY ERF */}
      <section
        id="report-ask"
        className="report-section report-opening-ask scroll-mt-24"
        aria-label="Ask Easy Erf"
      >
        {printOnly ? (
          <div className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Ask Easy Erf
            </div>
            <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/72">{doc.ask.printExplanation}</p>
          </div>
        ) : (
          askSlot
        )}
      </section>

      {/* C. DECISION AREA */}
      <section
        id="report-decision"
        className="report-section report-decision-area grid gap-4 scroll-mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <figure className="m-0 overflow-hidden rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#0D1B2A]">
          {heroSlot ?? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 p-8 text-center text-white/70">
              <MapPin className="h-6 w-6 text-[#FF6A00]" />
              <p className="text-sm font-semibold text-white">
                {header.officialLine ?? "Selected erf"}
              </p>
              <p className="max-w-xs text-xs leading-5 text-white/60">
                No verified photograph or parcel image is available for this erf yet. Easy Erf does
                not display imagery it cannot source.
              </p>
            </div>
          )}
          {heroCaption && (
            <figcaption className="border-t border-white/10 px-4 py-2 text-[11px] text-white/65">
              {heroCaption}
            </figcaption>
          )}
        </figure>

        <article className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Opportunity & decision summary
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0D1B2A]">
            {snapshot.verdict}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">{snapshot.verdictDetail}</p>

          {snapshot.positives.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-[#0D1B2A]/78">
              {snapshot.positives.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-[#16a34a]">
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#fffbeb] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#92400E]">
                Biggest concern
              </dt>
              <dd className="mt-1 text-[#0D1B2A]/80">{snapshot.biggestConcern}</dd>
            </div>
            <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                Biggest opportunity
              </dt>
              <dd className="mt-1 text-[#0D1B2A]/80">
                {snapshot.bestOpportunity ??
                  "No opportunity is supported by recorded evidence yet."}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-[#64748B]">
            Evidence readiness: {snapshot.readinessPercent}% — {snapshot.confidence} confidence. {snapshot.confidenceReason}
          </p>
        </article>
      </section>

      {/* C2. THE SAME FIVE-QUESTION REPORT LENS USED BY HUMAN REVIEW */}
      <section
        id="report-five-questions"
        className="report-section rounded-[1.75rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4 scroll-mt-24 sm:p-5"
      >
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Easy Erf report summary
          </div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
            Five questions this investigation can answer from the evidence recorded so far
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            This self-service summary is selected from the existing report evidence. It does not add a human reviewer conclusion or invent missing facts.
          </p>
        </div>
        <FiveQuestionReportGrid content={fiveQuestionContent} />
      </section>

      {/* D. PROPERTY AT A GLANCE */}
      {doc.atAGlance.length > 0 && (
        <section
          id="report-glance"
          className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4 scroll-mt-24"
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Property summary
          </div>
          <dl className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 divide-x divide-[#0D1B2A]/10">
            {doc.atAGlance.map((item) => (
              <div key={item.id} className="min-w-[110px] pl-6 first:pl-0">
                <dt className="text-[11px] text-[#64748B]">{item.label}</dt>
                <dd className="text-sm font-semibold text-[#0D1B2A]">{item.value}</dd>
                <p className="text-[10px] text-[#94A3B8]">{item.provenance}</p>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* E. PRIMARY METRICS */}
      {doc.primaryMetrics.length > 0 && (
        <section
          id="report-metrics"
          className="report-section grid gap-3 scroll-mt-24 sm:grid-cols-2 lg:grid-cols-4"
        >
          {doc.primaryMetrics.map((metric) => (
            <article
              key={metric.id}
              className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                {metric.label}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                {metric.value}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#94A3B8]">
                {metric.provenance}
                {metric.denominator ? ` · Denominator: ${metric.denominator}` : ""}
              </p>
            </article>
          ))}
        </section>
      )}

      {/* F. CRITICAL RISK STRIP */}
      <section
        id="report-risk-strip"
        className="report-section rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4 scroll-mt-24"
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
          Risks & concerns
        </div>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">
          The most important recorded concerns and checks that still need attention.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {doc.riskStrip.map((item) => (
            <li
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] py-1 pl-3 pr-1.5"
              title={item.explanation}
            >
              <span className="text-xs font-semibold text-[#0D1B2A]">{item.label}</span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                  riskTone(item.status),
                )}
              >
                {riskStatusLabel(item.status)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* G. NEXT BEST ACTION */}
      <section
        id="report-next-action"
        className="report-section rounded-[1.75rem] border-2 border-[#FF6A00]/35 bg-[#FFF7ED] p-6 shadow-[0_18px_45px_-36px_rgba(255,106,0,0.55)] scroll-mt-24"
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
          Next best action
        </div>
        {action ? (
          <div className="mt-2 space-y-5">
            <div className="min-w-0">
              <h4 className="text-xl font-semibold tracking-tight text-[#0D1B2A] sm:text-2xl">
                {action.title}
              </h4>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B24A00]">
                Why this matters
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">
                {action.reason}
              </p>
              {action.professionalType && (
                <p className="mt-1 text-xs text-[#64748B]">
                  Typically handled by: {action.professionalType}
                </p>
              )}
            </div>

            {action.steps && action.steps.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B24A00]">
                  How to do it
                </div>
                <ol className="mt-2 grid gap-2 text-sm leading-6 text-[#0D1B2A]/75 sm:grid-cols-2">
                  {action.steps.map((step, index) => (
                    <li key={`${index}-${step}`} className="flex gap-2 rounded-xl bg-white/70 px-3 py-2">
                      <span className="font-bold text-[#B24A00]">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {action.estimatedMinutes != null && (
                <div className="rounded-xl border border-[#FF6A00]/20 bg-white/70 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B24A00]">
                    Estimated time
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#0D1B2A]">
                    About {action.estimatedMinutes} minutes
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-[#FF6A00]/20 bg-white/70 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B24A00]">
                  What happens next
                </div>
                <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/75">
                  {action.afterCompletion ?? action.completionCriteria}
                </p>
              </div>
            </div>

            {action.limitations && (
              <p className="rounded-xl border border-[#0D1B2A]/10 bg-white/60 px-3 py-2 text-xs leading-5 text-[#64748B]">
                <span className="font-semibold text-[#0D1B2A]">Limitations:</span>{" "}
                {action.limitations}
              </p>
            )}

            {action.requestTemplate && !printOnly && (
              <details className="rounded-xl border border-[#0D1B2A]/10 bg-white/70 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#0D1B2A]">
                  View request template
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-[#0D1B2A]/75">
                  {action.requestTemplate}
                </pre>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(action.requestTemplate!)}
                  className="report-no-print mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy request template
                </button>
              </details>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {!printOnly && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenTab?.(action.targetTab, { anchorId: action.targetAnchorId })
                  }
                  className="report-no-print inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
                >
                  {action.actionLabel ?? "Take this step"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {action.sourceUrl && action.sourceLabel &&
                (printOnly ? (
                  <span className="text-xs font-semibold text-[#64748B]">
                    Source: {action.sourceLabel}
                  </span>
                ) : (
                  <a
                    href={action.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="report-no-print inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-3 text-sm font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40"
                  >
                    Open {action.sourceLabel} <ExternalLink className="h-4 w-4" />
                  </a>
                ))}
              {!printOnly &&
                action.extraSources?.map((source) => (
                  <a
                    key={`${source.label}-${source.url}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="report-no-print inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-3 text-sm font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40"
                  >
                    Open {source.label} <ExternalLink className="h-4 w-4" />
                  </a>
                ))}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <h4 className="text-lg font-semibold text-[#0D1B2A]">
              {doc.hasCanonicalEvidence
                ? "Keep evidence current"
                : "Evidence for this erf is unavailable"}
            </h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">
              {doc.hasCanonicalEvidence
                ? "No material gap or contradiction remains in the recorded evidence. Review the evidence appendix below and refresh anything that has aged."
                : "No canonical evidence has been recorded for this erf yet, so Easy Erf cannot say that nothing remains outstanding. Add official, document or market evidence to start the report."}
            </p>
            {!printOnly && (
              <a
                href="#report-documents"
                className="report-no-print mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#B24A00]"
              >
                Open the evidence appendix <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function riskTone(status: RiskStripStatus): string {
  switch (status) {
    case "verified":
      return "bg-[#16a34a] text-white";
    case "supported":
      return "bg-[#DCFCE7] text-[#166534]";
    case "check_needed":
      return "bg-[#F59E0B] text-[#0D1B2A]";
    case "possible_issue":
      return "bg-[#FDE68A] text-[#92400E]";
    case "confirmed_issue":
      return "bg-[#DC2626] text-white";
    default:
      return "bg-[#D9E6F2] text-[#0D1B2A]";
  }
}
