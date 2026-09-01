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
const fulfillment = source("src/routes/admin.fulfillment.tsx");
const editor = source("src/components/admin/FounderHumanReviewEditor.tsx");

describe("Human Review customer funnel", () => {
  it("shows a tangible report preview before asking for payment", () => {
    expect(pricing).toContain("<HumanReviewProof />");
    expect(proof).toContain("See the deliverable before you pay");
    expect(proof).toContain("Example reviewer bottom line");
    expect(proof).toContain("What do we know?");
    expect(proof).toContain("What appears possible?");
    expect(proof).toContain("What could be a problem?");
    expect(proof).toContain("What do we not know yet?");
    expect(proof).toContain("What should be verified next?");
    expect(proof).toContain("What R999 includes");
    expect(proof).toContain("about 3 business days");
  });

  it("explains Human Review on How It Works and keeps Site Potential deterministic", () => {
    expect(howItWorks).toContain("Human Review · R999 once-off");
    expect(howItWorks).toContain("Every Human-Reviewed report answers");
    expect(howItWorks).toContain("A human reviews the same property file");
    expect(howItWorks).toContain("deterministic build envelope and street-side build-line view");
    expect(howItWorks).not.toContain("development concepts");
  });

  it("makes the Stripe return state explain exactly what happens next", () => {
    expect(orders).toContain('params.get("payment") === "received"');
    expect(orders).toContain("Your Human Review is now in the queue.");
    expect(orders).toContain("Payment and parcel attached");
    expect(orders).toContain("Human reviewer checks the evidence");
    expect(orders).toContain("Report appears here");
    expect(orders).toContain("about 3 business days");
    expect(orders).toContain("You do not need to do anything now");
  });
});

describe("Human Review founder fulfillment", () => {
  it("prioritizes open work and tells the founder the next action", () => {
    expect(fulfillment).toContain("Human Review work queue");
    expect(fulfillment).toContain("Needs action");
    expect(fulfillment).toContain("Next founder action");
    expect(fulfillment).toContain("orderPriority");
    expect(fulfillment).toContain("Open property evidence");
    expect(fulfillment).toContain('defaultOpen={status === "processing"}');
    expect(fulfillment).toContain("Mark web report ready");
  });

  it("teaches the founder how to write the five-part report instead of presenting blank boxes", () => {
    expect(editor).toContain("How to complete this report");
    expect(editor).toContain("Report completeness");
    expect(editor).toContain("Read the property file");
    expect(editor).toContain("Write the bottom line");
    expect(editor).toContain("Keep unknowns unknown");
    expect(editor).toContain("Complete all five report sections before saving");
    expect(editor).toContain("Example wording:");
  });
});
