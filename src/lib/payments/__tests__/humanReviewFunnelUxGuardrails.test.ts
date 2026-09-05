import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const pricing = source("src/routes/pricing.tsx");
const proof = source("src/components/humanReview/HumanReviewProof.tsx");
const howItWorks = source("src/routes/how-it-works.tsx");
const orders = source("src/routes/orders.tsx");
const fulfillment = source("src/routes/admin_.fulfillment.tsx");
const editor = source("src/components/admin/FounderHumanReviewEditor.tsx");
const scope = source("src/lib/humanReview/scope.ts");

describe("Done-for-You customer funnel", () => {
  it("shows the full investigation and tangible final report before asking for payment", () => {
    expect(pricing).toContain("<HumanReviewProof />");
    expect(proof).toContain("R999 is not just a final review");
    expect(proof).toContain("standard Easy Erf investigation");
    expect(proof).toContain("See the final deliverable before you pay");
    expect(proof).toContain("Example reviewer bottom line");
    expect(proof).toContain("What do we know?");
    expect(proof).toContain("What appears possible?");
    expect(proof).toContain("What could be a problem?");
    expect(proof).toContain("What do we not know yet?");
    expect(proof).toContain("What should be verified next?");
    expect(proof).toContain("What R999 includes");
    expect(proof).toContain("about 3 business days");
  });

  it("makes the selected focus an emphasis while preserving the full standard investigation", () => {
    expect(pricing).toContain("Every R999 order includes the standard Easy Erf investigation");
    expect(pricing).toContain("This choice sets the emphasis");
    expect(pricing).toContain("Investigate this property for me · R999");
    expect(scope).toContain("DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS");
    expect(scope).toContain("Confirm the exact parcel and working address");
    expect(scope).toContain("Review cadastral, SG and boundary evidence");
    expect(scope).toContain("Review useful market evidence and comparable context where available");
    expect(scope).toContain("Complete deterministic Site Potential when the evidence supports a useful envelope");
  });

  it("explains the done-for-you path on How It Works and keeps Site Potential deterministic", () => {
    expect(howItWorks).toContain("Done-for-You Property Investigation · R999");
    expect(howItWorks).toContain("Easy Erf does the investigation");
    expect(howItWorks).toContain("standard Easy Erf investigation");
    expect(howItWorks).toContain("deterministic build envelope and street-side build-line view");
    expect(howItWorks).not.toContain("development concepts");
  });

  it("makes the Stripe return state explain that Easy Erf has taken over the investigation", () => {
    expect(orders).toContain('params.get("payment") === "received"');
    expect(orders).toContain("Easy Erf has taken over the property investigation.");
    expect(orders).toContain("Payment and parcel attached");
    expect(orders).toContain("Easy Erf works through the investigation");
    expect(orders).toContain("Human reviewer checks the file");
    expect(orders).toContain("Report appears here");
    expect(orders).toContain("about 3 business days");
    expect(orders).toContain("You do not need to do anything now");
  });

  it("keeps the included property-data-report promise provider-neutral and rights-aware", () => {
    expect(scope).toContain("one third-party property data report");
    expect(scope).toContain("Provider may vary");
    expect(scope).toContain("terms permit redistribution");
    expect([pricing, proof, howItWorks, orders].join("\n")).not.toMatch(/free lightstone/i);
  });
});

describe("Done-for-You founder fulfillment", () => {
  it("prioritizes open work and tells the founder to complete the standard investigation first", () => {
    expect(fulfillment).toContain("Property investigation queue");
    expect(fulfillment).toContain("Waiting to start");
    expect(fulfillment).toContain("Next current order");
    expect(fulfillment).toContain("orderPriority");
    expect(editor).toContain("Standard done-for-you investigation checklist");
    expect(fulfillment).toContain("Open full property investigation");
    expect(fulfillment).toContain('defaultOpen={status === "processing"}');
    expect(fulfillment).toContain("Mark this exact report ready");
    expect(fulfillment).toContain("do not attach or redistribute the provider PDF");
  });

  it("makes the final editor a synthesis after investigation rather than the investigation itself", () => {
    expect(editor).toContain("Do not start with these text boxes");
    expect(editor).toContain("First complete or review the standard Easy Erf investigation");
    expect(editor).toContain("How to complete this report");
    expect(editor).toContain("Report completeness");
    expect(editor).toContain("Complete the investigation");
    expect(editor).toContain("Review the evidence");
    expect(editor).toContain("Fill all five sections");
    expect(editor).toContain("Example wording:");
  });
});
