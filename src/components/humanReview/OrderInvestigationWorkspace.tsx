import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Save, Sparkles, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth/useAuth";
import { useOperationsAccess } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { assembleInvestigation, assessInvestigationSignoff, investigationAttemptSchema, recordedInvestigationWork, type InvestigationAttempt, type OrderInvestigation } from "@/lib/investigation/sharedInvestigation";
import { DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS } from "@/lib/humanReview/scope";
import { investigationClient, patchOrderInvestigation, readOrderInvestigation, readInvestigationAsset, uploadInvestigationAsset, requireInvestigationResult, requestInvestigationReview } from "@/lib/investigation/investigationClient";
import { SharedInvestigationContext, type SharedInvestigationScope } from "@/lib/investigation/sharedInvestigationContext";
import { toSupabaseJson } from "@/lib/supabase/json";
import { normalizeInvestigationPatch } from "@/lib/investigation/investigationClient";
import { ConfirmPropertyStep } from "@/components/property/investigation/ConfirmPropertyStep";
import { AddAddressStep } from "@/components/property/investigation/AddAddressStep";
import { GuidedSgDiagramStep } from "@/components/property/investigation/GuidedSgDiagramStep";
import { GuidedTitleStep } from "@/components/property/investigation/GuidedTitleStep";
import { GuidedPropertyChecksStep } from "@/components/property/investigation/GuidedPropertyChecksStep";
import { GuidedZoningStep } from "@/components/property/investigation/GuidedZoningStep";
import { MarketEvidenceTab } from "@/features/marketEvidence/components/MarketEvidenceTab";
import { StrategyLab } from "@/components/property/strategy/StrategyLab";
import { SitePotentialTab } from "@/components/property/dossier/SitePotentialTab";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import { buildGuidedInvestigationJourney, type GuidedInvestigationStepId } from "@/lib/investigation/guidedJourney";
import { HUMAN_ONLY_REVIEW_MODEL, investigationReviewVersionSchema, type InvestigationReviewVersion } from "@/lib/investigation/investigationReviewVersion";
import { validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";
import { SharedInvestigationReport } from "./SharedInvestigationReport";
import { HumanOnlyReviewEditor } from "./HumanOnlyReviewEditor";

const button = "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function OrderInvestigationWorkspace({ orderId, onApproved }: { orderId: string; onApproved: () => void }) {
  const { user } = useAuth();
  return user ? <ScopedOrderWorkspace key={`${user.id}:${orderId}`} orderId={orderId} actorId={user.id} onApproved={onApproved} /> : null;
}

function ScopedOrderWorkspace({ orderId, actorId, onApproved }: { orderId: string; actorId: string; onApproved: () => void }) {
  const { isAdmin } = useOperationsAccess();
  const [scope, setScope] = useState<OrderInvestigation | null>(null);
  const [version, setVersion] = useState<InvestigationReviewVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mutation = useRef(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [processingPermitted, setProcessingPermitted] = useState(false);
  const [redistributionPermitted, setRedistributionPermitted] = useState(false);
  const [selectedStep, setSelectedStep] = useState<GuidedInvestigationStepId | null>(null);
  useEffect(() => () => { if (documentUrl) URL.revokeObjectURL(documentUrl); }, [documentUrl]);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setScope(null); setVersion(null); setDocumentUrl(null); setError(null);
    try {
      const current = await readOrderInvestigation(orderId, controller.signal);
      const saved = requireInvestigationResult(await investigationClient.rpc("read_investigation_review", { p_order_id: orderId }).abortSignal(controller.signal));
      const review = saved ? investigationReviewVersionSchema.parse(saved) : null;
      if (review && (review.order_id !== orderId || review.customer_id !== current.customerId || review.parcel_id !== current.parcelId)) throw new Error("The review does not belong to this investigation.");
      if (!mounted.current || controller.signal.aborted || request.current !== controller) return;
      setScope(current); setVersion(review);
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted || request.current !== controller) return;
      setScope(null); setVersion(null); setError(failure instanceof Error ? failure.message : "The investigation could not be loaded.");
    }
  }, [orderId]);
  useEffect(() => { mounted.current = true; void reload(); return () => { mounted.current = false; request.current?.abort(); }; }, [reload]);
  const assembly = useMemo(() => scope ? assembleInvestigation(scope) : null, [scope]);
  const assessment = useMemo(() => scope && assembly ? assessInvestigationSignoff(scope, assembly) : null, [scope, assembly]);
  const journey = useMemo(() => assembly ? buildGuidedInvestigationJourney(assembly.facts, assembly.workspaceState) : [], [assembly]);
  const activeStep = selectedStep ?? journey.find((step) => step.current)?.id ?? "confirm-property";
  const needsAiReviewVersion = !version || version.currentEvidenceRevision !== scope?.revision;
  const needsHumanApproval = !version?.approved_at || version.currentEvidenceRevision !== scope?.revision;
  function nextStep() {
    const index = journey.findIndex((step) => step.id === activeStep);
    setSelectedStep(journey[index + 1]?.id ?? "report");
  }

  async function mutate<T>(action: (current: OrderInvestigation, signal: AbortSignal) => Promise<T>): Promise<T> {
    if (mutation.current || !currentScope.current?.canWork) throw new Error("This investigation is not available for another save yet.");
    mutation.current = true; setBusy(true); setError(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      if (!mounted.current || data.session?.user.id !== actorId) throw new Error("The active account changed. Reload the investigation.");
      const result = await action(currentScope.current, controller.signal);
      const next = await readOrderInvestigation(orderId, controller.signal);
      if (!mounted.current || controller.signal.aborted) throw new Error("The investigation was closed.");
      currentScope.current = next; setScope(next);
      setVersion((saved) => saved ? { ...saved, currentEvidenceRevision: next.revision } : null);
      return result;
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) {
        currentScope.current = null; setScope(null); setVersion(null); setDocumentUrl(null);
        setError(failure instanceof Error ? failure.message : "The save failed.");
      }
      throw failure;
    } finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  const shared: SharedInvestigationScope | null = scope ? {
    snapshot: scope, busy, refresh: reload,
    save: async (patch) => { await mutate(async (current, signal) => {
      await patchOrderInvestigation(orderId, current.revision, normalizeInvestigationPatch(current.parcelId, patch), signal);
    }); },
    files: {
      upload: async (input) => mutate(async (current, signal) => {
        const result = await uploadInvestigationAsset({ orderId, revision: current.revision, category: input.category,
          assetType: input.assetType, sourceLabel: input.sourceLabel,
          file: input.file, fileName: input.fileName, aiProcessingAllowed: processingPermitted,
          redistributionAllowed: redistributionPermitted }, signal);
        const next = await readOrderInvestigation(orderId, signal);
        const asset = next.assets.find((item) => item.id === result.assetId);
        if (!asset) throw new Error("The uploaded file could not be confirmed in this investigation.");
        return { ok: true as const, asset };
      }),
      remove: async (asset) => { await mutate(async (current, signal) => {
        requireInvestigationResult(await investigationClient.rpc("change_order_investigation_asset", {
          p_order_id: orderId, p_asset_id: asset.id, p_expected_revision: current.revision, p_action: "archive",
        }).abortSignal(signal));
      }); },
      confirmIdentity: async (asset) => { await mutate(async (current, signal) => {
        requireInvestigationResult(await investigationClient.rpc("change_order_investigation_asset", {
          p_order_id: orderId, p_asset_id: asset.id, p_expected_revision: current.revision, p_action: "confirm_identity",
        }).abortSignal(signal));
      }); },
      open: async (asset) => {
        request.current?.abort();
        const controller = new AbortController(); request.current = controller;
        setDocumentUrl(null);
        try {
          const blob = await readInvestigationAsset({ orderId, assetId: asset.id }, controller.signal);
          if (mounted.current && !controller.signal.aborted && request.current === controller) setDocumentUrl(URL.createObjectURL(blob));
        } catch (failure) {
          if (mounted.current && !controller.signal.aborted) {
            setScope(null); setVersion(null);
            setError(failure instanceof Error ? failure.message : "The document is unavailable.");
          }
        }
      },
    },
  } : null;

  async function operation(action: (signal: AbortSignal) => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== actorId || !mounted.current) throw new Error("The signed-in account changed. Reload the investigation.");
      await action(controller.signal);
      if (mounted.current && !controller.signal.aborted) await reload();
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) {
        currentScope.current = null; setScope(null); setVersion(null); setDocumentUrl(null);
        setError(failure instanceof Error ? failure.message : "The operation failed. Nothing was approved.");
      }
    } finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }

  return <section aria-label="Customer investigation workspace" className="mt-5 space-y-5 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Customer property investigation</h2>
      <button type="button" className={button} disabled={busy} onClick={() => void reload()}><RefreshCw className="h-4 w-4" /> Reload saved evidence</button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!scope && !error && <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading the selected customer investigation</p>}
    {scope && assembly && assessment && shared && <SharedInvestigationContext.Provider value={shared}>
      <p className="text-xs text-muted-foreground">Customer-owned file · {scope.parcelId} · Evidence revision {scope.revision}</p>
      {isAdmin && <InvestigatorAssignment orderId={orderId} actorId={actorId} customerId={scope.customerId} />}
      <nav aria-label="Customer investigation steps" className="flex flex-wrap gap-2">
        {journey.map((step) => <button type="button" key={step.id} disabled={busy}
          aria-current={activeStep === step.id ? "step" : undefined}
          className={`${button} ${activeStep === step.id ? "border-primary bg-primary/10" : ""}`}
          onClick={() => setSelectedStep(step.id)}>{step.index}. {step.label}{step.complete ? " - Recorded" : ""}</button>)}
      </nav>
      {scope.canWork && <fieldset disabled={busy} className="space-y-4">
        <fieldset className="space-y-2 border-b border-border pb-4"><legend className="mb-2 text-sm font-semibold">Permissions for the next document upload</legend>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={processingPermitted} onChange={(event) => setProcessingPermitted(event.target.checked)} />I have permission to process this document with the existing AI document reader.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={redistributionPermitted} onChange={(event) => setRedistributionPermitted(event.target.checked)} />The document license permits sharing the original with this customer.</label>
        </fieldset>
        {activeStep === "confirm-property" && <section>
          <ConfirmPropertyStep parcel={assembly.parcel} workspaceState={assembly.workspaceState}
            onConfirm={() => void shared.save(toSupabaseJson({ easyErfInvestigation: { ...assembly.workspaceState, identityStatus: "looks_correct" } })).then(nextStep).catch(() => {})}
            onFlagUncertain={() => void shared.save(toSupabaseJson({ easyErfInvestigation: { ...assembly.workspaceState, identityStatus: "uncertain" } })).catch(() => {})}
            onBackToMap={() => { window.location.assign("/"); }} />
        </section>}
        {activeStep === "add-address" && <AddAddressStep parcel={assembly.parcel} userId={actorId} onContinue={nextStep} />}
        {activeStep === "sg-diagram" && <GuidedSgDiagramStep parcel={assembly.parcel} userId={actorId} onContinue={nextStep} />}
        {activeStep === "title" && <section><GuidedTitleStep parcel={assembly.parcel} onContinue={nextStep} onOpenPaidReports={() => { document.getElementById("included-report-boundary")?.scrollIntoView({ block: "center" }); }} />
          <p id="included-report-boundary" className="mt-3 text-sm">The included report is obtained through the existing authorized provider process where available. Do not charge the customer again. Upload or redistribute the original only where its license permits.</p>
        </section>}
        {activeStep === "property-checks" && <GuidedPropertyChecksStep parcel={assembly.parcel} onContinue={nextStep} />}
        {activeStep === "zoning" && <GuidedZoningStep parcel={assembly.parcel} onContinue={nextStep} />}
        {activeStep === "market" && <section className="space-y-4"><MarketEvidenceTab parcel={assembly.parcel} />
          <button type="button" className={button} onClick={nextStep}>Continue to Strategy</button></section>}
        {activeStep === "strategy" && <StrategyLab parcel={assembly.parcel} parcelId={scope.parcelId} defaultPrice={0}
          guidedReturn={{ onBack: () => setSelectedStep("market"), onContinue: nextStep }} />}
        {activeStep === "site-potential" && <SitePotentialTab parcel={assembly.parcel} parcelRing={assembly.ring}
          recordedAreaM2={canonicalAreaM2(assembly.parcel.rawProperties)} workspaceState={assembly.workspaceState}
          onUpdateSite={(patch) => { void shared.save(toSupabaseJson({ easyErfInvestigation: {
            ...assembly.workspaceState, sitePotential: { ...assembly.workspaceState.sitePotential, ...patch },
          } })).catch(() => {}); }}
          onExploreReport={() => setSelectedStep("report")}
          onOpenTab={(tab) => setSelectedStep(tab === "zoning-build" ? "zoning" : "property-checks")} />}
      </fieldset>}
      {scope.canWork && <InvestigationWorkEditor key={JSON.stringify(scope.userData.investigationWork ?? {})}
        value={scope.userData.investigationWork} assets={scope.assets} disabled={busy} onSave={(work) => shared.save(toSupabaseJson({ investigationWork: work }))} />}
      <ul aria-label="Evidence required for approval" className="grid gap-2 sm:grid-cols-2">{assessment.items.map((item) => <li key={item.id} className="border-b border-border py-2 text-sm">
        <strong>{item.label}</strong><p>{item.supported ? "Recorded evidence available" : item.disposition ? "Recorded limitation awaiting reviewer disposition" : "Work still required"}</p>
      </li>)}</ul>
      {activeStep === "report" && <section className="space-y-5">
      {scope.canWork && needsAiReviewVersion && <button type="button" className={button} disabled={busy} title="Optional AI-assisted draft" onClick={() => void operation(async (signal) => {
        await requestInvestigationReview({ action: "generate", orderId }, signal);
      })}><Sparkles className="h-4 w-4" /> Generate investigation brief</button>}
      {scope.canApprove && needsHumanApproval && <HumanOnlyReviewEditor disabled={busy} eligible={assessment.eligible} blockers={assessment.blockers}
        onApprove={(content) => operation(async (signal) => {
          await requestInvestigationReview({ action: "human_approve", orderId, content: toSupabaseJson(content) }, signal);
          onApproved();
        })} />}
      {version && version.provider_model !== HUMAN_ONLY_REVIEW_MODEL && <BriefEditor key={version.id} version={version} disabled={busy || !scope.canWork}
        onSave={(brief) => operation(async (signal) => {
          requireInvestigationResult(await investigationClient.rpc("edit_investigation_brief", {
            p_order_id: orderId, p_version_id: version.id, p_expected_brief_revision: version.brief_revision, p_brief: brief,
          }).abortSignal(signal));
        })} />}
      {version && version.provider_model !== HUMAN_ONLY_REVIEW_MODEL && scope.canApprove && <div>
        <button type="button" className={button} disabled={busy || !assessment.eligible || version.evidence_revision !== scope.revision || Boolean(version.approved_at)}
          onClick={() => void operation(async (signal) => {
            await requestInvestigationReview({ action: "approve", orderId, versionId: version.id, briefRevision: version.brief_revision }, signal);
            onApproved();
          })}><ShieldCheck className="h-4 w-4" /> Approve this evidence and brief version</button>
        {!assessment.eligible && <p className="mt-2 text-sm">Unresolved: {assessment.blockers.join("; ")}</p>}
      </div>}
      <SharedInvestigationReport orderId={orderId} assembly={version?.report_assembly ?? assembly} version={version ?? undefined} />
      </section>}
      {documentUrl && <section aria-label="Selected investigation document" className="border border-border p-3">
        <button type="button" className={button} onClick={() => setDocumentUrl(null)}>Close document</button>
        <object data={documentUrl} className="mt-3 h-[65vh] w-full"><a href={documentUrl} download>Download selected document</a></object>
      </section>}
    </SharedInvestigationContext.Provider>}
  </section>;
}

function InvestigationWorkEditor({ value, assets, disabled, onSave }: {
  value: unknown; assets: OrderInvestigation["assets"]; disabled: boolean; onSave: (work: Record<string, unknown>) => Promise<void>;
}) {
  const existing = recordedInvestigationWork(value);
  const [itemId, setItemId] = useState("property_checks");
  const empty = { source: "", checkedAt: "", result: "", reason: "", limitation: "", disposition: "reviewed" as const };
  const [draft, setDraft] = useState<InvestigationAttempt>(() => existing.find((item) => item.id === "property_checks") ?? empty);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = investigationAttemptSchema.safeParse({ ...draft, checkedAt: draft.checkedAt.length === 10 ? `${draft.checkedAt}T00:00:00.000Z` : draft.checkedAt });
    if (!parsed.success) { setError("Record the source, date checked, actual result, reason and remaining limitation."); return; }
    try {
      const current = z.record(z.unknown()).safeParse(value);
      await onSave({ ...(current.success ? current.data : {}), [itemId]: parsed.data });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The source check was not saved."); }
  }
  return <details className="border-y border-border py-4">
    <summary className="cursor-pointer font-semibold">Record checks, unavailable evidence and limitations</summary>
    <form onSubmit={(event) => void save(event)} className="mt-4 space-y-3">
      <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Investigation section<select className="mt-1 min-h-11 w-full rounded-md border border-border p-2" value={itemId}
          onChange={(event) => { setItemId(event.target.value); setDraft(existing.find((item) => item.id === event.target.value) ?? empty); }}>
          {DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.filter((item) => item.id !== "reviewed_report").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        <label className="text-sm">Recorded outcome<select className="mt-1 min-h-11 w-full rounded-md border border-border p-2" value={draft.disposition}
          onChange={(event) => { const parsed = investigationAttemptSchema.shape.disposition.parse(event.target.value); setDraft({ ...draft, disposition: parsed }); }}>
          <option value="reviewed">Source checked</option><option value="unavailable">Evidence unavailable after checking</option><option value="not_applicable">Not applicable, with reason</option>
        </select></label>
        <label className="text-sm">Source checked<input required maxLength={500} className="mt-1 min-h-11 w-full rounded-md border border-border p-2"
          value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
        <fieldset className="space-y-2 text-sm"><legend>Documents used for this finding</legend>
          {assets.map((asset) => <label key={asset.id} className="flex items-start gap-2">
            <input type="checkbox" checked={draft.sourceAssetIds?.includes(asset.id) ?? false}
              onChange={(event) => setDraft({ ...draft, sourceAssetIds: event.target.checked
                ? [...(draft.sourceAssetIds ?? []), asset.id] : (draft.sourceAssetIds ?? []).filter((id) => id !== asset.id) })} />
            {asset.original_file_name}
          </label>)}
        </fieldset>
        <label className="text-sm">Date checked<input required type="date" className="mt-1 min-h-11 w-full rounded-md border border-border p-2"
          value={draft.checkedAt.slice(0, 10)} onChange={(event) => setDraft({ ...draft, checkedAt: event.target.value })} /></label>
        {(["result", "reason", "limitation"] as const).map((key) => <label key={key} className="text-sm sm:col-span-2">
          {{ result: "Actual result and findings", reason: "Reason and relevance to this property", limitation: "Remaining limitation or next verification" }[key]}
          <textarea required maxLength={key === "result" ? 2000 : 1000} className="mt-1 min-h-24 w-full rounded-md border border-border p-2"
            value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
        </label>)}
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" className={button} disabled={disabled}><Save className="h-4 w-4" /> Save source check</button>
    </form>
  </details>;
}

function BriefEditor({ version, disabled, onSave }: { version: InvestigationReviewVersion; disabled: boolean; onSave: (brief: Json) => Promise<void> }) {
  const initial = validateInvestigationBrief(version.edited_brief, version.report_assembly.pack.sources.map((source) => source.id));
  const [brief, setBrief] = useState(initial);
  if (!brief) return <p role="alert">The brief is invalid and cannot be approved.</p>;
  return <section aria-label="Edit evidence-linked brief" className="space-y-4 border-y border-border py-5">
    <h3 className="font-semibold">Review and edit the AI draft</h3>
    {(["bottomLine", "known", "potential", "risks", "unknowns", "nextSteps"] as const).map((key) => {
      const values = key === "bottomLine" ? [brief.bottomLine] : brief[key];
      const labels = { bottomLine: "Bottom line", known: "Supported facts", potential: "What appears possible", risks: "Risks and contradictions", unknowns: "Unknowns", nextSteps: "Next checks" };
      return <fieldset key={key} className="space-y-2" disabled={disabled}><legend className="mb-2 text-sm font-semibold">{labels[key]}</legend>
        {values.map((statement, index) => <div key={index}><textarea aria-label={`${labels[key]} ${index + 1}`} className="min-h-24 w-full rounded-md border border-border p-3 text-sm"
          value={statement.text} maxLength={key === "bottomLine" ? 1400 : 700} onChange={(event) => {
            const changed = { ...statement, text: event.target.value };
            setBrief({ ...brief, [key]: key === "bottomLine" ? changed : values.map((value, i) => i === index ? changed : value) });
          }} /><p className="text-xs text-muted-foreground">Sources: {statement.sourceRefs.join(", ")}</p></div>)}
      </fieldset>;
    })}
    <button type="button" className={button} disabled={disabled} onClick={() => void onSave(z.record(z.unknown()).parse(brief) as Json)}><Save className="h-4 w-4" /> Save review edits</button>
  </section>;
}

function InvestigatorAssignment({ orderId, actorId, customerId }: { orderId: string; actorId: string; customerId: string }) {
  const [workerId, setWorkerId] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function assign(revoke: boolean) {
    const parsed = z.string().uuid().safeParse(workerId.trim());
    if (!parsed.success || parsed.data === customerId) { setResult("Choose an existing investigator account UUID, not the customer's account."); return; }
    if (pending) return;
    const active = new AbortController(); controller.current = active;
    setPending(true); setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (active.signal.aborted || data.session?.user.id !== actorId) throw new Error("The active account changed.");
      requireInvestigationResult(await investigationClient.rpc("assign_order_investigator", {
        p_order_id: orderId, p_worker_id: parsed.data, p_can_approve: canApprove, p_revoke: revoke,
      }).abortSignal(active.signal));
      if (!active.signal.aborted) setResult(revoke ? "Access revoked for this investigation." : "Investigator assigned to this customer file.");
    } catch (failure) {
      if (!active.signal.aborted) setResult(failure instanceof Error ? failure.message : "Assignment was not changed.");
    } finally { if (!active.signal.aborted) setPending(false); }
  }
  return <details className="border-y border-border py-3">
    <summary className="cursor-pointer font-semibold">Investigator access</summary>
    <fieldset disabled={pending} className="mt-3 space-y-3">
      <label className="block text-sm">Existing investigator account UUID<input className="mt-1 min-h-11 w-full rounded-md border border-border p-2"
        value={workerId} onChange={(event) => setWorkerId(event.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canApprove} onChange={(event) => setCanApprove(event.target.checked)} />May approve the evidence-linked report</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => void assign(false)}>Assign investigator</button>
        <button type="button" className={button} onClick={() => void assign(true)}>Revoke access</button>
      </div>
    </fieldset>
    {result && <p role="status" className="mt-2 text-sm">{result}</p>}
  </details>;
}
