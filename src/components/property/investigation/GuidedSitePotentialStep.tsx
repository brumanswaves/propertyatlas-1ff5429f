import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import {
  createErfAssetSignedUrl,
  type ErfAsset,
} from "@/lib/workbench/erfFileVault";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { BuildEnvelopeDiagram } from "@/components/property/sitePotential/BuildEnvelopeDiagram";
import { cn } from "@/lib/utils";

interface GuidedSitePotentialStepProps {
  workspaceState: ErfWorkspaceState;
  acceptedBuildEnvelope?: BuildEnvelopeResult | null;
  selectedSiteDesign?: ErfAsset | null;
  stepSkipped?: boolean;
  onOpenSitePotential: () => void;
  onContinue: () => void;
}

function AcceptedConceptPreview({ asset }: { asset: ErfAsset }) {
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setUnavailable(false);
    void createErfAssetSignedUrl(asset)
      .then((nextUrl) => {
        if (alive) setUrl(nextUrl || null);
      })
      .catch(() => {
        if (alive) setUnavailable(true);
      });
    return () => {
      alive = false;
    };
  }, [asset]);

  if (!url || unavailable) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl bg-[#F2F4F7] px-3 text-center text-xs text-[#0D1B2A]/60">
        Preview unavailable. Open Site Potential to view the saved image.
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Saved Site Potential image"
      className="aspect-[4/3] w-full rounded-xl object-cover"
      onError={() => {
        setUrl(null);
        setUnavailable(true);
      }}
    />
  );
}

export function GuidedSitePotentialStep({
  workspaceState,
  acceptedBuildEnvelope = null,
  selectedSiteDesign = null,
  stepSkipped = false,
  onOpenSitePotential,
  onContinue,
}: GuidedSitePotentialStepProps) {
  const site = workspaceState.sitePotential;
  const skipped = stepSkipped || site.skipped || site.progressState === "skipped";
  const acceptedSiteDesign =
    selectedSiteDesign?.id === site.selectedDesignAssetId ? selectedSiteDesign : null;
  const hasAcceptedWork = Boolean(acceptedBuildEnvelope || acceptedSiteDesign);
  const complete = hasAcceptedWork || skipped;

  const statusLabel = skipped
    ? "Skipped for now"
    : acceptedBuildEnvelope
      ? "Building area map ready"
      : acceptedSiteDesign
        ? "Saved Site Potential image"
        : "Building area not confirmed yet";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Site potential
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Review the practical building area for this erf
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Use the parcel boundary, street frontage and available planning controls to understand
              the approximate area that may be available for building. Easy Erf keeps verified rules,
              working assumptions and unknowns visibly separate.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              complete
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700",
            )}
          >
            {complete ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Lightbulb className="h-3.5 w-3.5" />
            )}
            {statusLabel}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <h4 className="text-sm font-semibold text-[#0D1B2A]">How Site Potential works</h4>
        <div className="mt-3 rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">
            Property / build envelope
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">
            Easy Erf uses the parcel boundary plus the planning information available to show the
            approximate area that may be available for building. Verified rules and working
            assumptions remain visibly different.
          </p>
        </div>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#0D1B2A]/70">
          {[
            "Confirm the current site state and the subject parcel.",
            "Review or confirm the street-facing property boundaries.",
            "Review the available zoning controls, building lines, coverage and height assumptions.",
            "Save the building area map once the working inputs are useful enough for the investigation.",
          ].map((line, index) => (
            <li key={line} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]/12 text-[11px] font-bold text-[#FF6A00]">
                {index + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          The building area is a due-diligence aid, not an approval. It does not replace an architect,
          surveyor, town planner or municipal confirmation where those are required.
        </p>

        {acceptedBuildEnvelope || acceptedSiteDesign ? (
          <section className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-50/45 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              Accepted work for this erf
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {acceptedBuildEnvelope ? (
                <article className="overflow-hidden rounded-xl border border-emerald-300/45 bg-white p-3">
                  <div className="text-sm font-semibold text-[#0D1B2A]">
                    Accepted building area map
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                    Built from the saved boundary and street-facing confirmations. Rules and
                    assumptions remain visible in Site Potential.
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-[#0D1B2A]/10 bg-[#F8FAFC] p-2">
                    <BuildEnvelopeDiagram result={acceptedBuildEnvelope} compact />
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSitePotential}
                    className="mt-3 inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                  >
                    View building area
                  </button>
                </article>
              ) : null}
              {acceptedSiteDesign ? (
                <article className="overflow-hidden rounded-xl border border-emerald-300/45 bg-white p-3">
                  <div className="text-sm font-semibold text-[#0D1B2A]">
                    Previously saved Site Potential image
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                    This image was already saved for the erf. It remains available as illustrative
                    context, but generating or selecting concepts is no longer required to complete
                    this step.
                  </p>
                  <div className="mt-3">
                    <AcceptedConceptPreview asset={acceptedSiteDesign} />
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSitePotential}
                    className="mt-3 inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                  >
                    View saved image
                  </button>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {!complete ? (
          <p className="mt-4 rounded-xl border border-sky-300/45 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-950">
            Open Site Potential and save the building area map when the parcel and working planning
            inputs are useful enough. You can also skip this step and return later.
          </p>
        ) : null}

        {skipped ? (
          <p className="mt-4 rounded-xl border border-emerald-300/45 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
            You skipped Site Potential for now. You can return later to review and save the building
            area map.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSitePotential}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F]"
          >
            Review Site Potential
          </button>
          <button
            type="button"
            disabled={!complete}
            onClick={onContinue}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Review report
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

export default GuidedSitePotentialStep;