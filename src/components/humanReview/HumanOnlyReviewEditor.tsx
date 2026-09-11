import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import {
  validateHumanReviewReportContent,
  type HumanReviewReportContent,
} from "../../../supabase/functions/_shared/easyErfHumanReviewContract";

const button = "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50";

function list(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function HumanOnlyReviewEditor({ disabled, eligible, blockers, onApprove }: {
  disabled: boolean;
  eligible: boolean;
  blockers: string[];
  onApprove: (content: HumanReviewReportContent) => Promise<void>;
}) {
  const [bottomLine, setBottomLine] = useState("");
  const [known, setKnown] = useState("");
  const [potential, setPotential] = useState("");
  const [risks, setRisks] = useState("");
  const [unknowns, setUnknowns] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const validated = validateHumanReviewReportContent({
      bottomLine,
      known: list(known),
      potential: list(potential),
      risks: list(risks),
      unknowns: list(unknowns),
      nextSteps: list(nextSteps),
    });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    await onApprove(validated.content);
  }

  const sections = [
    { label: "What do we know?", value: known, set: setKnown },
    { label: "What appears possible?", value: potential, set: setPotential },
    { label: "What could be a problem?", value: risks, set: setRisks },
    { label: "What do we not know yet?", value: unknowns, set: setUnknowns },
    { label: "What should be verified next?", value: nextSteps, set: setNextSteps },
  ];

  return <form onSubmit={(event) => void submit(event)} aria-label="Human-only investigation review"
    className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
    <div>
      <h3 className="font-semibold">Human-only reviewed report</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Use this when AI cannot use the available evidence. Review the full investigation yourself and write the customer summary here. Nothing entered in this form is sent to AI.
      </p>
    </div>
    <label className="block text-sm font-semibold">Bottom line
      <textarea required maxLength={1400} value={bottomLine} onChange={(event) => setBottomLine(event.target.value)}
        className="mt-2 min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm" />
    </label>
    {sections.map((section) => <label key={section.label} className="block text-sm font-semibold">{section.label}
      <span className="mt-1 block text-xs font-normal text-muted-foreground">One concise finding per line, maximum eight.</span>
      <textarea required maxLength={5608} value={section.value} onChange={(event) => section.set(event.target.value)}
        className="mt-2 min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm" />
    </label>)}
    {!eligible && <p className="text-sm">Unresolved investigation work: {blockers.join("; ")}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button type="submit" className={button} disabled={disabled || !eligible}>
      <ShieldCheck className="h-4 w-4" /> Approve human-only reviewed version
    </button>
    <p className="text-xs text-muted-foreground">
      Approval freezes the current evidence revision and human summary. It does not enable AI, change document permissions, deliver the report or send email.
    </p>
  </form>;
}
