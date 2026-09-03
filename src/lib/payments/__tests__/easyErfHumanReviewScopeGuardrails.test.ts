import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HUMAN_REVIEW_FOCUS_VALUES,
  HUMAN_REVIEW_INTENDED_USE_VALUES,
  HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS,
  HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES,
  isHumanReviewInvestigationChecklistResolved,
  validateHumanReviewCheckoutRequest,
  validateHumanReviewInvestigationChecklist,
  validateHumanReviewReportContent,
} from "../../../../supabase/functions/_shared/easyErfHumanReviewContract";
import {
  DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS,
  DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS,
  HUMAN_REVIEW_CORE_QUESTIONS,
  HUMAN_REVIEW_NOT_INCLUDED,
  HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT,
  HUMAN_REVIEW_SCOPE_BOUNDARY,
} from "@/lib/humanReview/scope";
import {
  createPendingHumanReviewInvestigationChecklist,
  HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES as CLIENT_CHECKLIST_STATUSES,
  isHumanReviewInvestigationChecklistResolved as isClientChecklistResolved,
  parseHumanReviewInvestigationChecklist,
} from "@/lib/humanReview/reportContent";
import { BRAND } from "@/lib/brand";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const pricing = source("src/routes/pricing.tsx");
const checkout = source("supabase/functions/easy-erf-r999-checkout/index.ts");
const webhook = source("supabase/functions/easy-erf-stripe-webhook/index.ts");
const founderContent = source("supabase/functions/easy-erf-founder-review-content/index.ts");
const migration = source(
  "supabase/migrations/20260831160318_controlled_human_review_product_v2.sql",
);
const checklistMigration = source(
  "supabase/migrations/20260903111500_require_resolved_founder_investigation_checklist.sql",
);
const founderFulfillment = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");
const config = source("supabase/config.toml");
const workbench = source("src/components/property/OfficialParcelPanel.tsx");
const dossier = source("src/components/property/ErfResearchDossier.tsx");
const orders = source("src/routes/orders.tsx");
const founderQueue = source("src/routes/admin.fulfillment.tsx");
const founderEditor = source("src/components/admin/FounderHumanReviewEditor.tsx");
const humanReviewWorkflow = source(".github/workflows/easy-erf-human-review-product.yml");
const reportOpening = source("src/components/property/dossier/ReportOpening.tsx");
const humanReviewedReport = source("src/components/humanReview/HumanReviewedReport.tsx");

describe("Easy Erf controlled paid investigation contract", () => {
  it("keeps three supported emphasis choices and six supported intended uses", () => {
    expect(HUMAN_REVIEW_FOCUS_VALUES).toEqual([
      "property_check",
      "property_potential",
      "intended_use",
    ]);
    expect(HUMAN_REVIEW_INTENDED_USE_VALUES).toEqual([
      "single_dwelling",
      "second_dwelling",
      "renovate_extend",
      "subdivide",
      "rental_property",
      "vacant_land_hold",
    ]);
    expect(HUMAN_REVIEW_CORE_QUESTIONS).toEqual([
      "What do we know?",
      "What appears possible?",
      "What could be a problem?",
      "What do we not know yet?",
      "What should be verified next?",
    ]);
    expect(DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps one stable nine-item operational checklist contract across client and backend", () => {
    expect(HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS).toEqual(
      DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.map((item) => item.id),
    );
    expect(HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES).toEqual([
      "pending",
      "complete",
      "blocked",
      "not_applicable",
    ]);
    expect(CLIENT_CHECKLIST_STATUSES).toEqual(HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES);

    const pending = createPendingHumanReviewInvestigationChecklist();
    expect(Object.values(pending).every((status) => status === "pending")).toBe(true);
    expect(isClientChecklistResolved(pending)).toBe(false);

    const resolved = Object.fromEntries(
      HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS.map((id, index) => [
        id,
        index === 7 ? "not_applicable" : "complete",
      ]),
    );
    expect(validateHumanReviewInvestigationChecklist(resolved)).toMatchObject({ ok: true });
    expect(isHumanReviewInvestigationChecklistResolved(resolved)).toBe(true);
    expect(
      parseHumanReviewInvestigationChecklist({ investigationChecklist: resolved }),
    ).toEqual(resolved);

    expect(
      validateHumanReviewInvestigationChecklist({
        ...resolved,
        site_potential: "blocked",
      }),
    ).toMatchObject({ ok: true });
    expect(
      isHumanReviewInvestigationChecklistResolved({
        ...resolved,
        site_potential: "blocked",
      }),
    ).toBe(false);
    expect(
      validateHumanReviewInvestigationChecklist({
        ...resolved,
        unexpected_task: "complete",
      }),
    ).toMatchObject({ ok: false });
  });

  it("accepts context but refuses unsupported or scope-expanding checkout briefs", () => {
    expect(validateHumanReviewCheckoutRequest({ focus: "property_check", context: "Considering buying the erf.", scopeAcknowledged: true })).toMatchObject({ ok: true });
    expect(validateHumanReviewCheckoutRequest({ focus: "legal_advice", context: "Tell me my legal rights.", scopeAcknowledged: true })).toMatchObject({ ok: false });
    expect(validateHumanReviewCheckoutRequest({ focus: "intended_use", intendedUse: null, scopeAcknowledged: true })).toMatchObject({ ok: false });
    expect(validateHumanReviewCheckoutRequest({ focus: "property_check", intendedUse: "second_dwelling", scopeAcknowledged: true })).toMatchObject({ ok: false });
    expect(validateHumanReviewCheckoutRequest({ focus: "property_check", context: "x".repeat(501), scopeAcknowledged: true })).toMatchObject({ ok: false });
    expect(validateHumanReviewCheckoutRequest({ focus: "property_check", context: "Brief context only.", scopeAcknowledged: false })).toMatchObject({ ok: false });
  });

  it("requires a structured five-part founder report instead of arbitrary prose", () => {
    expect(validateHumanReviewReportContent({
      bottomLine: "Evidence supports a working conclusion with municipal confirmation still required.",
      known: ["The official parcel identity is supported."],
      potential: ["Available planning evidence suggests a residential use may be relevant."],
      risks: ["A planning confirmation remains outstanding."],
      unknowns: ["No approved building plan was reviewed."],
      nextSteps: ["Confirm the planning position with the municipality or town planner."],
    })).toMatchObject({ ok: true });
    expect(validateHumanReviewReportContent({ bottomLine: "", known: [], potential: [], risks: [], unknowns: [], nextSteps: [] })).toMatchObject({ ok: false });
  });

  it("keeps customer copy inside due-diligence scope while making the paid product a full standard investigation", () => {
    expect(pricing).toContain("Tell the reviewer what you are considering.");
    expect(pricing).toContain("Every R999 order includes the standard Easy Erf investigation");
    expect(pricing).toContain("This choice sets the emphasis");
    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_BOUNDARY}");
    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}");
    expect(pricing).toContain("scopeAcknowledged");
    expect(pricing).toContain("HUMAN_REVIEW_NOT_INCLUDED.map");
    expect(pricing).toContain("does not invent a construction quotation or per-m² build-cost estimate");
    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain("does not provide legal, tax, engineering, architectural, valuation");
    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain("buy / do-not-buy recommendation");
    expect(HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT).toContain("not legal, engineering");
    expect(HUMAN_REVIEW_NOT_INCLUDED).toContain("Formal property valuations");
    expect(HUMAN_REVIEW_NOT_INCLUDED).toContain("Construction quotations or Easy Erf-generated build-cost estimates");
    expect(pricing).not.toMatch(/what do you want to know/i);
    expect(pricing).not.toMatch(/ask us anything/i);
  });
});

describe("Easy Erf controlled R999 payment handoff", () => {
  it("binds the controlled brief to the signed-in Easy Erf user before returning Stripe", () => {
    expect(pricing).toContain("Sign in before payment so the paid done-for-you investigation");
    expect(pricing).toContain("supabase.auth.getUser()");
    expect(checkout).toContain("validateHumanReviewCheckoutRequest(body)");
    expect(checkout).toContain("bearerToken(request)");
    expect(checkout).toContain("admin.auth.getUser(token)");
    expect(checkout).toContain('.from("human_review_requests")');
    expect(checkout).toContain("user_id: user.id");
    expect(checkout).toContain("scope_acknowledged_at: new Date().toISOString()");
    expect(checkout).toContain('verifiedUrl.searchParams.set("client_reference_id", requestRow.id)');
    expect(checkout).toContain("link.livemode");
    expect(checkout).toContain("price.unit_amount !== 99900");
    expect(checkout).not.toContain("checkout.sessions.create");
    expect(checkout).not.toContain("paymentIntents.create");
  });

  it("attaches the controlled brief and authenticated owner only after signed Stripe payment", () => {
    expect(webhook).toContain("resolveHumanReviewRequest");
    expect(webhook).toContain('.select("id,user_id,parcel_id,property_reference_hint")');
    expect(webhook).toContain("reviewRequest?.user_id ?? null");
    expect(webhook).toContain('admin.rpc("attach_easy_erf_human_review_request"');
    expect(webhook.indexOf('admin.rpc(\n    "record_easy_erf_stripe_payment"')).toBeLessThan(webhook.indexOf('admin.rpc("attach_easy_erf_human_review_request"'));
    expect(webhook).toContain("controlledReviewBrief: Boolean(reviewRequest)");
  });

  it("keeps the pre-checkout brief service-role-only at the database boundary", () => {
    expect(migration).toContain("alter table public.human_review_requests enable row level security");
    expect(migration).toContain("revoke all on table public.human_review_requests from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.human_review_requests to service_role");
    expect(migration).toContain("user_id uuid null references auth.users(id) on delete set null");
    expect(migration).toContain("scope_acknowledged_at timestamptz not null");
    expect(migration).toContain("review_scope_acknowledged_at timestamptz null");
    expect(migration).not.toContain("before_i_buy");
    expect(migration).toContain("revoke all on function public.attach_easy_erf_human_review_request(uuid, uuid)\nfrom public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.attach_easy_erf_human_review_request(uuid, uuid)\nto service_role");
  });
});

describe("Done-for-You appears where users actually work", () => {
  it("keeps the takeover CTA inside the workbench and the self-service report", () => {
    expect(workbench).toContain("<HumanReviewTakeoverCard");
    expect(workbench).toContain('source={`workbench-${tab}`}');
    expect(dossier).toContain("<HumanReviewTakeoverCard");
    expect(dossier).toContain('source="self-service-report"');
  });

  it("makes the self-service report executive-first while retaining the full evidence dossier", () => {
    expect(dossier).toContain("Full evidence dossier");
    expect(dossier).toContain("The report opening above is the readable summary");
    expect(dossier).toContain("open={printOnly ? true : undefined}");
    expect(reportOpening).toContain("<FiveQuestionReportGrid");
    expect(reportOpening).toContain("buildSelfServiceFiveQuestionContent(doc)");
    expect(humanReviewedReport).toContain("<FiveQuestionReportGrid");
  });
});

describe("Human-Reviewed report delivery and founder authority", () => {
  it("renders the finished investigation as a web report and keeps PDF secondary", () => {
    expect(orders).toContain("<HumanReviewedReport");
    expect(orders).toContain('downloading ? "Preparing PDF…" : "Download PDF"');
    expect(orders).toContain("This order opens as an interactive web report. Any attached PDF is a secondary export.");
    expect(migration).toContain("A structured Human Review web report is required before marking ready");
    expect(migration).toContain("pdf_storage_path = coalesce(v_expected_pdf_path, v_order.pdf_storage_path)");
    expect(founderFulfillment).not.toContain("pdfStoragePath is required for mark_ready");
    expect(founderQueue).toContain("Mark web report ready");
  });

  it("persists operational checklist state without adding a second evidence model or founder notes", () => {
    expect(founderEditor).toContain("Standard done-for-you investigation checklist");
    expect(founderEditor).toContain('"save_checklist"');
    expect(founderEditor).toContain("Delivery remains blocked while any item is Pending or Blocked");
    expect(founderEditor).toContain("This does not create a second evidence model");
    expect(founderEditor).not.toContain("checklistNotes");
    expect(founderContent).toContain('const ALLOWED_ACTIONS = new Set(["save_report", "save_checklist"])');
    expect(founderContent).toContain("investigationChecklist: checklistValidation.checklist");
    expect(founderContent).not.toContain("checklistNotes");
  });

  it("blocks delivery in both the Edge Function and database until report and checklist resolve", () => {
    expect(founderFulfillment).toContain("validateHumanReviewReportContent");
    expect(founderFulfillment).toContain("validateHumanReviewInvestigationChecklist");
    expect(founderFulfillment).toContain("isHumanReviewInvestigationChecklistResolved");
    expect(founderFulfillment.indexOf("validateHumanReviewReportContent")).toBeLessThan(
      founderFulfillment.indexOf('admin.rpc(\n    "transition_easy_erf_report_order"'),
    );
    expect(checklistMigration).toContain(
      "create trigger enforce_easy_erf_review_delivery_readiness",
    );
    expect(checklistMigration).toContain(
      "Every standard investigation checklist item must be complete or not applicable before marking ready",
    );
    expect(humanReviewWorkflow).toContain(
      "supabase/functions/easy-erf-founder-fulfillment/**",
    );
    expect(humanReviewWorkflow).toContain(
      "20260903111500_require_resolved_founder_investigation_checklist.sql",
    );
    expect(humanReviewWorkflow).toContain(
      "supabase/functions/easy-erf-founder-fulfillment/index.ts",
    );
  });

  it("requires authenticated founder admin authorization before structured report writes", () => {
    expect(config).toMatch(/\[functions\.easy-erf-founder-review-content\][\s\S]*verify_jwt = true/);
    expect(founderContent).toContain("userClient.auth.getUser()");
    expect(founderContent).toContain('userClient.rpc("has_role"');
    expect(founderContent).toContain('_role: "admin"');
    expect(founderContent.indexOf('userClient.rpc("has_role"')).toBeLessThan(founderContent.indexOf("createClient(supabaseUrl, serviceRoleKey"));
    expect(founderQueue).toContain("<FounderHumanReviewEditor");
    expect(founderQueue).toContain("Customer emphasis");
    expect(founderQueue).toContain("Standard done-for-you investigation checklist");
  });

  it("locks the customer product domain instead of presenting Lovable as Easy Erf", () => {
    expect(BRAND.url).toBe("https://easyerf.co.za");
  });
});
