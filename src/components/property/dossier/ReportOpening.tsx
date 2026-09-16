import type { ReactNode } from "react";
import { ArrowDown, MapPin, Printer } from "lucide-react";
import { AtlasPin } from "@/components/brand/AtlasPin";
import type { EasyErfReportDocument } from "@/lib/reports/composeEasyErfReport";
import type { StrategySectionModel } from "@/lib/reports/strategySection";
import { materialReportFindings } from "@/lib/reports/reportPresentation";
import { ReportActionPlan } from "./ReportFindingsSection";

/** A reading hierarchy over the existing document, not a new evidence model. */
export function ReportOpening({ doc, askSlot, modeSlot, heroSlot, heroCaption, printOnly = false,
  onOpenTab, onPrint, reviewSlot, reviewIdentity, reviewBottomLine, strategy, hasEvidenceSections = false,
}: {
  doc: EasyErfReportDocument; askSlot?: ReactNode; modeSlot?: ReactNode; heroSlot?: ReactNode;
  heroCaption?: string | null; printOnly?: boolean;
  onOpenTab?: (tab: string, options?: { anchorId?: string }) => void; onPrint?: () => void;
  reviewSlot?: ReactNode; reviewIdentity?: ReactNode; reviewBottomLine?: ReactNode;
  strategy?: StrategySectionModel; hasEvidenceSections?: boolean;
}) {
  const { header, decisionSnapshot: snapshot } = doc;
  const issues = materialReportFindings(doc.findings);
  const gaps = doc.riskStrip.filter((risk) => risk.status === "unknown" || risk.status === "check_needed");
  const locality = [doc.atAGlance.find((item) => item.id === "town")?.value, header.municipality, header.province].filter(Boolean).join(", ");
  const place = header.addressLine ?? locality;
  const facts = doc.atAGlance.filter((item) => !["official-lpi", "official-municipality", "official-province", "working-address", "official-erf"].includes(item.id));
  const figures = strategy?.hasScenario ? [strategy.acquisition, strategy.maximumJustifiedPrice, ...strategy.headline].filter((item) => item != null).slice(0, 4) : [];

  return <div className="report-opening space-y-7 text-primary">
    <header id="report-opening-header" className="report-section border-b border-border pb-5 scroll-mt-6">
      <div className="flex items-center justify-between gap-4">
        <AtlasPin variant="horizontal" title="Easy Erf" className="h-[30px] w-auto" />
        {!printOnly && onPrint && <button type="button" onClick={onPrint} title="Print / Save PDF" aria-label="Print / Save PDF"
          className="report-no-print inline-flex h-11 w-11 items-center justify-center rounded border border-border hover:bg-muted"><Printer className="h-5 w-5" /></button>}
      </div>
      <p className="mt-5 text-xs font-semibold text-muted-foreground">Easy Erf Report</p>
      <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{header.addressLine ?? (header.erfNumber ? `Erf ${header.erfNumber}` : header.officialLine ?? "Selected property")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{header.addressLine && header.erfNumber ? `Erf ${header.erfNumber} · ` : ""}{locality}</p>
      <div className="mt-2 text-xs text-muted-foreground">{reviewIdentity ?? "Self-service investigation · Not human reviewed."}</div>
    </header>

    {!printOnly && askSlot && <details id="report-ask" className="report-no-print border-b border-border py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Ask Easy Erf about this erf</summary><div className="mt-4">{askSlot}</div></details>}

    <section id="report-decision" aria-label="Property assessment" className="report-section grid gap-5 scroll-mt-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-accent">The assessment</p>
        <h3 className="mt-2 text-xl font-semibold">{snapshot.verdict}</h3>
        <div className="mt-2 text-sm leading-6">{reviewBottomLine ?? snapshot.verdictDetail}</div>
        {snapshot.positives.length > 0 && <ul className="mt-4 space-y-2 border-l-2 border-emerald-700 pl-4 text-sm leading-6">
          {snapshot.positives.map((item) => <li key={item}>{item}</li>)}
        </ul>}
        <p className="mt-4 text-xs text-muted-foreground">Evidence readiness {snapshot.readinessPercent}%. {snapshot.confidenceReason}</p>
      </div>
      <figure className="min-w-0 overflow-hidden rounded-lg bg-primary text-primary-foreground">
        {heroSlot ?? <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-6 text-center">
          <MapPin className="h-6 w-6 text-accent" /><p className="text-sm">No sourced parcel image is available.</p>
        </div>}
        {heroCaption && <figcaption className="px-4 py-3 text-xs leading-5 opacity-80">{heroCaption}</figcaption>}
      </figure>
    </section>

    {facts.length > 0 && <dl id="report-glance" aria-label="Property summary" className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 sm:grid-cols-4">
      {facts.map((item) => <div key={item.id} className="min-w-0"><dt className="text-xs text-muted-foreground">{item.label}</dt>
        <dd className="mt-1 text-base font-semibold">{item.value}</dd><p className="mt-1 text-xs text-muted-foreground">{item.provenance}</p></div>)}
    </dl>}

    <section id="report-metrics" aria-label="Strategy numbers" className="report-section scroll-mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold">{strategy?.hasScenario ? strategy.strategyName : "The numbers"}</h3>
        {hasEvidenceSections && strategy?.hasScenario && <a href="#investigation-strategy" className="report-no-print text-sm underline underline-offset-4">View assumptions and outputs</a>}
      </div>
      {figures.length > 0 ? <><dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">{figures.map((metric) => <div key={metric.id} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{metric.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{metric.value}</dd>
        <p className="mt-1 text-xs text-muted-foreground">{metric.kind === "user_assumption" ? "User assumption" : "Calculated from saved assumptions"}</p>
      </div>)}</dl><p className="mt-3 text-xs text-muted-foreground">Saved scenario, not a valuation or a forecast. Changing the inputs changes the outcome.</p></>
        : <p className="mt-2 text-sm leading-6 text-muted-foreground">No selected Strategy figures are available. Purchase, costs and returns have not been established.</p>}
      {!strategy && doc.primaryMetrics.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{doc.primaryMetrics.map((metric) => <div key={metric.id}><dt className="text-xs text-muted-foreground">{metric.label}</dt>
        <dd className="text-lg font-semibold">{metric.value}</dd><p className="text-xs text-muted-foreground">{metric.provenance}{metric.denominator ? ` · Denominator: ${metric.denominator}` : ""}</p></div>)}</dl>}
    </section>

    <section id="report-risk-strip" aria-label="Material risks and unknowns" className="report-section border-y border-border py-5 scroll-mt-6">
      <h3 className="text-lg font-semibold">What could change the decision</h3>
      {issues.length > 0 && <ul className="mt-3 space-y-4">{issues.map((finding) => <li key={finding.id} className="border-l-2 border-destructive pl-4">
        <p className="font-semibold">{finding.headline}</p><p className="mt-1 text-sm leading-6">{finding.whatWeFound}</p>
        {hasEvidenceSections && <a className="report-no-print mt-1 inline-block text-sm underline" href={`#finding-${finding.id}`}>View evidence and implications</a>}
      </li>)}</ul>}
      {gaps.length > 0 && <p className="mt-3 text-sm leading-6"><strong>Still unverified: </strong>{gaps.map((risk) => risk.label).join("; ")}. These are gaps in evidence, not confirmed defects.</p>}
      {!issues.length && !gaps.length && <p className="mt-3 text-sm leading-6">{snapshot.biggestConcern ?? "No material concern was derived from the recorded evidence."}</p>}
    </section>

    <section id="report-next-action" className="report-section scroll-mt-6" aria-label="Prioritised next actions">
      <h3 className="text-lg font-semibold">What to do next</h3>
      {!doc.hasCanonicalEvidence && !doc.nextBestAction ? <p className="mt-2 text-sm">Evidence for this erf is unavailable. Add source evidence before treating any check as resolved.</p>
        : <ReportActionPlan actions={doc.actions} canonicalAction={doc.nextBestAction} summary onOpenTab={printOnly ? undefined : onOpenTab}
          location={place} evidenceLinks={hasEvidenceSections} printOnly={printOnly} />}
    </section>

    {reviewSlot && <details open={printOnly || undefined} className="report-section border-y border-border py-4">
      <summary className="cursor-pointer font-semibold">Full reviewer assessment and review provenance</summary>{reviewSlot}
    </details>}
    {!printOnly && modeSlot && <details id="report-view-mode" className="report-no-print border-b border-border py-4"><summary className="cursor-pointer text-sm font-semibold">Other report perspectives</summary><div className="mt-3">{modeSlot}</div></details>}
    {printOnly && <p className="text-xs text-muted-foreground">{doc.ask.printExplanation}</p>}
    {hasEvidenceSections && <a href="#report-evidence" className="report-no-print inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">Explore the supporting evidence <ArrowDown className="h-4 w-4" /></a>}
  </div>;
}
