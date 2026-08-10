import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";

vi.mock("@/components/property/sitePotential/SatelliteParcelMap", () => ({
  SatelliteParcelMap: (props: {
    ring: Array<[number, number]> | null;
    result: BuildEnvelopeResult;
    fallbackNotice?: string;
  }) => (
    <div
      data-visual="satellite"
      data-secondary-frontage={String(Boolean(props.result.secondaryStreetEdge))}
      data-has-ring={String(Boolean(props.ring?.length))}
    >
      {props.fallbackNotice}
    </div>
  ),
}));

vi.mock("@/components/property/sitePotential/BuildEnvelopeDiagram", () => ({
  BuildEnvelopeDiagram: () => <div data-visual="deterministic-diagram" />,
}));

import { ReportBuildableAreaVisual } from "../ReportBuildableAreaVisual";

const result = {
  secondaryStreetEdge: { index: 1 },
} as unknown as BuildEnvelopeResult;

describe("Report buildable-area visual", () => {
  it("uses the existing satellite map with real parcel geometry in the browser report", () => {
    const markup = renderToStaticMarkup(
      <ReportBuildableAreaVisual ring={[[24.8, -34.1], [24.81, -34.1], [24.81, -34.11]]} result={result} />,
    );

    expect(markup).toContain('data-visual="satellite"');
    expect(markup).toContain('data-secondary-frontage="true"');
    expect(markup).toContain('data-has-ring="true"');
    expect(markup).toContain("Satellite context unavailable. Showing parcel diagram.");
  });

  it("keeps the deterministic diagram in the print portal instead of printing a WebGL canvas", () => {
    const markup = renderToStaticMarkup(
      <ReportBuildableAreaVisual
        ring={[[24.8, -34.1], [24.81, -34.1], [24.81, -34.11]]}
        result={result}
        printOnly
      />,
    );

    expect(markup).toContain('data-visual="deterministic-diagram"');
    expect(markup).not.toContain('data-visual="satellite"');
  });
});
