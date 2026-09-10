import { z } from "zod";
import { ApiRequestError, authenticateApiRequest, createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";
import { readServerEnv } from "@/lib/sitePotential/runtimeEnv";
import { toSupabaseJson } from "@/lib/supabase/json";
import { assembleInvestigation, assessInvestigationSignoff, buildInvestigationModelPackage, investigationInputManifest, investigationSnapshotSchema, orderInvestigationSchema } from "./sharedInvestigation";
import { HUMAN_ONLY_REVIEW_MODEL, investigationReviewVersionSchema } from "./investigationReviewVersion";
import { INVESTIGATION_BRIEF_MODEL, validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";
import { validateHumanReviewReportContent } from "../../../supabase/functions/_shared/easyErfHumanReviewContract";
import { buildAskEasyErfSelectedEvidencePayload, calibrateAskEasyErfAnswerConfidence } from "@/lib/reports/askEasyErf";
import { askEasyErfViaEdgeFunction } from "@/lib/reports/askEasyErfClient";
import { acquireIndependentEvidence } from "./independentEvidence.server";
import { assessModelPackageQuality, buildRestrictedModelPackage, withModelEvidence } from "./restrictedModelPackage.server";

const REVIEW_REQUEST_MAX_BYTES = 65_536;
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), orderId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("human_approve"), orderId: z.string().uuid(), content: z.unknown() }).strict(),
  z.object({ action: z.literal("approve"), orderId: z.string().uuid(), versionId: z.string().uuid(), briefRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("ask"), orderId: z.string().uuid(), versionId: z.string().uuid(), question: z.string().trim().min(1).max(2000) }).strict(),
]);

export interface InvestigationReviewServerDeps {
  authenticate?: typeof authenticateApiRequest;
  serviceClient?: typeof createServiceRoleSupabaseClient;
  env?: typeof readServerEnv;
  fetchImpl?: typeof fetch;
  publicEvidenceFetch?: typeof fetch;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function checkError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "40001") throw new ApiRequestError("This investigation changed. Reload the current evidence before proceeding.", 409);
  if (error.code === "42501") throw new ApiRequestError("Access to this investigation is unavailable.", 403);
  throw new ApiRequestError("The investigation operation could not be completed.", 409);
}
function approvalChecklist(assessment: ReturnType<typeof assessInvestigationSignoff>) {
  return Object.fromEntries([
    ...assessment.items.map((item) => [item.id, item.disposition?.disposition === "not_applicable" && !item.supported ? "not_applicable" : "complete"]),
    ["reviewed_report", "complete"],
  ]);
}

export async function handleInvestigationReviewRequest(request: Request, deps: InvestigationReviewServerDeps = {}) {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const auth = await (deps.authenticate ?? authenticateApiRequest)(request);
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > REVIEW_REQUEST_MAX_BYTES) return json({ error: "Request too large." }, 413);
    const parsed = requestSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return json({ error: "Invalid investigation request." }, 400);
    const input = parsed.data;
    const { data, error } = await auth.supabase.rpc("read_order_investigation", { p_order_id: input.orderId });
    checkError(error);
    const scope = orderInvestigationSchema.parse(data);
    const env = deps.env ?? readServerEnv;
    if (input.action === "generate") {
      if (!scope.canWork) return json({ error: "Assigned investigator access is required." }, 403);
      const assembly = assembleInvestigation(scope);
      const initial = buildInvestigationModelPackage(scope, assembly);
      const independent = initial.provenance.userMaterialPermitted ? undefined
        : await acquireIndependentEvidence(scope.parcelId, deps.publicEvidenceFetch);
      const evidencePackage = buildRestrictedModelPackage(scope, assembly, independent);
      const quality = assessModelPackageQuality(evidencePackage);
      if (!quality.useful) return json({ error: quality.reason, quality }, 422);
      const current = await auth.supabase.rpc("read_order_investigation", { p_order_id: input.orderId });
      checkError(current.error);
      const latest = orderInvestigationSchema.parse(current.data);
      if (!latest.canWork || latest.orderId !== scope.orderId || latest.customerId !== scope.customerId
        || latest.parcelId !== scope.parcelId || latest.revision !== scope.revision
        || JSON.stringify(latest.processingSources) !== JSON.stringify(scope.processingSources)
        || JSON.stringify(latest.assets) !== JSON.stringify(scope.assets)) {
        return json({ error: "Investigation access, evidence or processing permission changed. Nothing was sent to AI." }, 409);
      }
      const functionSecret = env("ASK_EASY_ERF_FN_SECRET") ?? env("SUPABASE_SERVICE_ROLE_KEY");
      const url = env("SUPABASE_URL");
      if (!functionSecret || !url) return json({ error: "Investigation AI review is not configured. No review was generated." }, 503);
      const allowedSourceIds = evidencePackage.evidence.sources.map((source) => source.id);
      const generated = await (deps.fetchImpl ?? fetch)(`${url.replace(/\/$/, "")}/functions/v1/ask-easy-erf-openai`, {
        method: "POST", signal: AbortSignal.timeout(95_000),
        headers: { Authorization: `Bearer ${functionSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "investigation_brief", evidencePackage, allowedSourceIds }),
      });
      if (!generated.ok) return json({ error: "AI review is unavailable. No draft or approval was saved." }, 503);
      const payload = z.object({ success: z.literal(true), brief: z.unknown(), model: z.literal(INVESTIGATION_BRIEF_MODEL) }).parse(await generated.json());
      const brief = validateInvestigationBrief(payload.brief, allowedSourceIds);
      if (!brief) return json({ error: "The generated review failed evidence validation. Nothing was approved." }, 502);
      const service = (deps.serviceClient ?? createServiceRoleSupabaseClient)();
      const recorded = await service.rpc("record_investigation_brief", {
        p_order_id: input.orderId, p_actor_id: auth.user.id, p_expected_revision: scope.revision,
        p_assembly: withModelEvidence(assembly, evidencePackage), p_manifest: investigationInputManifest(scope), p_assessment: assessInvestigationSignoff(scope, assembly),
        p_brief: brief, p_model: payload.model,
      });
      checkError(recorded.error);
      return json({ versionId: z.string().uuid().parse(recorded.data), approved: false });
    }

    if (input.action === "human_approve") {
      if (!scope.canApprove) return json({ error: "Approval permission is required." }, 403);
      const validated = validateHumanReviewReportContent(input.content);
      if (!validated.ok) return json({ error: validated.error }, 409);

      const current = await auth.supabase.rpc("read_order_investigation", { p_order_id: input.orderId });
      checkError(current.error);
      const latest = orderInvestigationSchema.parse(current.data);
      if (!latest.canApprove || latest.orderId !== scope.orderId || latest.customerId !== scope.customerId
        || latest.parcelId !== scope.parcelId || latest.revision !== scope.revision) {
        return json({ error: "Investigation access or evidence changed. Review the current property file before approval." }, 409);
      }
      const assembly = assembleInvestigation(latest);
      const assessment = assessInvestigationSignoff(latest, assembly);
      if (!assessment.eligible) return json({ error: "Investigation work is unfinished.", blockers: assessment.blockers }, 409);

      const service = (deps.serviceClient ?? createServiceRoleSupabaseClient)();
      const created = await service.from("investigation_review_versions").insert({
        order_id: input.orderId,
        customer_id: latest.customerId,
        parcel_id: latest.parcelId,
        evidence_revision: latest.revision,
        evidence_snapshot: toSupabaseJson(investigationSnapshotSchema.parse(latest)),
        report_assembly: toSupabaseJson(assembly),
        evidence_manifest: [],
        signoff_assessment: toSupabaseJson(assessment),
        generated_brief: toSupabaseJson(validated.content),
        edited_brief: toSupabaseJson(validated.content),
        provider_model: HUMAN_ONLY_REVIEW_MODEL,
        generated_by: auth.user.id,
        brief_revision: 1,
      }).select("id").single();
      checkError(created.error);
      const versionId = z.string().uuid().parse(created.data?.id);
      const approval = await service.rpc("approve_investigation_review", {
        p_order_id: input.orderId, p_version_id: versionId, p_actor_id: auth.user.id, p_expected_brief_revision: 1,
        p_validated_content: { ...validated.content, investigationChecklist: approvalChecklist(assessment) },
      });
      checkError(approval.error);
      return json({ approved: true, versionId, delivered: false, reviewMode: HUMAN_ONLY_REVIEW_MODEL });
    }

    const selected = await auth.supabase.rpc("read_investigation_review", { p_order_id: input.orderId, p_version_id: input.versionId });
    checkError(selected.error);
    const version = investigationReviewVersionSchema.parse(selected.data);
    if (version.order_id !== input.orderId || version.customer_id !== scope.customerId || version.parcel_id !== scope.parcelId) {
      return json({ error: "Review scope does not match the selected investigation." }, 409);
    }
    const assembly = version.report_assembly;
    if (input.action === "ask") {
      if (version.provider_model === HUMAN_ONLY_REVIEW_MODEL) {
        return json({ error: "Ask Easy Erf is unavailable for this human-only reviewed version. Nothing was sent to AI." }, 409);
      }
      if (!assembly.modelEvidencePack || assembly.modelEvidencePack.parcelId !== version.parcel_id) {
        return json({ error: "This saved report has no permitted question evidence. No new evidence was substituted." }, 409);
      }
      const currentPermissions = new Map((scope.processingSources ?? []).map((source) => [source.assetId, source.aiProcessingAllowed]));
      if (scope.processingSources == null || version.evidence_snapshot.processingSources == null
        || version.evidence_snapshot.processingSources.some((source) => source.aiProcessingAllowed
          && currentPermissions.get(source.assetId) !== true)) {
        return json({ error: "Document processing permission for this saved report is unavailable. Nothing was sent to AI." }, 409);
      }
      const evidence = buildAskEasyErfSelectedEvidencePayload({ pack: assembly.modelEvidencePack, question: input.question });
      const result = await askEasyErfViaEdgeFunction({ parcelId: version.parcel_id, question: input.question, evidence,
        accessToken: auth.token, signal: request.signal,
        deps: { fetchImpl: deps.fetchImpl, functionsUrl: `${env("SUPABASE_URL")}/functions/v1/ask-easy-erf-openai`,
          apiKey: env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY") },
      });
      return json(result.success ? { ...result, answer: calibrateAskEasyErfAnswerConfidence({ answer: result.answer,
        selectedEvidence: evidence, readinessPercent: assembly.report.brief.readinessPercent }) } : result);
    }
    if (!scope.canApprove) return json({ error: "Approval permission is required." }, 403);
    if (scope.revision !== version.evidence_revision || input.briefRevision !== version.brief_revision) {
      return json({ error: "The evidence or brief changed. Review the current version." }, 409);
    }
    const assessment = assessInvestigationSignoff(scope, assembleInvestigation(scope));
    if (!assessment.eligible) return json({ error: "Investigation work is unfinished.", blockers: assessment.blockers }, 409);
    const brief = validateInvestigationBrief(version.edited_brief, assembly.pack.sources.map((source) => source.id));
    if (!brief) return json({ error: "The edited review contains invalid or missing source references." }, 409);
    const content = { bottomLine: brief.bottomLine.text, known: brief.known.map((s) => s.text), potential: brief.potential.map((s) => s.text),
      risks: brief.risks.map((s) => s.text), unknowns: brief.unknowns.map((s) => s.text), nextSteps: brief.nextSteps.map((s) => s.text) };
    const validated = validateHumanReviewReportContent(content);
    if (!validated.ok) return json({ error: validated.error }, 409);
    const service = (deps.serviceClient ?? createServiceRoleSupabaseClient)();
    const approval = await service.rpc("approve_investigation_review", {
      p_order_id: input.orderId, p_version_id: input.versionId, p_actor_id: auth.user.id, p_expected_brief_revision: input.briefRevision,
      p_validated_content: { ...validated.content, investigationChecklist: approvalChecklist(assessment) },
    });
    checkError(approval.error);
    return json({ approved: true, versionId: input.versionId, delivered: false });
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Investigation data could not be validated." }, 400);
    return json({ error: "Investigation review is unavailable. Nothing was approved or delivered." }, 503);
  }
}