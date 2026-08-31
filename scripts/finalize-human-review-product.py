from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def require_absent(path: str, needle: str):
    text = Path(path).read_text()
    if needle in text:
        raise SystemExit(f"{path}: forbidden text still present: {needle!r}")


# ---------------------------------------------------------------------------
# Controlled customer scope: exactly three goals, six intended uses, 500-char
# context, and an explicit acknowledgement before checkout.
# ---------------------------------------------------------------------------
Path("src/lib/humanReview/scope.ts").write_text('''export const HUMAN_REVIEW_FOCUS_OPTIONS = [
  {
    id: "property_check",
    label: "Property Check",
    shortLabel: "Property Check",
    description:
      "The important property facts, risks, conflicts, unknowns and checks still worth completing.",
  },
  {
    id: "property_potential",
    label: "Property Potential",
    shortLabel: "Property Potential",
    description:
      "What the available planning and property evidence suggests may be possible, with limitations clearly labelled.",
  },
  {
    id: "intended_use",
    label: "Check My Intended Use",
    shortLabel: "Intended Use",
    description:
      "Whether the evidence supports or conflicts with one selected intended use and what still needs professional confirmation.",
  },
] as const;

export type HumanReviewFocus = (typeof HUMAN_REVIEW_FOCUS_OPTIONS)[number]["id"];

export const HUMAN_REVIEW_INTENDED_USE_OPTIONS = [
  { id: "single_dwelling", label: "Build a single dwelling" },
  { id: "second_dwelling", label: "Add a second dwelling" },
  { id: "renovate_extend", label: "Renovate or extend an existing dwelling" },
  { id: "subdivide", label: "Investigate subdivision potential" },
  { id: "rental_property", label: "Use or hold it as a rental property" },
  { id: "vacant_land_hold", label: "Hold it as vacant land" },
] as const;

export type HumanReviewIntendedUse =
  (typeof HUMAN_REVIEW_INTENDED_USE_OPTIONS)[number]["id"];

export const HUMAN_REVIEW_CORE_QUESTIONS = [
  "What do we know?",
  "What appears possible?",
  "What could be a problem?",
  "What do we not know yet?",
  "What should be verified next?",
] as const;

export const HUMAN_REVIEW_CONTEXT_MAX_LENGTH = 500;

export const HUMAN_REVIEW_SCOPE_BOUNDARY =
  "Easy Erf provides property research and due-diligence support. It does not provide legal, tax, engineering, architectural, valuation or other professional advice, municipal approval, a zoning certificate, a construction quotation, or a buy / do-not-buy recommendation.";

export const HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT =
  "I understand Easy Erf provides property research and due-diligence support, not legal, engineering, architectural, valuation, tax, municipal or approval advice.";

export const HUMAN_REVIEW_NOT_INCLUDED = [
  "Legal opinions or confirmation of legal rights",
  "Title, conveyancing or tax advice",
  "Engineering, structural or architectural sign-off",
  "Municipal approval or a zoning certificate",
  "Formal property valuations",
  "Construction quotations or Easy Erf-generated build-cost estimates",
  "Investment recommendations such as buy or do not buy",
] as const;

export function isHumanReviewFocus(value: unknown): value is HumanReviewFocus {
  return HUMAN_REVIEW_FOCUS_OPTIONS.some((option) => option.id === value);
}

export function isHumanReviewIntendedUse(value: unknown): value is HumanReviewIntendedUse {
  return HUMAN_REVIEW_INTENDED_USE_OPTIONS.some((option) => option.id === value);
}

export function humanReviewFocusLabel(value: string | null | undefined) {
  return HUMAN_REVIEW_FOCUS_OPTIONS.find((option) => option.id === value)?.label ?? "Property Check";
}

export function humanReviewIntendedUseLabel(value: string | null | undefined) {
  return HUMAN_REVIEW_INTENDED_USE_OPTIONS.find((option) => option.id === value)?.label ?? null;
}

export function buildHumanReviewHref({
  parcelId,
  propertyReference,
  source,
}: {
  parcelId?: string | null;
  propertyReference?: string | null;
  source?: string | null;
}) {
  const params = new URLSearchParams();
  if (parcelId?.trim()) params.set("parcelId", parcelId.trim());
  if (propertyReference?.trim()) params.set("propertyReference", propertyReference.trim());
  if (source?.trim()) params.set("source", source.trim());
  const query = params.toString();
  return query ? `/pricing?${query}` : "/pricing";
}
''')

contract = Path("supabase/functions/_shared/easyErfHumanReviewContract.ts")
text = contract.read_text()
text = text.replace('''export const HUMAN_REVIEW_FOCUS_VALUES = [
  "property_check",
  "before_i_buy",
  "property_potential",
  "intended_use",
] as const;''', '''export const HUMAN_REVIEW_FOCUS_VALUES = [
  "property_check",
  "property_potential",
  "intended_use",
] as const;''')
text = text.replace("const MAX_CONTEXT_LENGTH = 600;", "const MAX_CONTEXT_LENGTH = 500;")
text = text.replace('''export type HumanReviewCheckoutRequest = {
  focus: HumanReviewFocus;
  intendedUse: HumanReviewIntendedUse | null;
  context: string | null;
  parcelId: string | null;
  propertyReferenceHint: string | null;
  sourceSurface: string | null;
};''', '''export type HumanReviewCheckoutRequest = {
  focus: HumanReviewFocus;
  intendedUse: HumanReviewIntendedUse | null;
  context: string | null;
  parcelId: string | null;
  propertyReferenceHint: string | null;
  sourceSurface: string | null;
  scopeAcknowledged: true;
};''')
needle = '''  if (!isFocus(value.focus)) {
    return { ok: false, error: "Choose one supported Human Review focus." };
  }

  const intendedUse'''
replacement = '''  if (!isFocus(value.focus)) {
    return { ok: false, error: "Choose one supported Human Review focus." };
  }
  if (value.scopeAcknowledged !== true) {
    return { ok: false, error: "Acknowledge the Human Review scope before checkout." };
  }

  const intendedUse'''
if text.count(needle) != 1:
    raise SystemExit("human review contract acknowledgement anchor mismatch")
text = text.replace(needle, replacement, 1)
text = text.replace('''      propertyReferenceHint,
      sourceSurface,
    },''', '''      propertyReferenceHint,
      sourceSurface,
      scopeAcknowledged: true,
    },''', 1)
contract.write_text(text)

# Pricing intake UX.
pricing = Path("src/routes/pricing.tsx")
p = pricing.read_text()
p = p.replace(
    "  HUMAN_REVIEW_SCOPE_BOUNDARY,\n",
    "  HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT,\n  HUMAN_REVIEW_SCOPE_BOUNDARY,\n",
    1,
)
p = p.replace(
    '  const [context, setContext] = useState("");\n',
    '  const [context, setContext] = useState("");\n  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);\n',
    1,
)
p = p.replace(
    '''  const canCheckout = Boolean(
    focus && (focus !== "intended_use" || intendedUse) && context.length <= HUMAN_REVIEW_CONTEXT_MAX_LENGTH,
  );''',
    '''  const canCheckout = Boolean(
    focus &&
      (focus !== "intended_use" || intendedUse) &&
      context.length <= HUMAN_REVIEW_CONTEXT_MAX_LENGTH &&
      scopeAcknowledged,
  );''',
    1,
)
p = p.replace(
    '''          propertyReferenceHint,
          sourceSurface,
        },''',
    '''          propertyReferenceHint,
          sourceSurface,
          scopeAcknowledged,
        },''',
    1,
)
p = p.replace(
    "Hand the property investigation to Easy Erf — without turning it into an open-ended advice service.",
    "Hand the property investigation to Easy Erf for a focused Human Review.",
    1,
)
p = p.replace(
    "The focus controls what the Human Review is allowed to answer. Customer context cannot expand the scope into professional advice.",
    "Choose the property question Easy Erf should investigate. Your optional context helps the reviewer understand your situation, but it cannot expand the review into professional advice.",
    1,
)
ack_anchor = '''          <p className="mt-4 text-xs leading-5 text-[#92400E]">
            Build-cost rule: Easy Erf may use a builder/QS/customer-supplied cost in deterministic scenario calculations, but Human Review does not invent a construction quotation or per-m² build-cost estimate.
          </p>
        </section>'''
ack_replacement = '''          <p className="mt-4 text-xs leading-5 text-[#92400E]">
            Build-cost rule: Easy Erf may use a builder/QS/customer-supplied cost in deterministic scenario calculations, but Human Review does not invent a construction quotation or per-m² build-cost estimate.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#F59E0B]/25 bg-white/90 p-4">
            <input
              type="checkbox"
              checked={scopeAcknowledged}
              onChange={(event) => setScopeAcknowledged(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF6A00]"
            />
            <span className="text-sm leading-6 text-[#0D1B2A]">
              <strong>Required:</strong> {HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}
            </span>
          </label>
        </section>'''
if p.count(ack_anchor) != 1:
    raise SystemExit("pricing acknowledgement anchor mismatch")
p = p.replace(ack_anchor, ack_replacement, 1)
p = p.replace(
    '''              {focus === "intended_use" && !intendedUse ? <p className="mt-2 text-xs text-[#64748B]">Choose the intended use first.</p> : null}
              {checkoutError ?''',
    '''              {focus === "intended_use" && !intendedUse ? <p className="mt-2 text-xs text-[#64748B]">Choose the intended use first.</p> : null}
              {focus && (focus !== "intended_use" || intendedUse) && !scopeAcknowledged ? (
                <p className="mt-2 text-xs text-[#64748B]">Acknowledge the Human Review scope before checkout.</p>
              ) : null}
              {checkoutError ?''',
    1,
)
pricing.write_text(p)

# Server-side pre-checkout brief persists acknowledgement evidence.
replace_once(
    "supabase/functions/easy-erf-r999-checkout/index.ts",
    '''      source_surface: brief.sourceSurface,
      status: "checkout_started",''',
    '''      source_surface: brief.sourceSurface,
      scope_acknowledged_at: new Date().toISOString(),
      status: "checkout_started",''',
)

# Database contract: exact three focuses, max 500, acknowledgement recorded on
# both brief and paid order.
migration = Path("supabase/migrations/20260831160318_controlled_human_review_product_v2.sql")
m = migration.read_text()
m = m.replace("  source_surface text null,\n  status text not null", "  source_surface text null,\n  scope_acknowledged_at timestamptz not null,\n  status text not null", 1)
m = m.replace("focus in ('property_check', 'before_i_buy', 'property_potential', 'intended_use')", "focus in ('property_check', 'property_potential', 'intended_use')")
m = m.replace("context is null or char_length(context) <= 600", "context is null or char_length(context) <= 500")
m = m.replace("  add column review_context text null,\n  add column review_content", "  add column review_context text null,\n  add column review_scope_acknowledged_at timestamptz null,\n  add column review_content", 1)
m = m.replace("      'property_check',\n      'before_i_buy',\n      'property_potential',", "      'property_check',\n      'property_potential',", 1)
m = m.replace("review_context is null or char_length(review_context) <= 600", "review_context is null or char_length(review_context) <= 500")
m = m.replace(
    '''      review_context = v_request.context,
      parcel_id = coalesce(public.report_orders.parcel_id, v_request.parcel_id),''',
    '''      review_context = v_request.context,
      review_scope_acknowledged_at = v_request.scope_acknowledged_at,
      parcel_id = coalesce(public.report_orders.parcel_id, v_request.parcel_id),''',
    1,
)
migration.write_text(m)

# Generated Supabase types mirror the unmerged migration contract.
types = Path("src/integrations/supabase/types.ts")
t = types.read_text()
t = t.replace("          source_surface: string | null\n          status: string", "          source_surface: string | null\n          scope_acknowledged_at: string\n          status: string", 1)
t = t.replace("          source_surface?: string | null\n          status?: string", "          source_surface?: string | null\n          scope_acknowledged_at: string\n          status?: string", 1)
t = t.replace("          source_surface?: string | null\n          status?: string", "          source_surface?: string | null\n          scope_acknowledged_at?: string\n          status?: string", 1)
t = t.replace("          review_request_id: string | null\n          reviewed_by", "          review_request_id: string | null\n          review_scope_acknowledged_at: string | null\n          reviewed_by", 1)
t = t.replace("          review_request_id?: string | null\n          reviewed_by", "          review_request_id?: string | null\n          review_scope_acknowledged_at?: string | null\n          reviewed_by", 1)
t = t.replace("          review_request_id?: string | null\n          reviewed_by", "          review_request_id?: string | null\n          review_scope_acknowledged_at?: string | null\n          reviewed_by", 1)
types.write_text(t)

# Isolated SQL proof verifies acknowledgement propagation and the 500-char cap.
verify = Path("scripts/verify-easy-erf-human-review-product.sql")
v = verify.read_text()
v = v.replace(
    '''    source_surface,
    status
  ) values (''',
    '''    source_surface,
    scope_acknowledged_at,
    status
  ) values (''',
    1,
)
v = v.replace(
    '''    'workbench-zoning-build',
    'checkout_started' ''',
    '''    'workbench-zoning-build',
    now(),
    'checkout_started' ''',
    1,
)
v = v.replace(
    '''     or v_order.review_context is null
     or v_order.parcel_id <>''',
    '''     or v_order.review_context is null
     or v_order.review_scope_acknowledged_at is null
     or v_order.parcel_id <>''',
    1,
)
v = v.replace("values ('property_check', repeat('x', 601), 'checkout_started');", "values ('property_check', repeat('x', 501), 'checkout_started');", 1)
verify.write_text(v)

# ---------------------------------------------------------------------------
# One five-question presentation system for self-service and Human Review.
# Self-service content is selected only from already-composed report evidence.
# ---------------------------------------------------------------------------
Path("src/lib/reports/fiveQuestionReport.ts").write_text('''import type { EasyErfReportDocument } from "@/lib/reports/composeEasyErfReport";

export type FiveQuestionReportContent = {
  known: string[];
  potential: string[];
  risks: string[];
  unknowns: string[];
  nextSteps: string[];
};

function unique(items: Array<string | null | undefined>, max = 4) {
  return Array.from(new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))))
    .slice(0, max);
}

export function buildSelfServiceFiveQuestionContent(
  doc: EasyErfReportDocument,
): FiveQuestionReportContent {
  const known = unique([
    ...doc.decisionSnapshot.positives,
    ...doc.atAGlance.slice(0, 3).map((item) => `${item.label}: ${item.value} — ${item.provenance}`),
  ]);
  const riskIssues = doc.riskStrip.filter((item) =>
    ["possible_issue", "confirmed_issue"].includes(item.status),
  );
  const unresolved = doc.riskStrip.filter((item) =>
    ["check_needed", "unknown"].includes(item.status),
  );
  const action = doc.nextBestAction;

  return {
    known: known.length
      ? known
      : ["The current investigation has not yet produced a supported property fact for this summary. Review the evidence dossier below."],
    potential: doc.decisionSnapshot.bestOpportunity
      ? [doc.decisionSnapshot.bestOpportunity]
      : ["No evidence-supported property potential is recorded yet."],
    risks: unique([
      doc.decisionSnapshot.biggestConcern,
      ...riskIssues.map((item) => `${item.label}: ${item.explanation}`),
    ]).length
      ? unique([
          doc.decisionSnapshot.biggestConcern,
          ...riskIssues.map((item) => `${item.label}: ${item.explanation}`),
        ])
      : ["No material problem is confirmed by the current recorded evidence. Outstanding checks remain under unknowns."],
    unknowns: unresolved.length
      ? unique(unresolved.map((item) => `${item.label}: ${item.explanation}`))
      : ["No unresolved item appears in the current risk strip. Verify the source evidence before relying on this report."],
    nextSteps: action
      ? unique([`${action.title}${action.reason ? ` — ${action.reason}` : ""}`])
      : ["No next verification action is currently recorded. Continue the investigation before relying on the report."],
  };
}
''')

Path("src/components/reports/FiveQuestionReportGrid.tsx").parent.mkdir(parents=True, exist_ok=True)
Path("src/components/reports/FiveQuestionReportGrid.tsx").write_text('''import {
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
''')

# Self-service report gets the five-question executive lens near the top.
opening = Path("src/components/property/dossier/ReportOpening.tsx")
o = opening.read_text()
o = o.replace(
    'import { AtlasPin } from "@/components/brand/AtlasPin";\n',
    'import { AtlasPin } from "@/components/brand/AtlasPin";\nimport { FiveQuestionReportGrid } from "@/components/reports/FiveQuestionReportGrid";\nimport { buildSelfServiceFiveQuestionContent } from "@/lib/reports/fiveQuestionReport";\n',
    1,
)
o = o.replace(
    '''  const snapshot = doc.decisionSnapshot;
  const action = doc.nextBestAction;
''',
    '''  const snapshot = doc.decisionSnapshot;
  const action = doc.nextBestAction;
  const fiveQuestionContent = buildSelfServiceFiveQuestionContent(doc);
''',
    1,
)
insert_anchor = '''      {/* D. PROPERTY AT A GLANCE */}
      {doc.atAGlance.length > 0 && ('''
insert = '''      {/* C2. THE SAME FIVE-QUESTION REPORT LENS USED BY HUMAN REVIEW */}
      <section
        id="report-five-questions"
        className="report-section rounded-[1.75rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4 scroll-mt-24 sm:p-5"
      >
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Easy Erf report summary
          </div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
            Five questions this investigation can answer from the evidence recorded so far
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            This self-service summary is selected from the existing report evidence. It does not add a human reviewer conclusion or invent missing facts.
          </p>
        </div>
        <FiveQuestionReportGrid content={fiveQuestionContent} />
      </section>

      {/* D. PROPERTY AT A GLANCE */}
      {doc.atAGlance.length > 0 && ('''
if o.count(insert_anchor) != 1:
    raise SystemExit("ReportOpening five-question insertion anchor mismatch")
o = o.replace(insert_anchor, insert, 1)
opening.write_text(o)

# Human-reviewed report uses the same five-question grid component.
hr = Path("src/components/humanReview/HumanReviewedReport.tsx")
h = hr.read_text()
h = h.replace(
    'import { AlertTriangle, CheckCircle2, HelpCircle, Lightbulb, ListChecks, ShieldCheck } from "lucide-react";',
    'import { ShieldCheck } from "lucide-react";',
    1,
)
h = h.replace(
    'import type { HumanReviewReportContent } from "@/lib/humanReview/reportContent";\n',
    'import type { HumanReviewReportContent } from "@/lib/humanReview/reportContent";\nimport { FiveQuestionReportGrid } from "@/components/reports/FiveQuestionReportGrid";\n',
    1,
)
start = h.index('  const sections = [')
end_marker = '  ] as const;\n\n'
end = h.index(end_marker, start) + len(end_marker)
h = h[:start] + h[end:]
old_grid_start = '''        <div className="grid gap-5 xl:grid-cols-2">
          {sections.map((section) => {'''
if old_grid_start not in h:
    raise SystemExit("HumanReviewedReport grid start not found")
grid_start = h.index(old_grid_start)
grid_end_marker = '''        </div>

        <footer className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5 text-xs leading-5 text-[#64748B]">'''
grid_end = h.index(grid_end_marker, grid_start)
new_grid = '''        <FiveQuestionReportGrid
          content={{
            known: content.known,
            potential: content.potential,
            risks: content.risks,
            unknowns: content.unknowns,
            nextSteps: content.nextSteps,
          }}
        />

'''
h = h[:grid_start] + new_grid + h[grid_end:]
hr.write_text(h)

# ---------------------------------------------------------------------------
# Tests: new scope, explicit acknowledgement, shared report system, and stale
# assertions from the previous fulfillment UI.
# ---------------------------------------------------------------------------
guard = Path("src/lib/payments/__tests__/easyErfHumanReviewScopeGuardrails.test.ts")
g = guard.read_text()
g = g.replace(
    '  HUMAN_REVIEW_SCOPE_BOUNDARY,\n',
    '  HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT,\n  HUMAN_REVIEW_SCOPE_BOUNDARY,\n',
    1,
)
g = g.replace(
    'const founderQueue = source("src/routes/admin.fulfillment.tsx");\n',
    'const founderQueue = source("src/routes/admin.fulfillment.tsx");\nconst reportOpening = source("src/components/property/dossier/ReportOpening.tsx");\nconst humanReviewedReport = source("src/components/humanReview/HumanReviewedReport.tsx");\n',
    1,
)
g = g.replace('it("locks the product to four supported focuses and six supported intended uses", () => {', 'it("locks the product to three supported focuses and six supported intended uses", () => {', 1)
g = g.replace(
    '''    expect(HUMAN_REVIEW_FOCUS_VALUES).toEqual([
      "property_check",
      "before_i_buy",
      "property_potential",
      "intended_use",
    ]);''',
    '''    expect(HUMAN_REVIEW_FOCUS_VALUES).toEqual([
      "property_check",
      "property_potential",
      "intended_use",
    ]);''',
    1,
)
g = g.replace(
    '''        focus: "property_check",
        context: "Considering buying the erf.",''',
    '''        focus: "property_check",
        context: "Considering buying the erf.",
        scopeAcknowledged: true,''',
    1,
)
g = g.replace('        focus: "legal_advice",\n        context: "Tell me my legal rights.",', '        focus: "legal_advice",\n        context: "Tell me my legal rights.",\n        scopeAcknowledged: true,', 1)
g = g.replace('        focus: "intended_use",\n        intendedUse: null,', '        focus: "intended_use",\n        intendedUse: null,\n        scopeAcknowledged: true,', 1)
g = g.replace('        focus: "property_check",\n        intendedUse: "second_dwelling",', '        focus: "property_check",\n        intendedUse: "second_dwelling",\n        scopeAcknowledged: true,', 1)
g = g.replace('        focus: "property_check",\n        context: "x".repeat(601),', '        focus: "property_check",\n        context: "x".repeat(501),\n        scopeAcknowledged: true,', 1)
ack_test_anchor = '''    ).toMatchObject({ ok: false });
  });

  it("requires a structured five-part founder report instead of arbitrary prose", () => {'''
ack_test_replacement = '''    ).toMatchObject({ ok: false });

    expect(
      validateHumanReviewCheckoutRequest({
        focus: "property_check",
        context: "Brief context only.",
        scopeAcknowledged: false,
      }),
    ).toMatchObject({ ok: false });
  });

  it("requires a structured five-part founder report instead of arbitrary prose", () => {'''
if g.count(ack_test_anchor) != 1:
    raise SystemExit("guardrail acknowledgement test anchor mismatch")
g = g.replace(ack_test_anchor, ack_test_replacement, 1)
g = g.replace(
    '''    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_BOUNDARY}");
    expect(pricing).toContain("HUMAN_REVIEW_NOT_INCLUDED.map");''',
    '''    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_BOUNDARY}");
    expect(pricing).toContain("{HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}");
    expect(pricing).toContain("scopeAcknowledged");
    expect(pricing).toContain("HUMAN_REVIEW_NOT_INCLUDED.map");''',
    1,
)
g = g.replace(
    '''    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain("buy / do-not-buy recommendation");''',
    '''    expect(HUMAN_REVIEW_SCOPE_BOUNDARY).toContain("buy / do-not-buy recommendation");
    expect(HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT).toContain("not legal, engineering");''',
    1,
)
g = g.replace(
    '''    expect(checkout).toContain("validateHumanReviewCheckoutRequest(body)");
    expect(checkout).toContain('.from("human_review_requests")');''',
    '''    expect(checkout).toContain("validateHumanReviewCheckoutRequest(body)");
    expect(checkout).toContain('.from("human_review_requests")');
    expect(checkout).toContain("scope_acknowledged_at: new Date().toISOString()");''',
    1,
)
g = g.replace(
    '''    expect(migration).toContain(
      "grant select, insert, update, delete on table public.human_review_requests to service_role",
    );''',
    '''    expect(migration).toContain(
      "grant select, insert, update, delete on table public.human_review_requests to service_role",
    );
    expect(migration).toContain("scope_acknowledged_at timestamptz not null");
    expect(migration).toContain("review_scope_acknowledged_at timestamptz null");
    expect(migration).not.toContain("before_i_buy");''',
    1,
)
g = g.replace(
    '''  it("makes the self-service report executive-first while retaining the full evidence dossier", () => {
    expect(dossier).toContain("Full evidence dossier");
    expect(dossier).toContain("The report opening above is the readable summary");
    expect(dossier).toContain("open={printOnly ? true : undefined}");
  });''',
    '''  it("makes the self-service report executive-first while retaining the full evidence dossier", () => {
    expect(dossier).toContain("Full evidence dossier");
    expect(dossier).toContain("The report opening above is the readable summary");
    expect(dossier).toContain("open={printOnly ? true : undefined}");
    expect(reportOpening).toContain("<FiveQuestionReportGrid");
    expect(reportOpening).toContain("buildSelfServiceFiveQuestionContent(doc)");
    expect(humanReviewedReport).toContain("<FiveQuestionReportGrid");
  });''',
    1,
)
guard.write_text(g)

# Stale legacy assertions updated to the web-first product.
ui_guard = Path("src/lib/payments/__tests__/easyErfFulfillmentUiGuardrails.test.ts")
u = ui_guard.read_text().replace('expect(customerRoute).toContain("Download report");', 'expect(customerRoute).toContain("Download PDF");', 1)
ui_guard.write_text(u)

stripe_guard = Path("src/lib/payments/__tests__/easyErfStripeFulfillmentGuardrails.test.ts")
s = stripe_guard.read_text().replace(
    "expect(pricing).toContain('supabase.functions.invoke(\"easy-erf-r999-checkout\")');",
    "expect(pricing).toContain('supabase.functions.invoke(\"easy-erf-r999-checkout\", {');",
    1,
)
stripe_guard.write_text(s)

# Human Review workflow watches the shared report lens too.
workflow = Path(".github/workflows/easy-erf-human-review-product.yml")
w = workflow.read_text()
w = w.replace(
    "      - src/components/property/OfficialParcelPanel.tsx\n",
    "      - src/components/property/OfficialParcelPanel.tsx\n      - src/components/property/dossier/ReportOpening.tsx\n      - src/components/reports/FiveQuestionReportGrid.tsx\n",
    1,
)
w = w.replace(
    "      - src/lib/payments/__tests__/easyErfHumanReviewScopeGuardrails.test.ts\n",
    "      - src/lib/payments/__tests__/easyErfHumanReviewScopeGuardrails.test.ts\n      - src/lib/reports/fiveQuestionReport.ts\n",
    1,
)
workflow.write_text(w)

# No retired fourth goal may survive in product/database/server/test files.
for check_path in [
    "src/lib/humanReview/scope.ts",
    "src/routes/pricing.tsx",
    "supabase/functions/_shared/easyErfHumanReviewContract.ts",
    "supabase/migrations/20260831160318_controlled_human_review_product_v2.sql",
]:
    require_absent(check_path, "before_i_buy")
