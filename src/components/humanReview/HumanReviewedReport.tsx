import { AlertTriangle, CheckCircle2, HelpCircle, Lightbulb, ListChecks, ShieldCheck } from "lucide-react";
import {
  HUMAN_REVIEW_CORE_QUESTIONS,
  HUMAN_REVIEW_SCOPE_BOUNDARY,
  humanReviewFocusLabel,
  humanReviewIntendedUseLabel,
} from "@/lib/humanReview/scope";
import type { HumanReviewReportContent } from "@/lib/humanReview/reportContent";

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
  downloadAction?: React.ReactNode;
}) {
  const sections = [
    {
      id: "known",
      title: "What we know",
      eyebrow: "Property Truth",
      icon: CheckCircle2,
      items: content.known,
      empty: "No reviewed property facts have been recorded in this section yet.",
    },
    {
      id: "potential",
      title: "What appears possible",
      eyebrow: "Property Potential",
      icon: Lightbulb,
      items: content.potential,
      empty: "No evidence-supported property potential has been recorded yet.",
    },
    {
      id: "risks",
      title: "What could be a problem",
      eyebrow: "Risks & deal killers",
      icon: AlertTriangle,
      items: content.risks,
      empty: "No material reviewed risks have been recorded in this section yet.",
    },
    {
      id: "unknowns",
      title: "What we do not know yet",
      eyebrow: "Unknowns & conflicts",
      icon: HelpCircle,
      items: content.unknowns,
      empty: "No unresolved evidence gaps have been recorded in this section yet.",
    },
    {
      id: "next",
      title: "What should be verified next",
      eyebrow: "Next actions",
      icon: ListChecks,
      items: content.nextSteps,
      empty: "No next verification steps have been recorded yet.",
    },
  ] as const;

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
              {completedAt ? <span>· Reviewed {new Date(completedAt).toLocaleDateString("en-ZA")}</span> : null}
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
              <p className="mt-2 text-xs leading-5 text-white/60">
                Customer context: {context}
              </p>
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
              <span key={question} className="rounded-full bg-[#F7FBFF] px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] ring-1 ring-[#D9E6F2]">
                {question}
              </span>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
                      {section.eyebrow}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                      {section.title}
                    </h3>
                  </div>
                </div>
                {section.items.length ? (
                  <ul className="mt-4 space-y-2">
                    {section.items.map((item, index) => (
                      <li key={`${section.id}-${index}-${item}`} className="rounded-2xl bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A]/78 ring-1 ring-[#D9E6F2]/80">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[#64748B]">{section.empty}</p>
                )}
              </section>
            );
          })}
        </div>

        <footer className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 text-xs leading-5 text-[#64748B]">
          <strong className="text-[#0D1B2A]">Scope boundary:</strong> {HUMAN_REVIEW_SCOPE_BOUNDARY}
        </footer>
      </div>
    </article>
  );
}
