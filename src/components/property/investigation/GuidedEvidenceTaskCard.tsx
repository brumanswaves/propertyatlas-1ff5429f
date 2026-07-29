import { useState } from "react";
import { ArrowRight, Clock3, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuidedEvidenceTask } from "@/lib/investigation/types";

/**
 * One guided evidence task, presented as the single obvious next action.
 *
 * The card never invents an upload control: every action routes into a tool
 * that already exists in the Workbench.
 */
export function GuidedEvidenceTaskCard({
  task,
  onPrimaryAction,
  onSkip,
  className,
}: {
  task: GuidedEvidenceTask;
  onPrimaryAction: (task: GuidedEvidenceTask) => void;
  onSkip?: (task: GuidedEvidenceTask) => void;
  className?: string;
}) {
  const [showSteps, setShowSteps] = useState(false);

  return (
    <section
      aria-label="Next guided evidence task"
      className={cn(
        "rounded-[1.75rem] border border-[#FF8A33]/25 bg-[#06152A] p-5 text-white shadow-[0_28px_70px_-38px_rgba(0,0,0,0.9)] md:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00]/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFC694]">
          <Sparkles className="h-3.5 w-3.5" />
          Next best evidence
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold text-white/70">
          <Clock3 className="h-3.5 w-3.5" />
          About {task.estimatedMinutes} min
        </span>
        {task.status === "completed" && (
          <span className="rounded-full bg-emerald-400/16 px-3 py-1 text-[11px] font-semibold text-emerald-100">
            Completed
          </span>
        )}
      </div>

      <h3 className="mt-3 text-2xl font-semibold tracking-tight">{task.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">{task.shortExplanation}</p>

      <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
          Why it matters
        </div>
        <p className="mt-1.5 text-sm leading-6 text-white/78">{task.whyItMatters}</p>
        {task.limitations && (
          <p className="mt-2 text-xs leading-5 text-white/58">{task.limitations}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {task.improves.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/72"
          >
            Improves {item}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPrimaryAction(task)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#FF7D1F]"
        >
          {task.primaryActionLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowSteps((value) => !value)}
          aria-expanded={showSteps}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
        >
          <HelpCircle className="h-4 w-4" />
          {showSteps ? "Hide steps" : "Show me how"}
        </button>
        {task.canSkip && onSkip && (
          <button
            type="button"
            onClick={() => onSkip(task)}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white/62 transition hover:text-white"
          >
            Skip for now
          </button>
        )}
      </div>

      {showSteps && (
        <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            How to do it
          </div>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-white/78">
            {task.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl border border-[#FF8A33]/25 bg-[#FF6A00]/10 px-3 py-2 text-xs leading-5 text-white/78">
            After you do this: {task.afterCompletion}
          </p>
          {(task.sourceUrl || task.extraSources?.length) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {task.sourceUrl && (
                <a
                  href={task.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-xs font-semibold text-[#FFC694] underline"
                >
                  Open {task.sourceLabel ?? "the source"}
                </a>
              )}
              {task.extraSources?.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-xs font-semibold text-[#FFC694] underline"
                >
                  Open {source.label}
                </a>
              ))}
            </div>
          )}

          {task.requestTemplate && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
                Request message you can send
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/72">
                {task.requestTemplate}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default GuidedEvidenceTaskCard;
