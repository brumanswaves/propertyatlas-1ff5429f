import { z } from "zod";
import { ApiRequestError, authenticateApiRequest, createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";
import { readServerEnv } from "@/lib/sitePotential/runtimeEnv";
import { assembleInvestigation, assessInvestigationSignoff, buildInvestigationModelPackage, investigationInputManifest, orderInvestigationSchema } from "./sharedInvestigation";
import { investigationReviewVersionSchema } from "./investigationReviewVersion";
import { INVESTIGATION_BRIEF_MODEL, validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";
import { validateHumanReviewReportContent } from "../../../supabase/functions/_shared/easyErfHumanReviewContract";
import { buildAskEasyErfSelectedEvidencePayload, calibrateAskEasyErfAnswerConfidence } from "@/lib/reports/askEasyErf";
import { askEasyErfViaEdgeFunction } from "@/lib/reports/askEasyErfClient";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), orderId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("approve"), orderId: z.string().uuid(), versionId: z.string().uuid(), briefRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("ask"), orderId: z.string().uuid(), versionId: z.string().uuid(), question: z.string().trim().min(1).max(2000) }).strict(),
]);

export interface InvestigationReviewServerDeps {
  authenticate?: typeof authenticateApiRequest;
  serviceClient?: typeof createServiceRoleSupabaseClient;
  env?: typeof readServerEnv;
  fetchImpl?: typeof fetch;
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

export async function handleInvestigationReviewRequest(request: Request, deps: InvestigationReviewServerDeps = {}) {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const auth = await (deps.authenticate ?? authenticateApiRequest)(request);
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 8192) return json({ error: "Request too large." }, 413);
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
      const evidencePackage = buildInvestigationModelPackage(scope, assembly);
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
        p_assembly: { ...assembly, modelEvidencePack: evidencePackage.evidence }, p_manifest: investigationInputManifest(scope), p_assessment: assessInvestigationSignoff(scope, assembly),
        p_brief: brief, p_model: payload.model,
      });
      checkError(recorded.error);
      return json({ versionId: z.string().uuid().parse(recorded.data), approved: false });
    }

    const selected = await auth.supabase.rpc("read_investigation_review", { p_order_id: input.orderId, p_version_id: input.versionId });
    checkError(selected.error);
    const version = investigationReviewVersionSchema.parse(selected.data);
    if (version.order_id !== input.orderId || version.customer_id !== scope.customerId || version.parcel_id !== scope.parcelId) {
      return json({ error: "Review scope does not match the selected investigation." }, 409);
    }
    const assembly = version.report_assembly;
    if (input.action === "ask") {
      // Only immutable delivered evidence is used for a customer; SQL excludes undelivered versions.
      if (!assembly.modelEvidencePack || assembly.modelEvidencePack.parcelId !== version.parcel_id) {
        return json({ error: "This saved report has no permitted question evidence. No new evidence was substituted." }, 409);
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
      p_validated_content: { ...validated.content, investigationChecklist: Object.fromEntries([
        ...assessment.items.map((item) => [item.id, item.disposition?.disposition === "not_applicable" && !item.supported ? "not_applicable" : "complete"]),
        ["reviewed_report", "complete"],
      ]) },
    });
    checkError(approval.error);
    return json({ approved: true, versionId: input.versionId, delivered: false });
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Investigation data could not be validated." }, 400);
    return json({ error: "Investigation review is unavailable. Nothing was approved or delivered." }, 503);
  }
}
