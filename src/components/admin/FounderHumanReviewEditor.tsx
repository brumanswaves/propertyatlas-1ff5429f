import { useMemo, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_HUMAN_REVIEW_REPORT_CONTENT,
  parseHumanReviewReportContent,
  type HumanReviewReportContent,
} from "@/lib/humanReview/reportContent";

function listText(values: string[]) {
  return values.join("\n");
}

function parseList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function FounderHumanReviewEditor({
  orderId,
  initialContent,
  disabled = false,
  onSaved,
}: {
  orderId: string;
  initialContent: unknown;
  disabled?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const parsed = useMemo(
    () => parseHumanReviewReportContent(initialContent) ?? EMPTY_HUMAN_REVIEW_REPORT_CONTENT,
    [initialContent],
  );
  const [bottomLine, setBottomLine] = useState(parsed.bottomLine);
  const [known, setKnown] = useState(listText(parsed.known));
  const [potential, setPotential] = useState(listText(parsed.potential));
  const [risks, setRisks] = useState(listText(parsed.risks));
  const [unknowns, setUnknowns] = useState(listText(parsed.unknowns));
  const [nextSteps, setNextSteps] = useState(listText(parsed.nextSteps));
  const [saving, setSaving] = useState(false);

  async function save() {
    const content: HumanReviewReportContent = {
      bottomLine: bottomLine.trim(),
      known: parseList(known),
      potential: parseList(potential),
      risks: parseList(risks),
      unknowns: parseList(unknowns),
      nextSteps: parseList(nextSteps),
    };
    if (!content.bottomLine) {
      toast.error("Add a reviewed bottom line first.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke("easy-erf-founder-review-content", {
      body: { orderId, content },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Human Review content could not be saved.");
      return;
    }
    toast.success("Human Review web report saved");
    await onSaved?.();
  }

  const listFields = [
    ["What we know", known, setKnown],
    ["What appears possible", potential, setPotential],
    ["Risks / deal killers", risks, setRisks],
    ["Unknowns / conflicts", unknowns, setUnknowns],
    ["What should be verified next", nextSteps, setNextSteps],
  ] as const;

  return (
    <details className="mt-4 rounded-2xl border border-[#FF6A00]/25 bg-[#FFF7ED] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#0D1B2A]">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#FF6A00]" /> Write / edit Human-Reviewed web report
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            Bottom line
          </span>
          <textarea
            value={bottomLine}
            onChange={(event) => setBottomLine(event.target.value)}
            rows={4}
            maxLength={1400}
            disabled={disabled || saving}
            placeholder="Concise reviewer conclusion based on the evidence. No legal/professional conclusion."
            className="mt-1 w-full rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00] disabled:opacity-60"
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          {listFields.map(([label, value, setter]) => (
            <label key={label} className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                {label}
              </span>
              <textarea
                value={value}
                onChange={(event) => setter(event.target.value)}
                rows={6}
                disabled={disabled || saving}
                placeholder="One concise reviewed item per line (maximum 8)."
                className="mt-1 w-full rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00] disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-xs leading-5 text-[#64748B]">
          Review conclusions must stay inside the selected Easy Erf scope. Do not write legal opinions, municipal approvals, formal valuations, engineering/architectural conclusions, construction quotations or buy/do-not-buy recommendations.
        </div>

        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save web report"}
        </button>
      </div>
    </details>
  );
}
