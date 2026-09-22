import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { z } from "zod";
import { ReportOpening } from "@/components/property/dossier/ReportOpening";
import { ReportParcelSatelliteMap } from "@/components/property/dossier/ReportParcelSatelliteMap";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import { ReportMarketSection, ReportStrategySection, ReportSitePotentialSection, ReportEvidenceAppendix } from "@/components/property/dossier/ReportBodySections";
import { ReportContextSection, ReportMunicipalSection, ReportSgLineageSection } from "@/components/property/dossier/ReportContextSections";
import { ReportOwnershipSection, EvidenceBadgeChip } from "@/components/property/dossier/ReportEvidenceUi";
import { ReportBuildableAreaVisual } from "@/components/property/dossier/ReportBuildableAreaVisual";
import { ReportFindingsBlock, ReportActionPlan } from "@/components/property/dossier/ReportFindingsSection";
import { buildAskEasyErfSelectedEvidencePayload } from "@/lib/reports/askEasyErf";
import { validateAnswerAgainstSelectedEvidence, type AskEasyErfClientResult } from "@/lib/reports/askEasyErfClient";
import { validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";
import { validateHumanReviewReportContent } from "../../../supabase/functions/_shared/easyErfHumanReviewContract";
import type { InvestigationAssembly } from "@/lib/investigation/sharedInvestigation";
import { HUMAN_ONLY_REVIEW_MODEL, type InvestigationReviewVersion } from "@/lib/investigation/investigationReviewVersion";
import { readInvestigationAsset, requestInvestigationReview } from "@/lib/investigation/investigationClient";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { ReportEvidenceDetails } from "@/components/property/dossier/ReportEvidenceDetails";

export function SharedInvestigationReport({ assembly, version, orderId, onOpenAsset, openingControls, onPreviewSettlement }: {
  assembly: InvestigationAssembly; version?: InvestigationReviewVersion; orderId?: string; onOpenAsset?: (id: string) => void;
  openingControls?: Pick<ComponentProps<typeof ReportOpening>, "onPrint" | "modeSlot" | "onOpenTab" | "heroSlot" | "heroCaption" | "printOnly">;
  onPreviewSettlement?: (settlement: Promise<void>) => void;
}) {
  const scopedOrderId = version?.order_id ?? orderId;
  const versionId = version?.id;
  const fileRequest = useRef<AbortController | null>(null);
  const returnLink = useRef<HTMLElement | null>(null);
  const printOnly = Boolean(openingControls?.printOnly);
  const openTask = version ? undefined : openingControls?.onOpenTab;
  const openContextTask = openTask ? (tab: string | null) => { if (tab) openTask(tab); } : undefined;
  const sourceLabels = Object.fromEntries(assembly.pack.sources.map((source) => [source.id, source.label]));
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  useEffect(() => () => fileRequest.current?.abort(), [scopedOrderId, versionId]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  const openAsset = onOpenAsset ?? (scopedOrderId ? (id: string) => {
    fileRequest.current?.abort();
    const controller = new AbortController(); fileRequest.current = controller;
    setFileUrl(null); setFileError(null);
    void readInvestigationAsset({ orderId: scopedOrderId, assetId: id, versionId }, controller.signal).then((blob) => {
      if (!controller.signal.aborted && fileRequest.current === controller) setFileUrl(URL.createObjectURL(blob));
    }).catch(() => {
      if (!controller.signal.aborted) setFileError("This original document is unavailable or its license does not permit sharing. The recorded findings remain visible.");
    });
  } : undefined);
  const loadPreview = useCallback(async (asset: ErfAsset, signal: AbortSignal) => {
    if (!scopedOrderId) return null;
    return readInvestigationAsset({ orderId: scopedOrderId, assetId: asset.id, versionId, preview: true }, signal);
  }, [scopedOrderId, versionId]);
  const humanOnly = version?.provider_model === HUMAN_ONLY_REVIEW_MODEL;
  const humanReview = useMemo(() => {
    if (!version || !humanOnly) return null;
    const validated = validateHumanReviewReportContent(version.edited_brief);
    return validated.ok ? validated.content : null;
  }, [version, humanOnly]);
  const brief = useMemo(() => version && !humanOnly
    ? validateInvestigationBrief(version.edited_brief, assembly.pack.sources.map((s) => s.id)) : null,
  [version, assembly, humanOnly]);
  const approved = Boolean(version?.approved_at && version.approved_by);
  const paidReviewNotDelivered = Boolean(orderId && (!version || !version.delivered_at));
  const askUnavailable = humanOnly || paidReviewNotDelivered;
  const askUnavailableMessage = humanOnly
    ? "Ask Easy Erf is unavailable for this human-only reviewed version because no AI-permitted evidence package was frozen with it. Nothing from this reviewed version is sent to AI."
    : "Ask Easy Erf becomes available only after an evidence-bound reviewed version is delivered. Work-in-progress investigation evidence is not sent through the ordinary Ask path.";
  const parcelCenter = assembly.parcel.coordinates
    ? { lng: assembly.parcel.coordinates.lng, lat: assembly.parcel.coordinates.lat }
    : null;
  const parcelLabel = assembly.document.header.addressLine ?? assembly.document.header.officialLine ?? "Selected erf";
  const defaultHero = (
    <ReportParcelSatelliteMap onPreviewSettlement={onPreviewSettlement} ring={assembly.ring} center={parcelCenter} label={parcelLabel} />
  );
  const defaultHeroCaption = assembly.ring
    ? "Satellite context with the recorded parcel boundary. The overlay is property context, not a survey or boundary confirmation."
    : "Satellite context for the recorded property location. No parcel boundary is shown unless saved geometry is available.";

  async function askVersion(question: string, signal: AbortSignal): Promise<AskEasyErfClientResult> {
    if (!version) return { success: false, error: "No reviewed version was selected." };
    const payload = z.object({ success: z.boolean(), answer: z.unknown().optional(), error: z.string().optional() }).parse(
      await requestInvestigationReview({ action: "ask", orderId: version.order_id, versionId: version.id, question }, signal));
    if (!assembly.modelEvidencePack) return { success: false, error: "The saved question evidence is unavailable." };
    const evidence = buildAskEasyErfSelectedEvidencePayload({ pack: assembly.modelEvidencePack, question });
    const answer = payload.success ? validateAnswerAgainstSelectedEvidence(payload.answer, evidence) : null;
    return answer ? { success: true, answer } : { success: false, error: payload.error ?? "The answer could not be grounded in this report version." };
  }
  const humanReviewLabels = {
    bottomLine: "Bottom line",
    known: "What we know",
    potential: "What appears possible",
    risks: "What could be a problem",
    unknowns: "What we do not know yet",
    nextSteps: "What should be verified next",
  } as const;
  return <article className="mx-auto max-w-6xl space-y-5 break-words bg-[#FFFDFA] p-4 sm:p-6 report-decision-brief" data-investigation-report={assembly.parcel.id} data-review-version={version?.id}
    onClick={(event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const target = event.currentTarget.querySelector<HTMLElement>(`[id="${CSS.escape(link.hash.slice(1))}"]`);
      if (!target) return;
      // Keep exact-order hashes intact. Reveal in-report evidence without changing selection.
      event.preventDefault();
      const destination = link.hasAttribute("data-report-return") && returnLink.current?.isConnected ? returnLink.current : target;
      if (!link.hasAttribute("data-report-return")) returnLink.current = link;
      let ancestor = destination.parentElement;
      while (ancestor && ancestor !== event.currentTarget) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      // The staff shell pins the selected order above this same report.
      const pinnedIdentity = event.currentTarget.closest("[data-order-id]")?.previousElementSibling;
      const pinnedHeight = pinnedIdentity?.matches('header[aria-label="Selected order identity"]')
        ? pinnedIdentity.getBoundingClientRect().height + 24 : 0;
      destination.style.scrollMarginTop = `${Math.max(96, pinnedHeight)}px`;
      destination.scrollIntoView({ block: "start" });
      if (!destination.matches("a[href], button, input, select, textarea, summary, [tabindex]")) destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }}>
    <ReportOpening {...openingControls} doc={assembly.document} onOpenTab={openTask} hasEvidenceSections strategy={assembly.strategy}
      reviewBottomLine={humanReview?.bottomLine ?? brief?.bottomLine.text}
      heroSlot={openingControls?.heroSlot ?? defaultHero}
      heroCaption={openingControls?.heroCaption ?? defaultHeroCaption}
      reviewIdentity={version ? <div>
        <p>{approved ? "Human-reviewed investigation." : humanOnly ? "Human-only review draft · Not approved." : "AI investigation draft · Not human reviewed."}</p>
        {approved && <p className="mt-1 text-xs font-normal">Reviewed by {version.approved_reviewer_label} on {new Date(version.approved_at!).toLocaleString("en-ZA")}.</p>}
        <details className="mt-1 text-xs font-normal"><summary className="cursor-pointer">Version and evidence record</summary><p className="break-all">Version {version.id} · Evidence revision {version.evidence_revision} · Brief revision {version.brief_revision}</p></details>
        {version.currentEvidenceRevision !== version.evidence_revision && <p className="mt-2 text-xs">The working investigation has changed. This report preserves the evidence reviewed for this version.</p>}
      </div> : undefined}
      askSlot={askUnavailable ? <section id="report-ask-easy-erf" className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-6">
        <h3 className="text-xl font-semibold">Ask Easy Erf</h3>
        <p className="mt-2 text-sm leading-6">{askUnavailableMessage}</p>
      </section> : <AskEasyErfPanel key={version?.id ?? assembly.pack.fingerprint} suggestionPayload={assembly.askSuggestions}
        evidencePack={assembly.pack} askFromReviewedVersion={version ? askVersion : undefined} />}
      reviewSlot={humanReview ? <section aria-label="Human-only investigation review" className="space-y-4 border-y border-border py-5">
        <h2 className="text-xl font-semibold">Human-reviewed investigation summary</h2>
        <p className="text-xs text-muted-foreground">{approved
          ? "Written and approved by the human reviewer from the frozen investigation evidence."
          : "Written by the human reviewer from the frozen investigation evidence. This draft is not approved or deliverable yet."} No AI synthesis was used for this summary. The underlying evidence and provenance remain in the full report below.</p>
        {(["bottomLine", "known", "potential", "risks", "unknowns", "nextSteps"] as const).map((key) => {
          const statements = key === "bottomLine" ? [humanReview.bottomLine] : humanReview[key];
          return <section key={key} className="py-2"><h3 className="font-semibold">{humanReviewLabels[key]}</h3>
            <ul className="mt-2 space-y-3">{statements.map((statement, i) => <li key={i}><p className="text-sm leading-6">{statement}</p></li>)}</ul>
          </section>;
        })}
      </section> : brief ? <section aria-label="Investigation brief" className="space-y-4 border-y border-border py-5">
        <h2 className="text-xl font-semibold">{approved ? "Human-approved investigation brief" : "Draft investigation brief"}</h2>
        <p className="text-xs text-muted-foreground">AI synthesis from recorded evidence, {new Date(version!.generated_at).toLocaleDateString("en-ZA")}. {approved ? "Checked and approved by the named reviewer." : "Requires human review and approval."}</p>
        <section aria-label="AI review inputs" className="border-b border-border pb-4">
          {assembly.modelProvenance?.limitation && <p className="mb-3 text-sm">{assembly.modelProvenance.limitation}</p>}
          {assembly.modelProvenance?.independentSources.map((source) => <p key={source.responseSha256} className="mb-2 text-sm">
            Independently retrieved public evidence: <a href={source.endpoint} className="underline">{source.kind === "public_csg_query" ? "CSG parcel record" : source.kind}</a>
            {" "}on {new Date(source.retrievedAt).toLocaleDateString("en-ZA")}. Document dependencies: none.
          </p>)}
          <h3 className="font-semibold">Documents considered by the AI</h3>
          {version?.evidence_manifest ? version.evidence_manifest.length > 0
            ? <ul className="mt-2 space-y-2 text-sm">{version.evidence_manifest.map((item) => <li key={item.assetId}>
              <strong>{item.name}</strong><p>{item.state === "included" ? "Included extracted evidence" : item.state === "unreadable" ? "Not readable as accepted evidence" : "Omitted from AI review"}. {item.reason}</p>
            </li>)}</ul>
            : <p className="mt-2 text-sm">No document inputs were supplied to this AI brief. It used the recorded property evidence and source checks.</p>
            : <p className="mt-2 text-sm">The document input record is unavailable for this saved version. Do not assume every document was reviewed by AI.</p>}
        </section>
        {(["bottomLine", "known", "potential", "risks", "unknowns", "nextSteps"] as const).map((key) => {
          const statements = key === "bottomLine" ? [brief.bottomLine] : brief[key];
          const labels = { bottomLine: "Bottom line", known: "Supported facts", potential: "What appears possible", risks: "Material risks and contradictions", unknowns: "What remains unknown", nextSteps: "Practical next checks" };
          return <section key={key} className="py-2"><h3 className="font-semibold">{labels[key]}</h3>
            <ul className="mt-2 space-y-3">{statements.map((statement, i) => <li key={i}>
              <p className="text-sm leading-6">{statement.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">Sources: {statement.sourceRefs.map((ref, j) => <span key={ref}>{j ? "; " : ""}<a href={`#investigation-source-${encodeURIComponent(ref)}`} className="underline">{assembly.pack.sources.find((s) => s.id === ref)?.label ?? ref}</a></span>)}</p>
            </li>)}</ul>
          </section>;
        })}
      </section> : undefined} />
    <section id="report-evidence" aria-label="Supporting evidence" className="scroll-mt-6 border-t border-border pt-6">
    <h2 className="mb-2 text-xl font-semibold">The evidence behind the assessment</h2>
    <ReportEvidenceDetails title="Property identity, SG and title" printOnly={printOnly}>
    <section id="investigation-identity" aria-label="Recorded identity" className="border-y border-border py-5">
      <h2 className="text-xl font-semibold">Property identity and address</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">{assembly.pack.claims.filter((c) => c.domain === "identity").map((claim) => <div key={claim.id}>
        <dt className="text-sm text-muted-foreground">{claim.label}</dt><dd className="font-medium">{claim.value === null ? "Not yet verified" : String(claim.value)}</dd>
        <p className="text-xs text-muted-foreground">{claim.status} · {claim.sourceIds.map((id) => assembly.pack.sources.find((s) => s.id === id)?.label ?? id).join("; ")}</p>
      </div>)}</dl>
    </section>
    <ReportSgLineageSection anchorId="investigation-sg" model={assembly.sg} onOpenAsset={openAsset} loadPreview={scopedOrderId ? loadPreview : undefined} onPreviewSettlement={onPreviewSettlement} />
    <div id="investigation-title"><ReportOwnershipSection ownership={assembly.report.ownership} /></div>
    </ReportEvidenceDetails>
    <ReportEvidenceDetails title="Planning and deterministic Site Potential" printOnly={printOnly}>
    <section id="investigation-planning" className="border-y border-border py-5" aria-label="Planning evidence">
      <h2 className="text-xl font-semibold">Zoning, planning and building controls</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assembly.report.planning.map((field) => <div key={field.label}>
        <dt className="text-sm text-muted-foreground">{field.label}</dt><dd>{field.value ?? "Not yet verified"}</dd>
        <EvidenceBadgeChip badge={field.value ? field.badge : "missing"} />
      </div>)}</dl>
    </section>
    <ReportSitePotentialSection anchorId="investigation-site" panel={assembly.site} capacityVisual={assembly.envelope
      ? <ReportBuildableAreaVisual ring={assembly.ring} result={assembly.envelope} /> : undefined} />
    </ReportEvidenceDetails>
    <ReportEvidenceDetails title="Market evidence and Strategy assumptions" printOnly={printOnly}>
    <ReportMarketSection anchorId="investigation-market" model={assembly.market} />
    <ReportStrategySection anchorId="investigation-strategy" model={assembly.strategy} />
    </ReportEvidenceDetails>
    <ReportEvidenceDetails title="Property checks, services and location" printOnly={printOnly}>
    <ReportContextSection anchorId="investigation-site-risk" eyebrow="Property checks" title="Physical and environmental evidence" model={assembly.siteRisk} onOpenTab={openContextTask} />
    <ReportMunicipalSection anchorId="investigation-services" model={assembly.municipal} onOpenTab={openContextTask} />
    <ReportContextSection anchorId="investigation-location" eyebrow="Location" title="Location context" model={assembly.location} onOpenTab={openContextTask} />
    </ReportEvidenceDetails>
    <ReportEvidenceDetails title="All findings, conflicts and follow-up actions" printOnly={printOnly}>
    <ReportFindingsBlock anchorId="investigation-findings" eyebrow="Evidence findings" title="Recorded findings and conflicts"
      findings={assembly.document.findings} sourceLabels={sourceLabels} emptyMessage="No supported findings are recorded yet." />
    <section id="investigation-actions"><h3 className="text-lg font-semibold">All follow-up actions</h3>
    <ReportActionPlan actions={assembly.document.actions} canonicalAction={assembly.document.nextBestAction} evidenceLinks
      location={[assembly.parcel.town, assembly.parcel.municipality, assembly.parcel.province].filter(Boolean).join(", ")}
      onOpenTab={openTask} printOnly={printOnly} /></section>
    </ReportEvidenceDetails>
    <ReportEvidenceDetails title="Documents, source references and investigation record" printOnly={printOnly}>
    <section aria-label="Recorded investigation checks and limitations" className="border-y border-border py-5">
      <h2 className="text-xl font-semibold">Sources checked and remaining limitations</h2>
      {assembly.work.length === 0 ? <p className="mt-3 text-sm">No source-check records have been saved yet.</p>
        : <dl className="mt-4 space-y-5">{assembly.work.map((item) => <div key={item.id}>
          <dt className="font-semibold">{item.label}</dt>
          <dd className="space-y-1 text-sm"><p>Source: {item.source}</p>
            <p>Checked: {new Date(item.checkedAt).toLocaleDateString("en-ZA")}</p>
            <p>Recorded result: {item.result}</p><p>Reason: {item.reason}</p><p>Remaining limitation: {item.limitation}</p>
            <p>{item.disposition === "reviewed" ? "Investigator-recorded check; not official verification."
              : `${approved ? "Reviewer accepted" : "Awaiting reviewer disposition"}: ${item.disposition === "unavailable" ? "Evidence unavailable" : "Not applicable"}.`}</p>
          </dd></div>)}</dl>}
    </section>
    <ReportEvidenceAppendix anchorId="investigation-documents" rows={assembly.appendix} completenessPercent={assembly.report.documents.completenessPercent} onOpenAsset={openAsset} />
    <section aria-label="Source references" className="border-t border-border py-5">
      <h2 className="text-xl font-semibold">Sources and provenance</h2>
      <ul className="mt-4 space-y-3">{assembly.pack.sources.map((source) => <li key={source.id} id={`investigation-source-${encodeURIComponent(source.id)}`} className="scroll-mt-6 text-sm">
        <strong>{source.label}</strong><p className="text-xs text-muted-foreground">{source.authorityType} · {source.status}{source.capturedAt ? ` · Recorded ${source.capturedAt}` : ""}</p>
        {source.locators.map((locator, index) => <p key={index} className="mt-1 text-xs text-muted-foreground">
          {[locator.pageLabel ?? (locator.pageNumber ? `Page ${locator.pageNumber}` : null), locator.fieldPath, locator.excerpt].filter(Boolean).join(" · ")}
        </p>)}
        {source.fragments.map((fragment, index) => <p key={index} className="mt-1 text-sm">{fragment}</p>)}
      </li>)}</ul>
    </section>
    </ReportEvidenceDetails>
    </section>
    {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
    {fileUrl && <section aria-label="Selected report document" className="report-no-print border border-border p-3">
      <button type="button" className="min-h-11 underline" onClick={() => { fileRequest.current?.abort(); setFileUrl(null); }}>Close document</button>
      <object data={fileUrl} className="h-[65vh] w-full"><a href={fileUrl} download>Download selected document</a></object>
    </section>}
    <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Report assembled {new Date(assembly.document.header.generatedAtLabel).toLocaleDateString("en-ZA")}. Property research, not municipal approval or professional legal, planning, engineering or valuation advice.</p>
  </article>;
}
