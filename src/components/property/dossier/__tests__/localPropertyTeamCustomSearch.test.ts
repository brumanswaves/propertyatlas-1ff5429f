import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildCustomServiceCategory,
  customServiceResultsHeading,
  isCustomServiceCategoryId,
} from "@/lib/localServices/customServiceSearch";

const source = readFileSync("src/components/property/dossier/LocalPropertyTeam.tsx", "utf8");

describe("Local Property Team custom search visibility", () => {
  it("renders the custom search card before the category cards and preset chips", () => {
    const heading = source.indexOf("Find local help for this erf");
    const label = source.indexOf("What service do you need?");
    const categoryCards = source.indexOf("groups.map((group)");
    const presetChips = source.indexOf("activeCategories.map((category)");
    const results = source.indexOf("Top local Google results");

    expect(heading).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(heading);
    expect(categoryCards).toBeGreaterThan(label);
    expect(presetChips).toBeGreaterThan(categoryCards);
    expect(results).toBeGreaterThan(presetChips);
  });

  it("shows the input without any category selection, disclosure or flag gate", () => {
    const start = source.indexOf("What service do you need?");
    const block = source.slice(start - 1_200, start + 1_800);
    expect(block).toMatch(/Try security company, home staging, pool maintenance/);
    expect(block).toMatch(/Search nearby/);
    // No conditional rendering wrapping the card.
    expect(block).not.toMatch(/activeCategory &&/);
    expect(block).not.toMatch(/<details/);
    expect(block).not.toMatch(/hidden (sm|md|lg):/);
  });

  it("submits the custom query separately from the saved Market address", () => {
    const category = buildCustomServiceCategory("security company");
    expect(category).not.toBeNull();
    expect(isCustomServiceCategoryId(category!.id)).toBe(true);
    expect(source).toMatch(
      /customQuery: isCustomServiceCategoryId\(category\.id\) \? category\.searchQuery : undefined/,
    );
    expect(source).toMatch(/confirmedAddress|marketAddressLabel/);
  });

  it("labels the results with the exact custom query", () => {
    expect(customServiceResultsHeading("security company")).toBe(
      "Security companies near this property",
    );
  });
});
