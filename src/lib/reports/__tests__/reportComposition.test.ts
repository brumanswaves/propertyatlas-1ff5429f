import { describe, expect, it } from "vitest";
import {
  buildReportComposition,
  isGroupCollapsedByDefault,
  rankByComposition,
  selectOpeningMetrics,
} from "../reportComposition";

describe("report composition", () => {
  it("exposes exactly five primary destinations per lens", () => {
    for (const mode of ["standard", "investor"] as const) {
      const composition = buildReportComposition(mode);
      expect(composition.destinations).toHaveLength(5);
      expect(new Set(composition.destinations.map((d) => d.id)).size).toBe(5);
      expect(composition.groupOrder).toHaveLength(5);
    }
  });

  it("makes Standard and Investor genuinely different compositions", () => {
    const standard = buildReportComposition("standard");
    const investor = buildReportComposition("investor");

    expect(investor.groupOrder).not.toEqual(standard.groupOrder);
    // Investor puts Market & Financials directly after the opening.
    expect(investor.groupOrder[0]).toBe("market");
    expect(standard.groupOrder[0]).toBe("identity");
    expect(investor.verdictHeading).not.toBe(standard.verdictHeading);
    expect(investor.openingMetricPreference).not.toEqual(standard.openingMetricPreference);
    expect(investor.askSuggestionFocus).not.toEqual(standard.askSuggestionFocus);
  });

  it("collapses deep context by default so the scroll stays short", () => {
    const composition = buildReportComposition("standard");
    expect(isGroupCollapsedByDefault(composition, "context")).toBe(true);
    expect(isGroupCollapsedByDefault(composition, "identity")).toBe(false);
    expect(isGroupCollapsedByDefault(composition, "next")).toBe(false);
  });

  it("orders opening metrics by lens and never invents unsupported ones", () => {
    const supported = [
      { id: "erfSizeM2" },
      { id: "profit" },
      { id: "acquisitionPrice" },
      { id: "somethingElse" },
    ];
    const investor = selectOpeningMetrics(buildReportComposition("investor"), supported);
    expect(investor.map((m) => m.id)).toEqual([
      "acquisitionPrice",
      "profit",
      "erfSizeM2",
      "somethingElse",
    ]);
    // Unsupported preferred metrics (e.g. municipalValuation) are simply absent.
    expect(investor.map((m) => m.id)).not.toContain("municipalValuation");
  });

  it("ranks actions differently for buyer and investor lenses", () => {
    const actions = [
      { kind: "market" },
      { kind: "ownership" },
      { kind: "missing_costs" },
      { kind: "unmapped" },
    ];
    const kindOf = (item: { kind: string }) => item.kind;

    expect(
      rankByComposition(buildReportComposition("standard"), actions, kindOf).map(kindOf)[0],
    ).toBe("ownership");
    expect(
      rankByComposition(buildReportComposition("investor"), actions, kindOf).map(kindOf)[0],
    ).toBe("missing_costs");
    // Unknown kinds fall to the end but are never dropped.
    expect(
      rankByComposition(buildReportComposition("investor"), actions, kindOf).map(kindOf),
    ).toContain("unmapped");
  });
});
