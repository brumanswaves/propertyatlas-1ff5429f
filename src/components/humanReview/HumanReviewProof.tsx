import { CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import {
  DONE_FOR_YOU_INVESTIGATION_TAGLINE,
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
  DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS,
} from "@/lib/humanReview/scope";

const SAMPLE_REPORT = [
  {
    question: "What do we know?",
    answer:
      "The report identifies the exact parcel and summarizes the strongest available evidence, with the source and confidence kept visible.",
  },
  {
    question: "What appears possible?",
    answer:
      "The reviewer explains what the current planning and property evidence suggests may be possible, without presenting a working conclusion as an approval.",
  },
  {
    question: "What could be a problem?",
    answer:
      "Conflicting evidence, missing planning proof, title restrictions, site constraints and other issues that could affect the intended use are surfaced clearly.",
  },
  {
    question: "What do we not know yet?",
    answer:
      "Missing zoning, title, approved-plan, municipal or other property-specific evidence stays explicitly unknown instead of being guessed.",
  },
  {
    question: "What should be verified next?",
    answer:
      "The finished report ends with a short ordered checklist of the evidence or professional checks that would reduce the biggest remaining uncertainty.",
  },
] as const;

export function HumanReviewProof() {
  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#FF6A00]/25 bg-white shadow-soft">
      <div className="border-b border-[#0D1B2A]/10 bg-gradient-to-r from-[#FFF7ED] via-white to-[#F7FBFF] p-5 sm:p-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
          {DONE_FOR_YOU_INVESTIGATION_TAGLINE}
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A] sm:text-3xl">
          R999 is not just a final review. Easy Erf works through the property investigation for you.
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#64748B]">
          We reuse anything you already completed, then work through the standard Easy Erf investigation as far as the available evidence and inputs allow. Your selected focus tells the reviewer what matters most; it does not shrink the package to one narrow question.
        </p>
        <div className="mt-5 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS.map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-2xl border border-[#0D1B2A]/8 bg-white/85 p-3 text-xs leading-5 text-[#0D1B2A]/75">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A00]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[#FF6A00]/20 bg-white p-4 text-xs leading-5 text-[#64748B]">
          <strong className="text-[#0D1B2A]">Property data report included during Early Access:</strong>{" "}
          {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="p-5 sm:p-7">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            <FileCheck2 className="h-4 w-4" /> See the final deliverable before you pay
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
            The investigation ends in a Human-Reviewed Easy Erf Report.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
            The wording below is an illustrative example, not a conclusion about your property. It shows the clarity and structure of the finished report after the property investigation has been worked through.
          </p>

          <div className="mt-5 rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Example reviewer bottom line
            </div>
            <p className="mt-2 text-sm font-medium leading-6 text-[#0D1B2A]">
              “The current evidence supports the parcel identity and gives a useful working picture of the property, but property-specific planning and title evidence still need confirmation. Treat the apparent potential as something worth investigating further, not as an approved right.”
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SAMPLE_REPORT.map((item) => (
              <div key={item.question} className="rounded-[1.15rem] border border-[#0D1B2A]/8 bg-white p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A00]" />
                  <div>
                    <div className="text-xs font-semibold text-[#0D1B2A]">{item.question}</div>
                    <p className="mt-1 text-xs leading-5 text-[#64748B]">{item.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#0D1B2A]/10 bg-[#0D1B2A] p-5 text-white lg:border-l lg:border-t-0 sm:p-7">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
            <ShieldCheck className="h-4 w-4" /> What R999 includes
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/82">
            {[
              "One confirmed South African property",
              "The standard Easy Erf investigation completed or reviewed on your behalf",
              "One selected emphasis: Overall Property Check, Property Potential, or Check My Intended Use",
              "One third-party property data report reviewed during Early Access where available",
              "A structured Human-Reviewed web report saved to your Easy Erf account",
              "Clear facts, risks, unknowns and next verification steps",
              "No recurring subscription",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#FF8A33]" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock3 className="h-4 w-4 text-[#FF8A33]" /> What happens after payment
            </div>
            <p className="mt-2 text-xs leading-5 text-white/65">
              Payment is attached to your account and confirmed parcel. Easy Erf takes over the standard investigation, the human reviewer checks the evidence and selected emphasis, and the completed report appears in My Reports. The current early-access target is about 3 business days.
            </p>
          </div>

          <p className="mt-4 text-[11px] leading-5 text-white/52">
            The done-for-you investigation is property research and due-diligence support. It is not legal, engineering, architectural, valuation, tax or municipal approval advice. Additional paid professional or certified documents are not included unless explicitly stated.
          </p>
        </div>
      </div>
    </section>
  );
}
