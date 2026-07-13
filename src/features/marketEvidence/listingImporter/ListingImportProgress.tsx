import { Check, Loader2 } from "lucide-react";
import type { ListingImportPhase } from "./types";

const STEPS: Array<{ id: Exclude<ListingImportPhase, "idle">; label: string }> = [
  { id: "opening", label: "Connecting to import service" },
  { id: "extracting", label: "Waiting for listing analysis" },
  { id: "checking_missing", label: "Checking service response" },
  { id: "preparing_evidence", label: "Preparing review if data is returned" },
];

export function ListingImportProgress({ phase }: { phase: ListingImportPhase }) {
  const activeIndex = STEPS.findIndex((step) => step.id === phase);
  return (
    <ol className="space-y-2" aria-label="Import progress">
      {STEPS.map((step, index) => {
        const isDone = activeIndex > index;
        const isActive = activeIndex === index;
        return (
          <li
            key={step.id}
            className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-sm"
          >
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
                isDone
                  ? "bg-emerald-600 text-white"
                  : isActive
                    ? "bg-accent text-stone-900"
                    : "bg-stone-100 text-stone-500"
              }`}
              aria-hidden
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={
                isDone
                  ? "text-stone-500 line-through"
                  : isActive
                    ? "font-semibold text-stone-900"
                    : "text-stone-600"
              }
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
