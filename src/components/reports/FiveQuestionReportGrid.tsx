import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import type { FiveQuestionReportContent } from "@/lib/reports/fiveQuestionReport";

const SECTIONS = [
  { key: "known", eyebrow: "Property Truth", title: "What do we know?", icon: CheckCircle2 },
  { key: "potential", eyebrow: "Property Potential", title: "What appears possible?", icon: Lightbulb },
  { key: "risks", eyebrow: "Risks & deal killers", title: "What could be a problem?", icon: AlertTriangle },
  { key: "unknowns", eyebrow: "Unknowns & conflicts", title: "What do we not know yet?", icon: HelpCircle },
  { key: "nextSteps", eyebrow: "Next actions", title: "What should be verified next?", icon: ListChecks },
] as const;

export function FiveQuestionReportGrid({ content }: { content: FiveQuestionReportContent }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const items = content[section.key];
        return (
          <section key={section.key} className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
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
            <ul className="mt-4 space-y-2">
              {items.map((item, index) => (
                <li
                  key={`${section.key}-${index}-${item}`}
                  className="rounded-2xl bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A]/78 ring-1 ring-[#D9E6F2]/80"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
