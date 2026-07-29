import { cn } from "@/lib/utils";
import type { ReportDecisionMode } from "@/lib/reports/reportDecisionMode";

const OPTIONS: Array<{ mode: ReportDecisionMode; label: string; hint: string }> = [
  { mode: "standard", label: "Standard", hint: "Buyer due diligence" },
  { mode: "investor", label: "Investor", hint: "Returns, assumptions & downside" },
];

/**
 * The single obvious report-view control. It lives in the first report
 * viewport, directly below the report header and before Ask Easy Erf.
 */
export function ReportViewSelector({
  mode,
  onChange,
  compact = false,
}: {
  mode: ReportDecisionMode;
  onChange: (mode: ReportDecisionMode) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="report-view-selector-compact report-no-print inline-flex shrink-0 rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] p-0.5"
        role="group"
        aria-label="Report view"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            aria-pressed={mode === option.mode}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold transition",
              mode === option.mode
                ? "bg-[#0D1B2A] text-white shadow-sm"
                : "text-[#0D1B2A]/65 hover:text-[#0D1B2A]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="report-view-selector report-no-print rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4 shadow-[0_18px_45px_-40px_rgba(13,27,42,0.42)] sm:p-5"
      role="group"
      aria-label="Report view"
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
        Report view
      </div>
      <p className="mt-1 text-xs leading-5 text-[#64748B]">
        Choose how this report is composed. Your choice is remembered for this erf.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => onChange(option.mode)}
              aria-pressed={active}
              className={cn(
                "flex min-h-[3.5rem] w-full flex-col items-start gap-0.5 rounded-[1.15rem] border px-4 py-3 text-left transition",
                active
                  ? "border-[#FF6A00] bg-[#0D1B2A] text-white shadow-[0_14px_30px_-22px_rgba(13,27,42,0.8)]"
                  : "border-[#0D1B2A]/12 bg-[#F7FBFF] text-[#0D1B2A] hover:border-[#FF6A00]/40 hover:bg-white",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                {option.label}
                {active && (
                  <span className="rounded-full bg-[#FF6A00] px-2 py-[1px] text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                    Active
                  </span>
                )}
              </span>
              <span
                className={cn("text-[11px] leading-4", active ? "text-white/70" : "text-[#64748B]")}
              >
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReportViewActiveLabel({ mode }: { mode: ReportDecisionMode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A]/75">
      <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
      {mode === "investor" ? "Investor view active" : "Standard view active"}
    </div>
  );
}
