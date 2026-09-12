import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const panel = source("src/components/property/OfficialParcelPanel.tsx");
const takeoverCard = source("src/components/humanReview/HumanReviewTakeoverCard.tsx");
const firstRead = source("src/components/property/dossier/PropertyFirstRead.tsx");

describe("guided task first workbench UX", () => {
  it("puts the R999 choice inside the First Read hero and before every Guided task", () => {
    const offerIndex = panel.indexOf('data-done-for-you-placement="before-primary-work"');

    expect(offerIndex).toBeGreaterThan(-1);
    expect(panel.indexOf("<InvestigationHome")).toBeGreaterThan(offerIndex);
    expect(panel).toContain("takeoverSlot={takeoverOffer}");
    expect(firstRead.indexOf("{props.takeoverSlot &&")).toBeGreaterThan(firstRead.indexOf("<h1"));
    expect(firstRead.indexOf("{props.takeoverSlot &&")).toBeLessThan(firstRead.indexOf("{model.addressLine &&"));
    expect(firstRead).toContain("Investigate this property yourself with Guided Investigation.");
    expect(panel.match(/<HumanReviewTakeoverCard/g)).toHaveLength(1);
    const offer = panel.match(/<HumanReviewTakeoverCard\b[^>]*\/>/)?.[0];
    expect(offer).toMatch(/\bcompact\b/);
    expect(offer).toContain("onPrepare={preparePaidInvestigation}");
    expect(offer).toContain("parcelId={normalizedParcel.id}");
    expect(takeoverCard).toContain("data-done-for-you-top");
    expect(takeoverCard).not.toMatch(/\bfixed\b|\bsticky\b|reservedHeight/);
  });

  it("keeps the R999 alternative prominent without hiding the price or action", () => {
    expect(takeoverCard).toContain("data-done-for-you-prominent");
    expect(takeoverCard).toContain("Investigate it for me · R999");
    expect(takeoverCard).toContain("You choose the property. We do the investigation.");
    expect(takeoverCard).not.toContain("data-collapsed-done-for-you-offer");
    expect(takeoverCard).not.toContain("<details");
    expect(takeoverCard).not.toContain("<summary");
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
