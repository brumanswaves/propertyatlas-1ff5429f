import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const takeoverCard = readFileSync(
  resolve(process.cwd(), "src/components/humanReview/HumanReviewTakeoverCard.tsx"),
  "utf8",
);
const scope = readFileSync(
  resolve(process.cwd(), "src/lib/humanReview/scope.ts"),
  "utf8",
);

describe("Done-for-You investigation takeover value proposition", () => {
  it("keeps the R999 product prominent after the exact erf is selected", () => {
    expect(scope).toContain("Done-for-You Property Investigation");
    for (const requiredCopy of [
      "Want Easy Erf to investigate this property for you?",
      "What you get",
      "standard property investigation",
      "SG/cadastral",
      "Property checks, useful market evidence and relevant deterministic calculations",
      "One third-party property data report is reviewed during Early Access where available",
      "Human-Reviewed Easy Erf Report",
      "R999 once-off · no subscription",
      "Investigate it for me · R999",
      "You choose the property. We do the investigation.",
      "data-done-for-you-prominent",
    ]) {
      expect(takeoverCard).toContain(requiredCopy);
    }
    expect(takeoverCard).not.toContain("<details");
    expect(takeoverCard).not.toContain("View option");
    expect(takeoverCard).not.toContain("OPTIONAL HELP");
  });

  it("keeps the commercial CTA inside the controlled product and provider boundary", () => {
    expect(takeoverCard).toContain(
      "Property research and due-diligence support, not professional advice or municipal approval.",
    );
    expect(takeoverCard).toContain("DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY");
    expect(scope).toContain("Provider may vary");
    expect(scope).toContain("terms permit redistribution");
    expect(`${takeoverCard}\n${scope}`).not.toMatch(
      /guarantee|approval included|legal advice|valuation included|free lightstone/i,
    );
  });
});
