import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const panel = source("src/components/property/OfficialParcelPanel.tsx");
const takeoverCard = source("src/components/humanReview/HumanReviewTakeoverCard.tsx");

describe("guided task first workbench UX", () => {
  it("renders the active overview and guided work before the optional R999 offer", () => {
    const offerIndex = panel.indexOf('data-done-for-you-placement="after-primary-work"');

    expect(offerIndex).toBeGreaterThan(-1);
    expect(panel.indexOf("<PropertyFirstRead")).toBeLessThan(offerIndex);
    expect(panel.indexOf("<InvestigationHome")).toBeLessThan(offerIndex);
    expect(panel.indexOf('tab === "stoep-report"')).toBeLessThan(offerIndex);
    expect(panel.match(/<HumanReviewTakeoverCard/g)).toHaveLength(1);
    expect(panel).toContain("compact\n          />");
  });

  it("keeps the optional R999 offer collapsed until the user opens it", () => {
    expect(takeoverCard).toContain("data-collapsed-done-for-you-offer");
    expect(takeoverCard).toContain("<details");
    expect(takeoverCard).toContain("<summary");
    expect(takeoverCard).toContain("Optional help");
    expect(takeoverCard).toContain("View option");
    expect(takeoverCard).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
  });

  it("uses a compact mobile header and lets the content area consume remaining height", () => {
    expect(panel).toContain('data-mobile-workbench-header="compact"');
    expect(panel).toContain("flex h-[100dvh] flex-col");
    expect(panel).toContain("relative min-h-0 flex-1 overflow-y-auto");
    expect(panel).toContain('<span className="sm:hidden">Save</span>');
    expect(panel).toContain('<span className="sm:hidden">Map</span>');
    expect(panel).toContain('<span className="md:hidden">Official</span>');
    expect(panel).not.toContain("h-[calc(100dvh-5.25rem)]");
  });
});
