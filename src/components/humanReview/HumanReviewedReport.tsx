import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import {
  HUMAN_REVIEW_CORE_QUESTIONS,
  HUMAN_REVIEW_SCOPE_BOUNDARY,
  humanReviewFocusLabel,
  humanReviewIntendedUseLabel,
} from "@/lib/humanReview/scope";
import type { HumanReviewReportContent } from "@/lib/humanReview/reportContent";
import { FiveQuestionReportGrid } from "@/components/reports/FiveQuestionReportGrid";

export function HumanReviewedReport({
  propertyReference,
  focus,
  intendedUse,
  context,
  content,
  completedAt,
  downloadAction,
}: {
  propertyReference: string;
  focus?: string | null;
  intendedUse?: string | null;
  context?: string | null;
  content: HumanReviewReportContent;
  completedAt?: string | null;
  downloadAction?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] shadow-[0_28px_80px_-55px_rgba(13,27,42,0.65)]">
      <header className="bg-[#0D1B2A] px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              <ShieldCheck className="h-3.5 w-3.5" /> Human Reviewed · Easy Erf
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {propertyReference}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/68">
              <span>{humanReviewFocusLabel(focus)}</span>
              {humanReviewIntendedUseLabel(intendedUse) ? (
                <span>· {humanReviewIntendedUseLabel(intendedUse)}</span>
              ) : null}
              {completedAt ? (
                <span>· Reviewed {new Date(completedAt).toLocaleDateString("en-ZA")}</span>
              ) : null}
            </div>
          </div>
          {downloadAction ? <div className="report-no-print">{downloadAction}</div> : null}
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              Bottom line
            </div>
            <p className="mt-3 text-base leading-7 text-white/88 sm:text-lg">
              {content.bottomLine || "The reviewed bottom line has not been recorded yet."}
            </p>
          </section>
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
              Investigation focus
            </div>
            <div className="mt-2 text-lg font-semibold">{humanReviewFocusLabel(focus)}</div>
            {context ? (
              <p className="mt-2 text-xs leading-5 text-white/60">Customer context: {context}</p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-white/50">
                The report stays within the selected Easy Erf investigation scope.
              </p>
            )}
          </section>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Every Human Review answers the same five questions
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {HUMAN_REVIEW_CORE_QUESTIONS.map((question) => (
              <span
                key={question}
                className="rounded-full bg-[#F7FBFF] px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] ring-1 ring-[#D9E6F2]"
              >
                {question}
              </span>
            ))}
          </div>
        </section>

        <FiveQuestionReportGrid
          content={{
            known: content.known,
            potential: content.potential,
            risks: content.risks,
            unknowns: content.unknowns,
            nextSteps: content.nextSteps,
          }}
        />
      </div>

      <footer className="border-t border-[#0D1B2A]/10 bg-white px-5 py-4 text-xs leading-5 text-[#64748B] sm:px-8">
        <strong className="text-[#0D1B2A]">Scope boundary:</strong> {HUMAN_REVIEW_SCOPE_BOUNDARY}
      </footer>
    </article>
  );
}
