import { ArrowRight, CheckCircle2, MapPinned } from "lucide-react";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { BuildEnvelopeDiagram } from "@/components/property/sitePotential/BuildEnvelopeDiagram";
import { cn } from "@/lib/utils";

interface GuidedSitePotentialStepProps {
  workspaceState: ErfWorkspaceState;
  acceptedBuildEnvelope?: BuildEnvelopeResult | null;
  /** Legacy selected concepts may still exist in saved data but no longer drive this step. */
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
  const buildingAreaAccepted = Boolean(acceptedBuildEnvelope);
  const complete = buildingAreaAccepted || skipped;

  const statusLabel = skipped
    ? "Skipped for now"
    : buildingAreaAccepted
      ? "Building area accepted"
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
              Review the approximate building area
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Use the parcel boundary and the planning information available to review an approximate
              building area for this erf. Verified rules and working assumptions remain visibly
              separate. This is not municipal approval or an architectural plan.
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
              <MapPinned className="h-3.5 w-3.5" />
            )}
            {statusLabel}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <h4 className="text-sm font-semibold text-[#0D1B2A]">One clear task</h4>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            "Open Site Potential and check the parcel orientation and street-facing boundary.",
            "Review the approximate building area against the planning information and assumptions shown there.",
            "Accept the building area map, then return here and continue to the report.",
          ].map((line, index) => (
            <li key={line} className="flex gap-3 rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]/12 text-[11px] font-bold text-[#FF6A00]">
                {index + 1}
              </span>
              <span className="text-xs leading-5 text-[#0D1B2A]/68">{line}</span>
            </li>
          ))}
        </ol>

        <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          The building area is an investigation aid only. It does not establish legal buildability,
          development rights, approved building lines, or municipal approval.
        </p>

        {acceptedBuildEnvelope ? (
          <section className="mt-4 rounded-2xl border-2 border-emerald-300/55 bg-emerald-50/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Accepted work for this erf
                </div>
                <div className="mt-1 text-base font-bold text-[#0D1B2A]">
                  Building area map accepted
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                <CheckCircle2 className="h-3 w-3" /> Accepted
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              This is the building-area result currently attached to the investigation and available
              to the Easy Erf Report.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-[#0D1B2A]/10 bg-white p-2">
              <BuildEnvelopeDiagram result={acceptedBuildEnvelope} compact />
            </div>
            <button
              type="button"
              onClick={onOpenSitePotential}
              className="mt-3 inline-flex min-h-9 items-center rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
            >
              Review building area
            </button>
          </section>
        ) : skipped ? (
          <p className="mt-4 rounded-xl border border-emerald-300/45 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
            You skipped Site Potential for now. You can return later and accept a building area map;
            the report will update from the same erf file.
          </p>
        ) : (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-[#0D1B2A]/15 bg-[#F8FAFC] p-4">
            <div className="text-sm font-semibold text-[#0D1B2A]">No accepted building area yet</div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Open Site Potential, review the map, and accept it when the orientation and assumptions
              are correct. No AI image generation is required for this step.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSitePotential}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#FF7D1F]"
          >
            <MapPinned className="h-4 w-4" />
            {buildingAreaAccepted ? "Review Site Potential" : "Open Site Potential"}
          </button>
          <button
            type="button"
            disabled={!complete}
            onClick={onContinue}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Review report
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

export default GuidedSitePotentialStep;