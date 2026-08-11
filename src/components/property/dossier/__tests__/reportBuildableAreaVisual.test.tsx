import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
      data-additional-frontage-count={String(props.result.additionalStreetEdges.length)}
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
  additionalStreetEdges: [{ index: 1 }, { index: 2 }],
} as unknown as BuildEnvelopeResult;

describe("Report buildable-area visual", () => {
  it("uses the existing satellite map with real parcel geometry in the browser report", () => {
    const markup = renderToStaticMarkup(
      <ReportBuildableAreaVisual ring={[[24.8, -34.1], [24.81, -34.1], [24.81, -34.11]]} result={result} />,
    );

    expect(markup).toContain('data-visual="satellite"');
    expect(markup).toContain('data-additional-frontage-count="2"');
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

  it("uses primary and additional-frontage language and collection rendering", () => {
    const vacancy = readFileSync(
      "src/components/property/sitePotential/VacantLandBuildEnvelope.tsx",
      "utf8",
    );
    const satellite = readFileSync(
      "src/components/property/sitePotential/SatelliteParcelMap.tsx",
      "utf8",
    );
    const diagram = readFileSync(
      "src/components/property/sitePotential/BuildEnvelopeDiagram.tsx",
      "utf8",
    );

    expect(vacancy).toContain("Manage street frontages");
    expect(vacancy).toContain('pickingFrontage === "manage" ? "Done"');
    expect(vacancy).toContain("Cancel");
    expect(vacancy).toContain("toggleAdditionalFrontage");
    expect(vacancy).not.toContain("second frontage");
    expect(satellite).toContain("additionalStreetEdges.map");
    expect(satellite).toContain("Additional street boundary");
    expect(diagram).toContain("additionalStreetEdges.map");
    expect(diagram).toContain("Additional street boundary");
    expect(diagram).not.toContain("Secondary street boundary");
  });
});
