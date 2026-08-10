import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { BuildEnvelopeDiagram } from "@/components/property/sitePotential/BuildEnvelopeDiagram";
import { SatelliteParcelMap } from "@/components/property/sitePotential/SatelliteParcelMap";

interface ReportBuildableAreaVisualProps {
  ring: Array<[number, number]> | null;
  result: BuildEnvelopeResult;
  printOnly?: boolean;
  compact?: boolean;
}

/**
 * The browser report gets live Mapbox satellite context and the same
 * georeferenced envelope overlays used by Site Potential. The print portal
 * intentionally keeps the deterministic SVG: a WebGL canvas is not a reliable
 * printable asset and must never leave a broken blank in a PDF.
 */
export function ReportBuildableAreaVisual({
  ring,
  result,
  printOnly = false,
  compact = false,
}: ReportBuildableAreaVisualProps) {
  if (printOnly) {
    return <BuildEnvelopeDiagram result={result} compact={compact} className="border-0" />;
  }

  return (
    <SatelliteParcelMap
      ring={ring}
      result={result}
      className={compact ? "h-[300px] sm:h-[360px]" : "h-[380px] sm:h-[520px]"}
      fallbackNotice="Satellite context unavailable. Showing parcel diagram."
    />
  );
}
