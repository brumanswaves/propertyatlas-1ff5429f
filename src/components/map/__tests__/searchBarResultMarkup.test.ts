import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfficialParcelSearchResultRow } from "@/components/map/SearchBar";
import { selectOfficialErfResult } from "@/components/map/officialSearchResultAction";
import { buildOfficialParcelIndex } from "@/lib/search/officialParcelIndex";
import {
  mergeOfficialParcelSearchResults,
  searchOfficialParcels,
  type PropertySearchResult,
} from "@/lib/search/propertySearch";

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

  it("does not preserve subset singleton exactness across ambiguous combined sources", () => {
    const feature = (id: string, town: string, longitude: number) => ({
      layer: "csg-parcels" as const,
      feature: {
        type: "Feature" as const,
        properties: {
          PARCEL_NO: "962",
          PORTION: "0",
          ID: id,
          MIN_REGION: town,
          MUNICIPALITY: "Kouga",
          PROVINCE: "Eastern Cape",
        },
        geometry: { type: "Point" as const, coordinates: [longitude, -34.16] },
      },
    });
    const [candidateA, candidateB] = buildOfficialParcelIndex([
      feature("C03400140000096200000", "Sea Vista", 24.82),
      feature("C03400030000096200000", "Cape St Francis", 24.83),
    ]);
    const query = "Erf 962 portion 0";
    const pilotResults = searchOfficialParcels(query, [candidateA, candidateB]);
    const loadedResults = searchOfficialParcels(query, [candidateA]);

    expect(loadedResults[0].exactMatchBasis).toBe("erf_portion_singleton");
    expect(loadedResults[0].confidence).toBe("exact_official_match");

    const combined = mergeOfficialParcelSearchResults(query, [pilotResults, loadedResults]);

    expect(combined).toHaveLength(2);
    expect(combined.every((result) => result.confidence === "likely_nearby_parcel")).toBe(true);
  });

  it("preserves compatible area-context exactness across combined sources", () => {
    const seaVista = {
      ...exactResult.parcel!,
      id: "sea-vista-962",
      erf: "962",
      portion: "0",
      town: "Sea Vista",
      displayAreaLabel: "Sea Vista, Kouga, Eastern Cape",
    };
    const capeStFrancis = {
      ...seaVista,
      id: "cape-st-francis-962",
      town: "Cape St Francis",
      displayAreaLabel: "Cape St Francis, Kouga, Eastern Cape",
    };
    const query = "Erf 962 portion 0 Sea Vista";
    const pilotResults = searchOfficialParcels(query, [seaVista, capeStFrancis]);
    const loadedResults = searchOfficialParcels(query, [seaVista]);

    const combined = mergeOfficialParcelSearchResults(query, [pilotResults, loadedResults]);

    expect(combined[0]).toMatchObject({
      id: "sea-vista-962",
      confidence: "exact_official_match",
      exactMatchBasis: "erf_portion_area",
    });
  });
});
