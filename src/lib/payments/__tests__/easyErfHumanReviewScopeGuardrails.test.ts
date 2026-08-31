import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HUMAN_REVIEW_FOCUS_VALUES,
  HUMAN_REVIEW_INTENDED_USE_VALUES,
  validateHumanReviewCheckoutRequest,
  validateHumanReviewReportContent,
} from "../../../../supabase/functions/_shared/easyErfHumanReviewContract";
import {
  HUMAN_REVIEW_CORE_QUESTIONS,
  HUMAN_REVIEW_NOT_INCLUDED,
  HUMAN_REVIEW_SCOPE_BOUNDARY,
} from "@/lib/humanReview/scope";
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
const founderFulfillment = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");
const config = source("supabase/config.toml");
const workbench = source("src/components/property/OfficialParcelPanel.tsx");
const dossier = source("src/components/property/ErfResearchDossier.tsx");
const orders = source("src/routes/orders.tsx");
const founderQueue = source("src/routes/admin.fulfillment.tsx");

describe("Easy Erf controlled Human Review scope", () => {
  it("locks the product to four supported focuses and six supported intended uses", () => {
    expect(HUMAN_REVIEW_FOCUS_VALUES).toEqual([
      "property_check",
      "before_i_buy",
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
  });

  it("accepts context but refuses unsupported or scope-expanding checkout briefs", () => {
    expect(
      validateHumanReviewCheckoutRequest({
        focus: "property_check",
        context: "Considering buying the erf.",
      }),
    ).toMatchObject({ ok: true });

    expect(
      validateHumanReviewCheckoutRequest({
        focus: "legal_advice",
        context: "Tell me my legal rights.",
      }),
    ).toMatchObject({ ok: false });

    expect(
      validateHumanReviewCheckoutRequest({
        focus: "intended_use",
        intendedUse: null,
      }),
    ).toMatchObject({ ok: false });

    expect(
      validateHumanReviewCheckoutRequest({
        focus: "property_check",
        intendedUse: "second_dwelling",
      }),
    ).toMatchObject({ ok: false });

    expect(
      validateHumanReviewCheckoutRequest({
        focus: "property_check",
        context: "x".repeat(601),
      }),
    ).toMatchObject({ ok: false });
  });

  it("requires a structured five-part founder report instead of arbitrary prose", () => {
    expect(
      validateHumanReviewReportContent({
        bottomLine: "Evidence supports a working conclusion with municipal confirmation still required.",
        known: ["The official parcel identity is supported."],
        potential: ["Available planning evidence suggests a residential use may be relevant."],
        risks: ["A planning confirmation remains outstanding."],
        unknowns: ["No approved building plan was reviewed."],
        nextSteps: ["Confirm the planning position with the municipality or town planner."],
      }),
    ).toMatchObject({ ok: true });

    expect(
      validateHumanReviewReportContent({
        bottomLine: "",
        known: [],
        potential: [],
        risks: [],
        unknowns: [],
        nextSteps: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("keeps customer copy inside due-diligence scope and outside professional advice", () => {
    expect(pricing).toContain("Tell us about your situation — not a new question");
    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_BOUNDARY}");
    expect(pricing).toContain("HUMAN_REVIEW_NOT_INCLUDED.map");
    expect(pricing).toContain("does not invent a construction quotation or per-m² build-cost estimate");
    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain(
      "does not provide legal, tax, engineering, architectural, valuation",
    );
    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain("buy / do-not-buy recommendation");
    expect(HUMAN_REVIEW_NOT_INCLUDED).toContain("Formal property valuations");
    expect(HUMAN_REVIEW_NOT_INCLUDED).toContain(
      "Construction quotations or Easy Erf-generated build-cost estimates",
    );
    expect(pricing).not.toMatch(/what do you want to know/i);
    expect(pricing).not.toMatch(/ask us anything/i);
  });
});

describe("Easy Erf controlled Human Review payment handoff", () => {
  it("persists an opaque brief before returning the verified TEST Payment Link", () => {
    expect(checkout).toContain("validateHumanReviewCheckoutRequest(body)");
    expect(checkout).toContain('.from("human_review_requests")');
    expect(checkout).toContain('verifiedUrl.searchParams.set("client_reference_id", requestRow.id)');
    expect(checkout).toContain("link.livemode");
    expect(checkout).toContain("price.unit_amount !== 99900");
    expect(checkout).not.toContain("checkout.sessions.create");
    expect(checkout).not.toContain("paymentIntents.create");
  });

  it("attaches the controlled brief only after the signed Stripe payment is recorded", () => {
    expect(webhook).toContain("resolveHumanReviewRequest");
    expect(webhook).toContain('admin.rpc("attach_easy_erf_human_review_request"');
    expect(webhook.indexOf('admin.rpc(\n    "record_easy_erf_stripe_payment"')).toBeLessThan(
      webhook.indexOf('admin.rpc("attach_easy_erf_human_review_request"'),
    );
    expect(webhook).toContain("controlledReviewBrief: Boolean(reviewRequest)");
  });

  it("keeps the pre-checkout brief service-role-only at the database boundary", () => {
    expect(migration).toContain("alter table public.human_review_requests enable row level security");
    expect(migration).toContain(
      "revoke all on table public.human_review_requests from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.human_review_requests to service_role",
    );
    expect(migration).toContain(
      "revoke all on function public.attach_easy_erf_human_review_request(uuid, uuid)\nfrom public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.attach_easy_erf_human_review_request(uuid, uuid)\nto service_role",
    );
  });
});

describe("Human Review appears where users actually work", () => {
  it("keeps a takeover CTA inside the workbench and the self-service report", () => {
    expect(workbench).toContain("<HumanReviewTakeoverCard");
    expect(workbench).toContain('source={`workbench-${tab}`}');
    expect(dossier).toContain("<HumanReviewTakeoverCard");
    expect(dossier).toContain('source="self-service-report"');
  });

  it("makes the self-service report executive-first while retaining the full evidence dossier", () => {
    expect(dossier).toContain("Full evidence dossier");
    expect(dossier).toContain("The report opening above is the readable summary");
    expect(dossier).toContain("open={printOnly ? true : undefined}");
  });
});

describe("Human-Reviewed report delivery and founder authority", () => {
  it("renders the finished review as a web report and keeps PDF secondary", () => {
    expect(orders).toContain("<HumanReviewedReport");
    expect(orders).toContain('downloading ? "Preparing PDF…" : "Download PDF"');
    expect(orders).toContain("The PDF is a secondary export, not the primary product.");
    expect(migration).toContain("A structured Human Review web report is required before marking ready");
    expect(migration).toContain("pdf_storage_path = coalesce(v_expected_pdf_path, v_order.pdf_storage_path)");
    expect(founderFulfillment).not.toContain("pdfStoragePath is required for mark_ready");
    expect(founderQueue).toContain("Mark web report ready");
  });

  it("requires authenticated founder admin authorization before structured report writes", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-founder-review-content\][\s\S]*verify_jwt = true/,
    );
    expect(founderContent).toContain("userClient.auth.getUser()");
    expect(founderContent).toContain('userClient.rpc("has_role"');
    expect(founderContent).toContain('_role: "admin"');
    expect(founderContent.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      founderContent.indexOf("createClient(supabaseUrl, serviceRoleKey"),
    );
    expect(founderQueue).toContain("<FounderHumanReviewEditor");
    expect(founderQueue).toContain("Controlled Human Review focus");
  });

  it("locks the customer product domain instead of presenting Lovable as Easy Erf", () => {
    expect(BRAND.url).toBe("https://easyer.co.za");
  });
});
