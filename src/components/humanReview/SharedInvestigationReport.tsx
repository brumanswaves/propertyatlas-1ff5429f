import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { z } from "zod";
import { ReportOpening } from "@/components/property/dossier/ReportOpening";
import { AskEasyErfPanel } from "@/components/property/dossier/AskEasyErfPanel";
import { ReportMarketSection, ReportStrategySection, ReportSitePotentialSection, ReportEvidenceAppendix } from "@/components/property/dossier/ReportBodySections";
import { ReportContextSection, ReportMunicipalSection, ReportSgLineageSection } from "@/components/property/dossier/ReportContextSections";
import { ReportOwnershipSection, EvidenceBadgeChip } from "@/components/property/dossier/ReportEvidenceUi";
import { ReportBuildableAreaVisual } from "@/components/property/dossier/ReportBuildableAreaVisual";
import { ReportFindingsBlock, ReportActionPlan } from "@/components/property/dossier/ReportFindingsSection";
import { buildAskEasyErfSelectedEvidencePayload } from "@/lib/reports/askEasyErf";
import { validateAnswerAgainstSelectedEvidence, type AskEasyErfClientResult } from "@/lib/reports/askEasyErfClient";
import { validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";
import type { InvestigationAssembly } from "@/lib/investigation/sharedInvestigation";
import type { InvestigationReviewVersion } from "@/lib/investigation/investigationReviewVersion";
import { readInvestigationAsset, requestInvestigationReview } from "@/lib/investigation/investigationClient";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export function SharedInvestigationReport({ assembly, version, orderId, onOpenAsset, openingControls, onPreviewSettlement }: {
  assembly: InvestigationAssembly; version?: InvestigationReviewVersion; orderId?: string; onOpenAsset?: (id: string) => void;
  openingControls?: Pick<ComponentProps<typeof ReportOpening>, "onPrint" | "modeSlot" | "onOpenTab" | "heroSlot" | "heroCaption" | "printOnly">;
  onPreviewSettlement?: (settlement: Promise<void>) => void;
}) {
  const scopedOrderId = version?.order_id ?? orderId;
  const versionId = version?.id;
  const fileRequest = useRef<AbortController | null>(null);
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
  const brief = useMemo(() => version ? validateInvestigationBrief(version.edited_brief, assembly.pack.sources.map((s) => s.id)) : null, [version, assembly]);
  const approved = Boolean(version?.approved_at && version.approved_by);
  async function askVersion(question: string, signal: AbortSignal): Promise<AskEasyErfClientResult> {
    if (!version) return { success: false, error: "No reviewed version was selected." };
    const payload = z.object({ success: z.boolean(), answer: z.unknown().optional(), error: z.string().optional() }).parse(
      await requestInvestigationReview({ action: "ask", orderId: version.order_id, versionId: version.id, question }, signal));
    if (!assembly.modelEvidencePack) return { success: false, error: "The saved question evidence is unavailable." };
    const evidence = buildAskEasyErfSelectedEvidencePayload({ pack: assembly.modelEvidencePack, question });
    const answer = payload.success ? validateAnswerAgainstSelectedEvidence(payload.answer, evidence) : null;
    return answer ? { success: true, answer } : { success: false, error: payload.error ?? "The answer could not be grounded in this report version." };
  }
  return <article className="mx-auto max-w-6xl space-y-5 break-words" data-investigation-report={assembly.parcel.id} data-review-version={version?.id}>
    <ReportOpening {...openingControls} doc={assembly.document}
      reviewIdentity={version ? <div>
        <p>{approved ? "Human-reviewed investigation." : "AI investigation draft · Not human reviewed."}</p>
        {approved && <p className="mt-1 text-xs font-normal">Reviewed by {version.approved_reviewer_label} on {new Date(version.approved_at!).toLocaleString("en-ZA")}.</p>}
        <p className="mt-1 break-all text-xs font-normal">Version {version.id} · Evidence revision {version.evidence_revision} · Brief revision {version.brief_revision}</p>
        {version.currentEvidenceRevision !== version.evidence_revision && <p className="mt-2 text-xs">The working investigation has changed. This report preserves the evidence reviewed for this version.</p>}
      </div> : undefined}
      askSlot={<AskEasyErfPanel key={version?.id ?? assembly.pack.fingerprint} suggestionPayload={assembly.askSuggestions}
        evidencePack={assembly.pack} askFromReviewedVersion={version ? askVersion : undefined} />}
      reviewSlot={brief ? <section aria-label="Investigation brief" className="space-y-4 border-y border-border py-5">
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
    <section aria-label="Recorded identity" className="border-y border-border py-5">
      <h2 className="text-xl font-semibold">Property identity and address</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">{assembly.pack.claims.filter((c) => c.domain === "identity").map((claim) => <div key={claim.id}>
        <dt className="text-sm text-muted-foreground">{claim.label}</dt><dd className="font-medium">{claim.value === null ? "Not yet verified" : String(claim.value)}</dd>
        <p className="text-xs text-muted-foreground">{claim.status} · {claim.sourceIds.map((id) => assembly.pack.sources.find((s) => s.id === id)?.label ?? id).join("; ")}</p>
      </div>)}</dl>
    </section>
    <ReportSgLineageSection anchorId="investigation-sg" model={assembly.sg} onOpenAsset={openAsset} loadPreview={scopedOrderId ? loadPreview : undefined} onPreviewSettlement={onPreviewSettlement} />
    <ReportOwnershipSection ownership={assembly.report.ownership} />
    <section className="border-y border-border py-5" aria-label="Planning evidence">
      <h2 className="text-xl font-semibold">Zoning, planning and building controls</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assembly.report.planning.map((field) => <div key={field.label}>
        <dt className="text-sm text-muted-foreground">{field.label}</dt><dd>{field.value ?? "Not yet verified"}</dd>
        <EvidenceBadgeChip badge={field.value ? field.badge : "missing"} />
      </div>)}</dl>
    </section>
    <ReportFindingsBlock anchorId="investigation-findings" eyebrow="Evidence findings" title="Recorded findings and conflicts"
      findings={assembly.document.findings} actions={assembly.document.actions} emptyMessage="No supported findings are recorded yet." />
    <ReportContextSection anchorId="investigation-site-risk" eyebrow="Property checks" title="Physical and environmental evidence" model={assembly.siteRisk} />
    <ReportMunicipalSection anchorId="investigation-services" model={assembly.municipal} />
    <ReportContextSection anchorId="investigation-location" eyebrow="Location" title="Location context" model={assembly.location} />
    <ReportMarketSection anchorId="investigation-market" model={assembly.market} />
    <ReportStrategySection anchorId="investigation-strategy" model={assembly.strategy} />
    <ReportSitePotentialSection anchorId="investigation-site" panel={assembly.site} capacityVisual={assembly.envelope
      ? <ReportBuildableAreaVisual ring={assembly.ring} result={assembly.envelope} /> : undefined} />
    <ReportActionPlan actions={assembly.document.actions} />
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
    {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
    {fileUrl && <section aria-label="Selected report document" className="report-no-print border border-border p-3">
      <button type="button" className="min-h-11 underline" onClick={() => { fileRequest.current?.abort(); setFileUrl(null); }}>Close document</button>
      <object data={fileUrl} className="h-[65vh] w-full"><a href={fileUrl} download>Download selected document</a></object>
    </section>}
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
  </article>;
}
