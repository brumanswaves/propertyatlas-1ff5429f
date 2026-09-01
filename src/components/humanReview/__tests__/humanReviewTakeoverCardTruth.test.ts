import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const takeoverCard = readFileSync(
  resolve(process.cwd(), "src/components/humanReview/HumanReviewTakeoverCard.tsx"),
  "utf8",
);

describe("Human Review takeover value proposition", () => {
  it("explains what the customer receives before asking for R999", () => {
    for (const requiredCopy of [
      "What you get",
      "What is known, with the evidence and confidence clearly separated",
      "What appears possible for this property",
      "Risks, conflicts or problems that could matter",
      "What is still unknown or needs verification",
      "Clear next checks, saved in your Human-Reviewed Easy Erf Report",
      "Human-reviewed report saved to your Easy Erf account.",
      "R999 once-off · no subscription",
      "Yes — get Human Review · R999",
    ]) {
      expect(takeoverCard).toContain(requiredCopy);
    }
  });

  it("keeps the commercial CTA inside the controlled product boundary", () => {
    expect(takeoverCard).toContain(
      "Property research and due-diligence support, not professional advice or municipal approval.",
    );
    expect(takeoverCard).not.toMatch(/guarantee|approval included|legal advice|valuation included/i);
  });
});
