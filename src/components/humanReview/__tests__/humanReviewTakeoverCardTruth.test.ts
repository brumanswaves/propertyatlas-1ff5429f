import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const takeoverCard = readFileSync(
  resolve(process.cwd(), "src/components/humanReview/HumanReviewTakeoverCard.tsx"),
  "utf8",
);

describe("Done-for-You investigation takeover value proposition", () => {
  it("explains the full investigation the customer receives before asking for R999", () => {
    for (const requiredCopy of [
      "Done-for-You Property Investigation",
      "Want Easy Erf to do the property investigation for you?",
      "What you get",
      "standard property investigation",
      "SG/cadastral",
      "Property checks, useful market evidence and relevant deterministic calculations",
      "One third-party property data report is reviewed during Early Access where available",
      "Human-Reviewed Easy Erf Report",
      "R999 once-off · no subscription",
      "Yes — investigate it for me · R999",
      "You choose the property. We do the investigation.",
    ]) {
      expect(takeoverCard).toContain(requiredCopy);
    }
  });

  it("keeps the commercial CTA inside the controlled product and provider boundary", () => {
    expect(takeoverCard).toContain(
      "Property research and due-diligence support, not professional advice or municipal approval.",
    );
    expect(takeoverCard).toContain("Provider may vary");
    expect(takeoverCard).toContain("terms permit redistribution");
    expect(takeoverCard).not.toMatch(/guarantee|approval included|legal advice|valuation included|free lightstone/i);
  });
});
