import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";

interface GuidedStrategyStepProps {
  chosenScenario: ErfStrategyScenario | null;
  savedScenarioCount: number;
  onOpenStrategy: () => void;
  onContinue: () => void;
}

export function GuidedStrategyStep({
  chosenScenario,
  savedScenarioCount,
  onOpenStrategy,
  onContinue,
}: GuidedStrategyStepProps) {
  const complete = Boolean(chosenScenario) || savedScenarioCount > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Strategy & Calculators
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Now turn the property evidence into a decision
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Test the option you are considering, save its assumptions, and choose the scenario
              Easy Erf should carry into the report. Calculator results are estimates from your
              inputs, not valuations or financial advice.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0D1B2A]">
            {complete ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Calculator className="h-3.5 w-3.5 text-[#FF6A00]" />}
            {chosenScenario ? "Scenario chosen" : savedScenarioCount ? `${savedScenarioCount} scenario${savedScenarioCount === 1 ? "" : "s"} saved` : "No scenario saved"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <p className="text-sm font-semibold text-[#0D1B2A]">What you can test</p>
        <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/66">
          Purchase and acquisition cost, maximum offer, build or development feasibility, resale
          value, profit, residual land value, rental cash flow, yield, returns, price per m²,
          break-even and sensitivity.
        </p>

        {chosenScenario ? (
          <div className="mt-4 rounded-xl border border-emerald-300/45 bg-emerald-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
              Chosen for the Easy Erf Report
            </div>
            <div className="mt-1 text-sm font-semibold text-[#0D1B2A]">{chosenScenario.label}</div>
            {chosenScenario.summary.length ? (
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {chosenScenario.summary.slice(0, 4).map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-lg bg-white/75 px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748B]">{item.label}</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-[#0D1B2A]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenStrategy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F]">
            <Calculator className="h-3.5 w-3.5" />
            Open Strategy & Calculators
          </button>
          <button type="button" disabled={!complete} onClick={onContinue} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:cursor-not-allowed disabled:opacity-50">
            Continue to Site Potential
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

export default GuidedStrategyStep;
