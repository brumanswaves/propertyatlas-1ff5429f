import { z } from "zod";
import { investigationSnapshotSchema, type InvestigationAssembly } from "./sharedInvestigation";
import { validateInvestigationBrief } from "../../../supabase/functions/_shared/investigationBrief";

// Assembly is written only by the authenticated server with a service-only RPC.
// Check its stored contract and scope; never rebuild a delivered version against newer planning rules.
const assemblyEnvelope = z.object({
  parcel: z.object({ id: z.string() }),
  pack: z.object({ parcelId: z.string(), sources: z.array(z.object({ id: z.string() })),
    claims: z.array(z.object({ id: z.string() })), contradictions: z.array(z.unknown()) }),
  report: z.object({ brief: z.object({ readinessPercent: z.number() }) }),
  document: z.object({ header: z.object({ title: z.string() }), atAGlance: z.array(z.unknown()) }),
  workspaceState: z.object({}), planning: z.object({}), facts: z.object({}), work: z.array(z.object({})),
  strategyAnalysis: z.object({ requiredInputsComplete: z.boolean() }),
  appendix: z.array(z.unknown()), sg: z.object({}), market: z.object({}), strategy: z.object({}), site: z.object({}),
  askSuggestions: z.object({ parcelId: z.string() }), siteRisk: z.object({}), municipal: z.object({}), location: z.object({}),
});
const storedAssembly = z.custom<InvestigationAssembly>((value) => assemblyEnvelope.safeParse(value).success);
export const investigationReviewVersionSchema = z.object({
  id: z.string().uuid(), order_id: z.string().uuid(), customer_id: z.string().uuid(), parcel_id: z.string(),
  evidence_revision: z.number().int(), brief_revision: z.number().int(), version_sequence: z.number().int(),
  evidence_snapshot: investigationSnapshotSchema, report_assembly: storedAssembly,
  generated_brief: z.unknown(), edited_brief: z.unknown(), provider_model: z.string(), generated_at: z.string(),
  approved_by: z.string().uuid().nullable(), approved_reviewer_label: z.string().nullable(),
  approved_at: z.string().nullable(), delivered_at: z.string().nullable(), currentEvidenceRevision: z.number().int(),
}).superRefine((value, ctx) => {
  if (value.parcel_id !== value.evidence_snapshot.parcelId || value.parcel_id !== value.report_assembly.parcel.id
    || value.parcel_id !== value.report_assembly.pack.parcelId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Stored report scope does not match." });
  }
  if (!validateInvestigationBrief(value.edited_brief, value.report_assembly.pack.sources.map((source) => source.id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Stored brief is missing its evidence references." });
  }
});
export type InvestigationReviewVersion = z.infer<typeof investigationReviewVersionSchema>;
