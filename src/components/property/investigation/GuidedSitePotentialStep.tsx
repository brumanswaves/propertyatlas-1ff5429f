import { ArrowRight, CheckCircle2, Lightbulb, Map } from "lucide-react";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
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

  const statusLabel = skipped
    ? "Skipped for now"
    : acceptedBuildEnvelope
      ? "Building area reviewed"
      : "Building area not reviewed yet";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Site potential
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Understand the likely building area
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Use the parcel boundary and the planning information already gathered to understand the approximate area that may be available for building. Easy Erf keeps verified rules and working assumptions visibly separate.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              complete ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700",
            )}
          >
            {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
            {statusLabel}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <h4 className="text-sm font-semibold text-[#0D1B2A]">What Site Potential does now</h4>
        <div className="mt-3 rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">
            Property / build envelope
          </div>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">
            Easy Erf uses the parcel boundary, working zoning, building lines and other available constraints to show an approximate building area. This is a due-diligence aid, not an architectural design service or municipal approval.
          </p>
        </div>

        {acceptedBuildEnvelope ? (
          <section className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-50/45 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              Accepted work for this erf
            </div>
            <article className="mt-3 overflow-hidden rounded-xl border border-emerald-300/45 bg-white p-3">
              <div className="text-sm font-semibold text-[#0D1B2A]">Accepted building area map</div>
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                Built from the saved boundary and planning assumptions. Rules and assumptions remain visible in Site Potential.
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
          </section>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Open Site Potential to review the parcel and approximate building area. You can also skip this step and continue the investigation.
          </p>
        )}

        {skipped ? (
          <p className="mt-4 rounded-xl border border-emerald-300/45 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
            You skipped Site Potential for now. You can return later if the building area becomes important to your decision.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSitePotential}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F]"
          >
            <Map className="h-3.5 w-3.5" />
            Open Site Potential
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
