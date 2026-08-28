import { ArrowRight, CheckCircle2, MapPinned, SlidersHorizontal } from "lucide-react";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import {
  localPolygonToWgs84,
  type BuildEnvelopeResult,
} from "@/lib/sitePotential/buildEnvelope";
import { SatelliteParcelMap } from "@/components/property/sitePotential/SatelliteParcelMap";
import { StreetSideBuildEnvelope } from "@/components/property/sitePotential/StreetSideBuildEnvelope";
import { cn } from "@/lib/utils";

interface GuidedSitePotentialStepProps {
  workspaceState: ErfWorkspaceState;
  acceptedBuildEnvelope?: BuildEnvelopeResult | null;
  /** Legacy prop retained so older callers compile. Generated concepts are no longer shown here. */
  selectedSiteDesign?: unknown;
  stepSkipped?: boolean;
  onOpenSitePotential: () => void;
  onContinue: () => void;
}

export function GuidedSitePotentialStep({
  workspaceState,
  acceptedBuildEnvelope = null,
  stepSkipped = false,
  onOpenSitePotential,
  onContinue,
}: GuidedSitePotentialStepProps) {
  const site = workspaceState.sitePotential;
  const skipped = stepSkipped || site.skipped || site.progressState === "skipped";
  const complete = Boolean(acceptedBuildEnvelope) || skipped;
  const acceptedRing =
    acceptedBuildEnvelope?.projection && acceptedBuildEnvelope.parcelPolygon.length >= 3
      ? localPolygonToWgs84(
          acceptedBuildEnvelope.parcelPolygon,
          acceptedBuildEnvelope.projection,
        )
      : null;

  const statusLabel = skipped
    ? "Skipped for now"
    : acceptedBuildEnvelope
      ? "Build envelope accepted"
      : "Confirm the site inputs";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Site Potential
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Confirm where a building could potentially fit
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Site Potential uses the saved parcel boundary and planning controls to show the
              buildable envelope on the map and from the street side. It does not generate a house
              or architectural concept.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              complete ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700",
            )}
          >
            {complete ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <MapPinned className="h-3.5 w-3.5" />
            )}
            {statusLabel}
          </span>
        </div>
      </section>

      {acceptedBuildEnvelope ? (
        <section className="rounded-[1.25rem] border border-emerald-300/40 bg-emerald-50/45 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            Accepted Site Potential for this erf
          </div>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <article className="overflow-hidden rounded-xl border border-emerald-300/45 bg-white p-3">
              <div className="text-sm font-semibold text-[#0D1B2A]">Accepted building area map</div>
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                The orange envelope comes from the saved boundary, street-facing confirmation and
                current planning controls.
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-[#0D1B2A]/10">
                <SatelliteParcelMap ring={acceptedRing} result={acceptedBuildEnvelope} />
              </div>
            </article>

            <StreetSideBuildEnvelope result={acceptedBuildEnvelope} />
          </div>
        </section>
      ) : (
        <section className="rounded-[1.25rem] border border-dashed border-[#0D1B2A]/16 bg-white p-4">
          <div className="text-sm font-semibold text-[#0D1B2A]">No accepted build envelope yet</div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
            Open Site Potential and confirm the parcel boundary and street-facing boundary. The map
            and street-side build lines will appear here once those inputs support an envelope.
          </p>
        </section>
      )}

      {skipped ? (
        <p className="rounded-xl border border-emerald-300/45 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
          You skipped Site Potential for now. You can return later and confirm the map and
          street-side build lines.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!complete}
          onClick={onContinue}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          Continue to Review report
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onOpenSitePotential}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Open Site Potential
        </button>
      </div>
    </div>
  );
}

export default GuidedSitePotentialStep;
