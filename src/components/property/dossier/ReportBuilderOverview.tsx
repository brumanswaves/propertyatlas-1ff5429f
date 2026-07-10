import { useMemo } from "react";
import { ArrowRight, CheckCircle2, MapPin, Minus, Plus } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import { cn } from "@/lib/utils";
import type { InvestorWorkflowView } from "./investorWorkflow";
import { buildReportActionCards, buildReportBuilderProgress } from "@/lib/workbench/reportProgress";
import { readErfWorkspaceState, type ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import nextStepBannerAsset from "@/assets/recommended-next-step-banner-bg.png.asset.json";
import aboutErfPinAsset from "@/assets/about-erf-map-pin-illustration.png.asset.json";
import orangeGlowAsset from "@/assets/orange-glow-orb.png.asset.json";


interface Props {
  parcel: NormalizedOfficialParcel;
  onSelectView?: (view: InvestorWorkflowView) => void;
  workspaceState?: ErfWorkspaceState;
}

type StepId = "identity" | "sources" | "market" | "strategy" | "report";

interface StepMeta {
  id: StepId;
  index: number;
  label: string;
  view: InvestorWorkflowView;
  cta: string;
}

const STEP_ORDER: StepMeta[] = [
  { id: "identity", index: 1, label: "Identity", view: "research", cta: "Check official identity" },
  { id: "sources", index: 2, label: "Sources", view: "research", cta: "Add or review sources" },
  { id: "market", index: 3, label: "Market", view: "listings", cta: "Add market evidence" },
  { id: "strategy", index: 4, label: "Strategy", view: "calculators", cta: "Open calculator" },
  { id: "report", index: 5, label: "Report", view: "stoep-report", cta: "Open Stoep AI Report" },
];

function chipTone(complete: boolean, warn: boolean) {
  if (complete) return "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25";
  if (warn) return "bg-[#FF6A00]/15 text-[#B24A00] ring-1 ring-[#FF6A00]/30";
  return "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20";
}

export function ReportBuilderOverview({ parcel, onSelectView, workspaceState }: Props) {
  const { evidence } = useSavedMarketEvidence(parcel.id);
  const compsCount = evidence?.length ?? 0;
  const effectiveWorkspaceState = useMemo(
    () => workspaceState ?? readErfWorkspaceState(parcel.id),
    [parcel.id, workspaceState],
  );

  const identity = useMemo(() => {
    const erf = parcel.erfNumber != null ? String(parcel.erfNumber) : null;
    const lpi = parcel.lpi ?? null;
    const parcelKey = parcel.parcelKey ?? null;
    const sizeField = parcel.knownFields.find((f) => /size|area|extent|sqm|hectare/i.test(f.label));
    const size = sizeField?.value ?? null;
    const knownCount = [erf, lpi, parcelKey, size].filter(Boolean).length;
    return { erf, lpi, parcelKey, size, knownCount, verified: knownCount >= 3 };
  }, [parcel]);

  const rows = useMemo(
    () =>
      buildReportBuilderProgress({
        parcel,
        workspaceState: effectiveWorkspaceState,
        savedMarketEvidenceCount: compsCount,
      }),
    [parcel, effectiveWorkspaceState, compsCount],
  );
  const actionCards = useMemo(
    () =>
      buildReportActionCards({
        parcel,
        workspaceState: effectiveWorkspaceState,
        savedMarketEvidenceCount: compsCount,
      }),
    [parcel, effectiveWorkspaceState, compsCount],
  );
  const doneMap = Object.fromEntries(rows.map((row) => [row.id, row.status === "Done"])) as Record<
    StepId,
    boolean
  >;
  const nextStep = STEP_ORDER.find((s) => !doneMap[s.id]) ?? STEP_ORDER[STEP_ORDER.length - 1];
  const progressPct = Math.round(
    (Object.values(doneMap).filter(Boolean).length / STEP_ORDER.length) * 100,
  );

  const suburb = parcel.suburbOrArea ?? null;
  const municipality = parcel.municipality ?? null;
  const province = parcel.province ?? null;
  const erfLabel = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
  const confidenceSummary = `${erfLabel}${suburb ? ` in ${suburb}` : ""}${municipality ? `, ${municipality}` : ""}${province ? `, ${province}` : ""} has ${identity.knownCount >= 3 ? "enough public context for an early read" : "partial public context"}. Ownership, valuation, zoning, sales history and GIS precision still need verified evidence.`;

  return (
    <div className="space-y-6">
      {/* Top row: builder card + about panel */}
      <section className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="rounded-[1.75rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-7 shadow-[0_20px_60px_-30px_rgba(13,27,42,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[26px] font-semibold tracking-tight text-[#0D1B2A]">
                ErfStoep Report Builder
              </h2>
              <p className="mt-1 text-[14px] text-[#4A5A6A]">
                This erf file becomes one final report.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing value={progressPct} />
              <div className="text-right">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Report progress
                </div>
                <div className="text-2xl font-bold text-[#FF6A00]">{progressPct}%</div>
              </div>
            </div>
          </div>

          <ol className="mt-6 divide-y divide-[#EADFC9]/70 rounded-2xl border border-[#EADFC9] bg-white/60">
            {rows.map((row, i) => (
              <li key={row.id} className="flex items-center gap-4 px-5 py-3.5" title={row.detail}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0D1B2A]/90 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="flex-1 text-[15px] font-semibold text-[#0D1B2A]">{row.label}</span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11.5px] font-semibold",
                    chipTone(
                      row.status === "Done",
                      row.status === "Needs evidence" || row.status === "Blocked",
                    ),
                  )}
                >
                  {row.status}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#06152A] p-6 text-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#FF6A00]/20 blur-2xl" />
          <div className="flex items-start justify-between">
            <h3 className="text-[20px] font-semibold tracking-tight">About this erf</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
              <MapPin className="h-4 w-4 text-[#FF8A33]" />
            </span>
          </div>
          <p className="mt-4 text-[13.5px] leading-6 text-white/75">{confidenceSummary}</p>
          <button
            type="button"
            onClick={() => onSelectView?.("research")}
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FF8A33] hover:text-[#FFA95C]"
          >
            View erf details <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </aside>
      </section>

      {/* 4 mini product panels */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCard
          index={1}
          title={actionCards[0].title}
          chip="Identity"
          chipTone="bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25"
          description={actionCards[0].body}
          rows={[
            { label: identity.erf ? `Erf ${identity.erf}` : "Erf number", ok: !!identity.erf },
            { label: identity.lpi ? "LPI found" : "LPI missing", ok: !!identity.lpi },
            {
              label: identity.parcelKey ? "Parcel key found" : "Parcel key missing",
              ok: !!identity.parcelKey,
            },
            {
              label: identity.size ? "Size found" : "Size not published",
              ok: !!identity.size,
              neutral: !identity.size,
            },
          ]}
          actionLabel={actionCards[0].action}
          onAction={() => onSelectView?.(actionCards[0].tab)}
        />
        <MiniCard
          index={2}
          title={actionCards[1].title}
          chip="Market"
          chipTone="bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/25"
          description={actionCards[1].body}
          rows={[
            { label: `${compsCount} comps saved`, ok: compsCount > 0, count: compsCount },
            { label: "Add listing URL", add: true },
            { label: "Add market address", add: true },
            { label: "\u00A0", spacer: true },
          ]}
          actionLabel={actionCards[1].action}
          onAction={() => onSelectView?.(actionCards[1].tab)}
        />
        <MiniCard
          index={3}
          title={actionCards[2].title}
          chip="Strategy"
          chipTone="bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/25"
          description={actionCards[2].body}
          rows={[
            { label: "Land price", neutral: true },
            { label: "Build cost", neutral: true },
            { label: "Exit value", neutral: true },
            { label: "Profit margin", neutral: true },
          ]}
          actionLabel={actionCards[2].action}
          onAction={() => onSelectView?.(actionCards[2].tab)}
        />
        <MiniCard
          index={4}
          title={actionCards[3].title}
          chip="Report"
          chipTone="bg-[#FF6A00]/10 text-[#B24A00] ring-1 ring-[#FF6A00]/25"
          description={actionCards[3].body}
          rows={[
            { label: rows.find((row) => row.id === "sources")?.evidence ?? "No sources reviewed" },
            { label: "Evidence", count: compsCount },
            { label: "Risks", neutral: true },
            { label: "Next steps", neutral: true },
          ]}
          actionLabel={actionCards[3].action}
          onAction={() => onSelectView?.(actionCards[3].tab)}
        />
      </section>

      {/* Recommended next step banner */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#06152A] p-6 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FF6A00]/20 to-transparent" />
        <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#FF6A00]/15 ring-1 ring-[#FF6A00]/30 shadow-[0_0_30px_rgba(255,106,0,0.35)]">
            <CheckCircle2 className="h-6 w-6 text-[#FF8A33]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#FF8A33]">
              Recommended next step
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight">
              {nextStepTitle(nextStep.id)}
            </div>
            <p className="mt-1.5 text-[12.5px] text-white/60">{nextStepBlurb(nextStep.id)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectView?.(nextStep.view)}
              className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(255,106,0,0.7)] hover:bg-[#ff7a1a]"
            >
              {nextStep.cta} <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const idx = STEP_ORDER.findIndex((s) => s.id === nextStep.id);
                const skip = STEP_ORDER[idx + 1];
                if (skip) onSelectView?.(skip.view);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white/85 hover:bg-white/[0.08]"
            >
              Skip to next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function nextStepTitle(id: StepId) {
  switch (id) {
    case "identity":
      return "Verify the official parcel identity first.";
    case "sources":
      return "Add or review the source evidence.";
    case "market":
      return "Add market evidence and comps.";
    case "strategy":
      return "Run the numbers on your strategy.";
    case "report":
      return "Assemble the decision-ready report.";
  }
}
function nextStepBlurb(id: StepId) {
  switch (id) {
    case "identity":
      return "Start by confirming this Workbench is attached to the right public erf before using market or strategy tools.";
    case "sources":
      return "Open the source panel and mark the primary official sources you've reviewed.";
    case "market":
      return "Paste listing URLs, add addresses, and save comps to build market evidence.";
    case "strategy":
      return "Use the calculators to test acquisition, build, exit, and profit assumptions.";
    case "report":
      return "Combine sources, evidence, risks and next steps into a shareable Stoep Report.";
  }
}

function ProgressRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#E7DCC7" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#FF6A00"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 400ms ease" }}
      />
    </svg>
  );
}

interface MiniRow {
  label: string;
  ok?: boolean;
  add?: boolean;
  count?: number;
  neutral?: boolean;
  spacer?: boolean;
}

function MiniCard({
  index,
  title,
  chip,
  chipTone,
  description,
  rows,
  actionLabel,
  onAction,
}: {
  index: number;
  title: string;
  chip: string;
  chipTone: string;
  description: string;
  rows: MiniRow[];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-5 shadow-[0_16px_44px_-30px_rgba(13,27,42,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-24px_rgba(13,27,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0D1B2A] text-[11px] font-bold text-white">
            {index}
          </span>
          <h4 className="text-[15.5px] font-semibold text-[#0D1B2A]">{title}</h4>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold", chipTone)}>
          {chip}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-[#4A5A6A]">{description}</p>

      <ul className="mt-4 flex-1 space-y-1.5">
        {rows.map((row, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center justify-between rounded-xl border border-[#EADFC9]/70 bg-white/70 px-3 py-2 text-[12.5px] font-medium text-[#0D1B2A]",
              row.spacer && "invisible",
            )}
          >
            <span className="truncate">{row.label}</span>
            {row.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : row.add ? (
              <Plus className="h-4 w-4 text-[#0D1B2A]/50" />
            ) : row.count !== undefined ? (
              <span className="rounded-full bg-[#0D1B2A]/5 px-2 py-0.5 text-[11px] font-bold text-[#0D1B2A]/70">
                {row.count}
              </span>
            ) : row.neutral ? (
              <Minus className="h-4 w-4 text-[#0D1B2A]/30" />
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-between rounded-xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-[#0D1B2A] ring-1 ring-[#EADFC9] transition hover:bg-white hover:ring-[#FF6A00]/40"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4 text-[#FF6A00]" />
      </button>
    </div>
  );
}
