import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfficialParcelSearchResultRow } from "@/components/map/SearchBar";
import { selectOfficialErfResult } from "@/components/map/officialSearchResultAction";
import type { PropertySearchResult } from "@/lib/search/propertySearch";

const exactResult: PropertySearchResult = {
  id: "csg:lpi:c03400140000157000000",
  title: "Erf 1570",
  subtitle: "Sea Vista, Kouga, Eastern Cape",
  matchReason: "Official erf and portion match",
  confidence: "exact_official_match",
  sourceLabel: "Chief Surveyor-General",
  parcel: {
    id: "csg:lpi:c03400140000157000000",
    layer: "csg-parcels",
    sourceLabel: "Chief Surveyor-General",
    properties: {},
    geometry: null,
    feature: {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [24.82, -34.16] },
    },
    erf: "1570",
    portion: "0",
    lpi: "c03400140000157000000",
    parcelKey: "e108c034001400001570000000",
    town: "Sea Vista",
    municipality: "Kouga",
    province: "Eastern Cape",
    displayAreaLabel: "Sea Vista, Kouga, Eastern Cape",
  },
  fields: {
    erf: "1570",
    portion: "0",
    lpi: "c03400140000157000000",
    parcelKey: "e108c034001400001570000000",
    town: "Sea Vista",
    municipality: "Kouga",
    province: "Eastern Cape",
  },
};

function collectButtons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const buttons: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === "button") buttons.push(child);
    buttons.push(...collectButtons(child.props.children as ReactNode));
  });
  return buttons;
}

describe("official search result markup", () => {
  it("renders one accessible primary action and sibling action buttons without nesting", () => {
    const onSelect = vi.fn();
    const onHighlight = vi.fn();
    const onOpenWorkbench = vi.fn();
    const row = OfficialParcelSearchResultRow({
      result: exactResult,
      onSelect,
      onHighlight,
      onOpenWorkbench,
    });
    const markup = renderToStaticMarkup(row);
    const buttons = collectButtons(row);

    let buttonDepth = 0;
    let maximumButtonDepth = 0;
    for (const tag of markup.match(/<\/?button\b[^>]*>/g) ?? []) {
      buttonDepth += tag.startsWith("</") ? -1 : 1;
      maximumButtonDepth = Math.max(maximumButtonDepth, buttonDepth);
    }

    expect(markup).toContain('role="group"');
    expect(maximumButtonDepth).toBe(1);
    expect(buttons).toHaveLength(3);
    expect(buttons[0].props["aria-label"]).toContain("Open Erf 1570");

    (buttons[0].props.onClick as () => void)();
    (buttons[1].props.onClick as () => void)();
    (buttons[2].props.onClick as () => void)();

    expect(onSelect).toHaveBeenCalledWith(exactResult);
    expect(onHighlight).toHaveBeenCalledWith(exactResult);
    expect(onOpenWorkbench).toHaveBeenCalledWith(exactResult);
  });

  it("routes an exact official primary result through the canonical Workbench action", () => {
    const openOfficialWorkbench = vi.fn();
    const highlightResult = vi.fn();

    selectOfficialErfResult(exactResult, { openOfficialWorkbench, highlightResult });

    expect(openOfficialWorkbench).toHaveBeenCalledWith(exactResult);
    expect(highlightResult).not.toHaveBeenCalled();
  });
});
