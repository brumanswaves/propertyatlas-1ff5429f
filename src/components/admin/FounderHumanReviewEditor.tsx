import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileSearch2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS,
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
} from "@/lib/humanReview/scope";
import {
  createPendingHumanReviewInvestigationChecklist,
  EMPTY_HUMAN_REVIEW_REPORT_CONTENT,
  isHumanReviewInvestigationChecklistResolved,
  parseHumanReviewInvestigationChecklist,
  parseHumanReviewReportContent,
  type HumanReviewInvestigationChecklist,
  type HumanReviewInvestigationChecklistStatus,
  type HumanReviewReportContent,
} from "@/lib/humanReview/reportContent";

const CHECKLIST_STATUS_OPTIONS: Array<{
  value: HumanReviewInvestigationChecklistStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "complete", label: "Complete" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "Not applicable" },
];

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

function checklistTone(status: HumanReviewInvestigationChecklistStatus) {
  if (status === "complete") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "not_applicable") return "border-slate-300 bg-slate-50 text-slate-700";
  if (status === "blocked") return "border-rose-300 bg-rose-50 text-rose-800";
  return "border-amber-300 bg-amber-50 text-amber-800";
}

export function FounderHumanReviewEditor({
  orderId,
  initialContent,
  disabled = false,
  defaultOpen = false,
  onSaved,
}: {
  orderId: string;
  initialContent: unknown;
  disabled?: boolean;
  defaultOpen?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const parsed = useMemo(
    () => parseHumanReviewReportContent(initialContent) ?? EMPTY_HUMAN_REVIEW_REPORT_CONTENT,
    [initialContent],
  );
  const parsedChecklist = useMemo(
    () =>
      parseHumanReviewInvestigationChecklist(initialContent) ??
      createPendingHumanReviewInvestigationChecklist(),
    [initialContent],
  );
  const [bottomLine, setBottomLine] = useState(parsed.bottomLine);
  const [known, setKnown] = useState(listText(parsed.known));
  const [potential, setPotential] = useState(listText(parsed.potential));
  const [risks, setRisks] = useState(listText(parsed.risks));
  const [unknowns, setUnknowns] = useState(listText(parsed.unknowns));
  const [nextSteps, setNextSteps] = useState(listText(parsed.nextSteps));
  const [checklist, setChecklist] = useState<HumanReviewInvestigationChecklist>(parsedChecklist);
  const [saving, setSaving] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const sectionValues = useMemo(
    () => [bottomLine, known, potential, risks, unknowns, nextSteps],
    [bottomLine, known, potential, risks, unknowns, nextSteps],
  );
  const completedSections = sectionValues.filter((value) => value.trim().length > 0).length;
  const resolvedChecklistItems = DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.filter((item) => {
    const status = checklist[item.id];
    return status === "complete" || status === "not_applicable";
  }).length;
  const blockedChecklistItems = DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.filter(
    (item) => checklist[item.id] === "blocked",
  ).length;
  const checklistResolved = isHumanReviewInvestigationChecklistResolved(checklist);
  const busy = saving || savingChecklist;

  function setChecklistStatus(
    id: keyof HumanReviewInvestigationChecklist,
    status: HumanReviewInvestigationChecklistStatus,
  ) {
    setChecklist((current) => ({ ...current, [id]: status }));
  }

  async function saveChecklist() {
    setSavingChecklist(true);
    const { data, error } = await supabase.functions.invoke(
      "easy-erf-founder-review-content",
      {
        body: {
          orderId,
          action: "save_checklist",
          checklist,
        },
      },
    );
    setSavingChecklist(false);
    if (error || !data?.ok) {
      toast.error(
        data?.error ?? error?.message ?? "The investigation checklist could not be saved.",
      );
      return;
    }
    toast.success("Standard investigation checklist saved");
    await onSaved?.();
  }

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
    if (
      content.known.length === 0 ||
      content.potential.length === 0 ||
      content.risks.length === 0 ||
      content.unknowns.length === 0 ||
      content.nextSteps.length === 0
    ) {
      toast.error(
        "Complete all five report sections before saving. Use an explicit ‘None identified from current evidence’ item when that is the reviewed conclusion.",
      );
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke("easy-erf-founder-review-content", {
      body: { orderId, action: "save_report", content },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Human Review content could not be saved.");
      return;
    }
    toast.success("Human-Reviewed Easy Erf Report saved");
    await onSaved?.();
  }

  const listFields = [
    {
      label: "What do we know?",
      help: "Only findings supported by the completed/reviewed property investigation or evidence. Name the source/evidence in the wording when useful.",
      example: "Official parcel identity is supported by the CSG LPI and mapped parcel record.",
      value: known,
      setter: setKnown,
    },
    {
      label: "What appears possible?",
      help: "Working potential supported by current evidence. Say ‘appears’, ‘suggests’ or ‘may’ when it is not verified.",
      example: "Available planning evidence suggests residential development may be relevant, subject to property-specific confirmation.",
      value: potential,
      setter: setPotential,
    },
    {
      label: "What could be a problem?",
      help: "Risks, conflicts, restrictions or evidence gaps found while working through the standard investigation that could materially change the user’s plan.",
      example: "Property-specific zoning confirmation is still missing and could change the development assumptions.",
      value: risks,
      setter: setRisks,
    },
    {
      label: "What do we not know yet?",
      help: "Keep unknowns explicit. Do not fill a missing fact with a likely answer or treat an unavailable paid/professional document as if it was obtained.",
      example: "No reviewed title-deed restriction evidence is currently attached to the property file.",
      value: unknowns,
      setter: setUnknowns,
    },
    {
      label: "What should be verified next?",
      help: "Short, ordered actions that reduce the biggest remaining uncertainty after the standard investigation is complete/reviewed.",
      example: "Obtain or confirm the property-specific zoning position, then review title restrictions before relying on the build scenario.",
      value: nextSteps,
      setter: setNextSteps,
    },
  ] as const;

  return (
    <details
      open={defaultOpen || undefined}
      className="mt-4 rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-4 sm:p-5"
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#0D1B2A]">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#FF6A00]" /> Complete investigation and final report
        </span>
      </summary>

      <div className="mt-4 space-y-5">
        <div className="rounded-[1.25rem] border border-[#FF6A00]/20 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#0D1B2A]">
                Standard done-for-you investigation checklist
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">
                Record the operational state of every standard investigation area. This does not
                create a second evidence model. Findings and source truth remain in the canonical
                property file and final report.
              </p>
            </div>
            <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                Resolved
              </div>
              <div className="mt-1 text-2xl font-semibold text-[#0D1B2A]">
                {resolvedChecklistItems}/{DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.length}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.map((item) => {
              const status = checklist[item.id];
              const StatusIcon = status === "complete" ? CheckCircle2 : status === "blocked"
                ? AlertTriangle
                : CircleDashed;
              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-[#0D1B2A]/8 bg-[#F7FBFF] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <StatusIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        status === "complete"
                          ? "text-emerald-700"
                          : status === "blocked"
                            ? "text-rose-700"
                            : "text-[#64748B]"
                      }`}
                    />
                    <span className="text-xs leading-5 text-[#0D1B2A]">{item.label}</span>
                  </div>
                  <select
                    aria-label={`${item.label} status`}
                    value={status}
                    disabled={disabled || busy}
                    onChange={(event) =>
                      setChecklistStatus(
                        item.id,
                        event.target.value as HumanReviewInvestigationChecklistStatus,
                      )}
                    className={`min-h-10 rounded-xl border px-3 text-xs font-semibold outline-none focus:border-[#FF6A00] disabled:opacity-60 ${checklistTone(status)}`}
                  >
                    {CHECKLIST_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void saveChecklist()}
              className="inline-flex items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2.5 text-xs font-semibold text-[#0D1B2A] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingChecklist ? "Saving checklist…" : "Save checklist"}
            </button>
            {checklistResolved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Every applicable investigation area is resolved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Delivery remains blocked while any item is Pending or Blocked
                {blockedChecklistItems > 0 ? ` (${blockedChecklistItems} blocked)` : ""}
              </span>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-5 text-[#64748B]">
            Use Not applicable only when the investigation area genuinely does not apply to this
            property or customer purpose. It is not a skip control.
          </p>
          <p className="mt-3 text-[11px] leading-5 text-[#92400E]">
            <strong>Property-data-report rule:</strong> {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY} A
            Lightstone or other branded provider PDF must not be redistributed unless the
            applicable provider/report terms permit it.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="text-sm font-semibold text-[#0D1B2A]">How to complete this report</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["1", "Complete the investigation", "Work through the standard Easy Erf investigation and the customer’s selected emphasis."],
                ["2", "Review the evidence", "Resolve what you reasonably can; preserve provenance, conflicts and real missing evidence."],
                ["3", "Write the bottom line", "Use 2 to 5 concise sentences. State the useful conclusion and biggest limitation."],
                ["4", "Fill all five sections", "Add one reviewed finding per line. Keep unknowns unknown. Maximum eight items per section."],
                ["5", "Save, then deliver", "Save both the checklist and web report. Mark ready only after all applicable checklist items are resolved."],
              ].map(([number, title, body]) => (
                <div key={number} className="rounded-2xl border border-[#0D1B2A]/8 bg-white p-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-[#0D1B2A] text-[10px] font-bold text-white">{number}</div>
                  <div className="mt-2 text-xs font-semibold text-[#0D1B2A]">{title}</div>
                  <p className="mt-1 text-[11px] leading-4 text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Report completeness</div>
            <div className="mt-1 text-2xl font-semibold text-[#0D1B2A]">{completedSections}/6</div>
          </div>
        </div>

        <label className="block rounded-2xl border border-[#0D1B2A]/8 bg-white p-4">
          <span className="text-xs font-semibold text-[#0D1B2A]">Bottom line</span>
          <p className="mt-1 text-[11px] leading-4 text-[#64748B]">
            The customer should understand the current conclusion, the biggest caveat and what that means in plain English after the property investigation has been worked through.
          </p>
          <textarea
            value={bottomLine}
            onChange={(event) => setBottomLine(event.target.value)}
            rows={4}
            maxLength={1400}
            disabled={disabled || busy}
            placeholder="Example: The parcel identity is supported and the current evidence gives a useful working picture, but property-specific planning/title confirmation is still incomplete. Treat the apparent potential as worth investigating, not as an approved right."
            className="mt-3 w-full rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00] disabled:opacity-60"
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          {listFields.map((field) => (
            <label key={field.label} className="block rounded-2xl border border-[#0D1B2A]/8 bg-white p-4">
              <span className="text-xs font-semibold text-[#0D1B2A]">{field.label}</span>
              <p className="mt-1 text-[11px] leading-4 text-[#64748B]">{field.help}</p>
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#F7FBFF] px-3 py-2 text-[11px] leading-4 text-[#64748B]">
                <FileSearch2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A00]" />
                <span><strong className="text-[#0D1B2A]">Example wording:</strong> {field.example}</span>
              </div>
              <textarea
                value={field.value}
                onChange={(event) => field.setter(event.target.value)}
                rows={6}
                disabled={disabled || busy}
                placeholder="One concise reviewed item per line (maximum 8)."
                className="mt-3 w-full rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00] disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-xs leading-5 text-[#64748B]">
          The done-for-you investigation is property research and due-diligence support. Do not write legal opinions, municipal approvals, formal valuations, engineering/architectural conclusions, construction quotations or buy/do-not-buy recommendations.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save web report"}
          </button>
          {completedSections === 6 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> All report sections have content
            </span>
          ) : (
            <span className="text-xs text-[#64748B]">Complete all six report areas before saving the final report.</span>
          )}
        </div>
      </div>
    </details>
  );
}
