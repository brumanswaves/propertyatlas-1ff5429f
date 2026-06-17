import { useState } from "react";
import { Calculator } from "lucide-react";
import { yieldCalc, flipCalc, holdingCostCalc, devCalc, formatZAR, formatPct } from "@/lib/research/calculators";
import { SourceBadge } from "@/components/data/SourceBadge";

type Tab = "yield" | "flip" | "dev" | "holding";

const DISCLAIMER = "Estimates only. Not financial, legal, tax, or valuation advice.";

export function CalculatorsTab({ defaultPrice }: { defaultPrice?: number }) {
  const [tab, setTab] = useState<Tab>("yield");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Investment calculators</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Quick estimates to compare opportunities before you buy, sell, or invest.</p>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-[11px] font-medium">
        {(["yield", "flip", "dev", "holding"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={"rounded-full px-2.5 py-1 " + (tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {t === "yield" ? "Buy-to-let" : t === "flip" ? "Flip" : t === "dev" ? "Development" : "Holding cost"}
          </button>
        ))}
      </div>

      {tab === "yield" && <YieldForm defaultPrice={defaultPrice} />}
      {tab === "flip" && <FlipForm defaultPrice={defaultPrice} />}
      {tab === "dev" && <DevForm defaultPrice={defaultPrice} />}
      {tab === "holding" && <HoldingForm />}

      <p className="rounded-xl bg-muted/60 px-3 py-2 text-[10.5px] text-muted-foreground">{DISCLAIMER}</p>
      <SourceBadge source="demo" />
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5">
        <input type="number" inputMode="decimal" className="w-full bg-transparent text-xs tabular-nums outline-none"
          value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function YieldForm({ defaultPrice }: { defaultPrice?: number }) {
  const [i, set] = useState({
    purchasePrice: defaultPrice ?? 3_500_000, transferCosts: 180_000, renovationBudget: 0,
    monthlyRent: 22_000, monthlyRates: 1_800, monthlyLevies: 0, monthlyInsurance: 600,
  });
  const o = yieldCalc(i);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Purchase price" value={i.purchasePrice} onChange={(v) => set({ ...i, purchasePrice: v })} suffix="R" />
      <Field label="Transfer costs" value={i.transferCosts} onChange={(v) => set({ ...i, transferCosts: v })} suffix="R" />
      <Field label="Renovation budget" value={i.renovationBudget} onChange={(v) => set({ ...i, renovationBudget: v })} suffix="R" />
      <Field label="Monthly rental" value={i.monthlyRent} onChange={(v) => set({ ...i, monthlyRent: v })} suffix="R" />
      <Field label="Monthly rates" value={i.monthlyRates} onChange={(v) => set({ ...i, monthlyRates: v })} suffix="R" />
      <Field label="Monthly levies" value={i.monthlyLevies} onChange={(v) => set({ ...i, monthlyLevies: v })} suffix="R" />
      <Field label="Monthly insurance" value={i.monthlyInsurance} onChange={(v) => set({ ...i, monthlyInsurance: v })} suffix="R" />
      <div className="sm:col-span-2 mt-2 grid gap-2 sm:grid-cols-2">
        <Result label="Gross yield" value={formatPct(o.grossYieldPct)} />
        <Result label="Net yield" value={formatPct(o.netYieldPct)} />
        <Result label="Gross yearly income" value={formatZAR(o.grossYearly)} />
        <Result label="Net yearly income" value={formatZAR(o.netYearly)} />
      </div>
    </div>
  );
}

function FlipForm({ defaultPrice }: { defaultPrice?: number }) {
  const [i, set] = useState({
    purchasePrice: defaultPrice ?? 3_500_000, transferCosts: 180_000, renovationBudget: 600_000,
    sellingPrice: (defaultPrice ?? 3_500_000) * 1.35, agentCommissionPct: 6, holdingMonths: 9, monthlyHoldingCost: 8_000,
  });
  const o = flipCalc(i);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Purchase price" value={i.purchasePrice} onChange={(v) => set({ ...i, purchasePrice: v })} suffix="R" />
      <Field label="Transfer costs" value={i.transferCosts} onChange={(v) => set({ ...i, transferCosts: v })} suffix="R" />
      <Field label="Renovation budget" value={i.renovationBudget} onChange={(v) => set({ ...i, renovationBudget: v })} suffix="R" />
      <Field label="Selling price" value={i.sellingPrice} onChange={(v) => set({ ...i, sellingPrice: v })} suffix="R" />
      <Field label="Agent commission" value={i.agentCommissionPct} onChange={(v) => set({ ...i, agentCommissionPct: v })} suffix="%" />
      <Field label="Holding period" value={i.holdingMonths} onChange={(v) => set({ ...i, holdingMonths: v })} suffix="mo" />
      <Field label="Monthly holding cost" value={i.monthlyHoldingCost} onChange={(v) => set({ ...i, monthlyHoldingCost: v })} suffix="R" />
      <div className="sm:col-span-2 mt-2 grid gap-2 sm:grid-cols-2">
        <Result label="Estimated profit" value={formatZAR(o.profit)} />
        <Result label="ROI" value={formatPct(o.roiPct)} />
        <Result label="Total cost" value={formatZAR(o.totalCost)} />
        <Result label="Agent commission" value={formatZAR(o.commission)} />
      </div>
    </div>
  );
}

function DevForm({ defaultPrice }: { defaultPrice?: number }) {
  const [i, set] = useState({
    landPrice: defaultPrice ?? 2_500_000, buildCostPerSqm: 18_000, buildableSqm: 400,
    softCostPct: 15, gdv: 18_000_000, agentCommissionPct: 5,
  });
  const o = devCalc(i);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Land price" value={i.landPrice} onChange={(v) => set({ ...i, landPrice: v })} suffix="R" />
      <Field label="Build cost / m²" value={i.buildCostPerSqm} onChange={(v) => set({ ...i, buildCostPerSqm: v })} suffix="R" />
      <Field label="Buildable area" value={i.buildableSqm} onChange={(v) => set({ ...i, buildableSqm: v })} suffix="m²" />
      <Field label="Soft costs" value={i.softCostPct} onChange={(v) => set({ ...i, softCostPct: v })} suffix="%" />
      <Field label="Gross development value" value={i.gdv} onChange={(v) => set({ ...i, gdv: v })} suffix="R" />
      <Field label="Agent commission" value={i.agentCommissionPct} onChange={(v) => set({ ...i, agentCommissionPct: v })} suffix="%" />
      <div className="sm:col-span-2 mt-2 grid gap-2 sm:grid-cols-2">
        <Result label="Total cost" value={formatZAR(o.totalCost)} />
        <Result label="Profit" value={formatZAR(o.profit)} />
        <Result label="Margin" value={formatPct(o.marginPct)} />
        <Result label="Hard build cost" value={formatZAR(o.hardCost)} />
      </div>
    </div>
  );
}

function HoldingForm() {
  const [i, set] = useState({ monthlyRates: 2_500, monthlyLevies: 0, monthlyInsurance: 700, otherMonthly: 1_500 });
  const o = holdingCostCalc(i);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Monthly rates" value={i.monthlyRates} onChange={(v) => set({ ...i, monthlyRates: v })} suffix="R" />
      <Field label="Monthly levies" value={i.monthlyLevies} onChange={(v) => set({ ...i, monthlyLevies: v })} suffix="R" />
      <Field label="Monthly insurance" value={i.monthlyInsurance} onChange={(v) => set({ ...i, monthlyInsurance: v })} suffix="R" />
      <Field label="Other monthly" value={i.otherMonthly} onChange={(v) => set({ ...i, otherMonthly: v })} suffix="R" />
      <div className="sm:col-span-2 mt-2 grid gap-2 sm:grid-cols-2">
        <Result label="Monthly holding cost" value={formatZAR(o.monthly)} />
        <Result label="Yearly holding cost" value={formatZAR(o.yearly)} />
      </div>
    </div>
  );
}
