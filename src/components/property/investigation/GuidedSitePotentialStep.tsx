import { ArrowRight, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { cn } from "@/lib/utils";

interface GuidedSitePotentialStepProps {
  workspaceState: ErfWorkspaceState;
  stepSkipped?: boolean;
  onOpenSitePotential: () => void;
  onContinue: () => void;
}

export function GuidedSitePotentialStep({
  workspaceState,
  stepSkipped = false,
  onOpenSitePotential,
  onContinue,
}: GuidedSitePotentialStepProps) {
  const site = workspaceState.sitePotential;
  const skipped = stepSkipped || site.skipped || site.progressState === "skipped";
  const designSelected = Boolean(site.selectedDesignAssetId);
  const conceptCount = site.conceptCount;
  const complete = designSelected || skipped;
  const partial = !complete && conceptCount > 0;

  const statusLabel = skipped
    ? "Skipped for now"
    : designSelected
      ? "Preferred concept selected"
      : partial
        ? `${conceptCount} concept${conceptCount === 1 ? "" : "s"} generated, choose one`
        : "No concepts yet";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Site potential
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Explore what this erf could become
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Generate visual concepts for a new build, renovation, or another use. Concepts are
              illustrative only. They are not architectural plans, are not approved, and do not
              establish the legal build envelope.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              complete
                ? "bg-emerald-100 text-emerald-800"
                : partial
                  ? "bg-amber-100 text-amber-900"
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
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Property / build envelope</div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">Easy Erf uses the parcel boundary plus the planning information available to show the approximate area that may be available for building. Verified rules and working assumptions remain visibly different.</p>
          </div>
          <div className="rounded-xl border border-[#0D1B2A]/8 bg-[#F8FAFC] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">AI visual concepts</div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">Easy Erf can create three visual ideas for what a home or renovation could look like using your brief, parcel context and uploaded photos or plans.</p>
          </div>
        </div>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#0D1B2A]/70">
          {[
            "A. Choose the current site state: vacant land, existing house, other, or not sure.",
            "B. Review the parcel and approximate build envelope.",
            "C. Optionally upload site photos, topography, existing plans or inspiration.",
            "D. Set the style, bedrooms, features and your custom brief.",
            "E. Generate three concepts using the available free allowance or credits.",
            "F. Choose the preferred concept for the Easy Erf Report.",
          ].map((line, index) => (
            <li key={line} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]/12 text-[11px] font-bold text-[#FF6A00]">{index + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">AI images are illustrative. The build envelope is not an approval. Neither replaces an architect or municipal confirmation.</p>

        {partial ? (
          <p className="mt-4 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Concepts have been generated, but none is selected yet. Open Site Potential and choose a
            preferred concept, or use Skip for now to continue without one.
          </p>
        ) : null}

        {skipped ? (
          <p className="mt-4 rounded-xl border border-emerald-300/45 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
            You skipped Site Potential for now. You can still open it, create or select a concept,
            and add that concept to the report later.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSitePotential}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F]"
          >
            <Sparkles className="h-3.5 w-3.5" />
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
