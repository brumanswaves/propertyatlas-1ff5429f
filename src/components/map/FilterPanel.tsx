import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { PropertyType } from "@/data/properties";
import { cn } from "@/lib/utils";

export interface Filters {
  types: PropertyType[];
  beachfrontOnly: boolean;
  oceanViewOnly: boolean;
  largeErfOnly: boolean;
  cornerLotOnly: boolean;
  minInvestorScore: number;
  minDevelopmentScore: number;
  ownership: ("Individual" | "Trust" | "Company")[];
  recentSalesOnly: boolean;
  longHeldOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  types: [],
  beachfrontOnly: false,
  oceanViewOnly: false,
  largeErfOnly: false,
  cornerLotOnly: false,
  minInvestorScore: 0,
  minDevelopmentScore: 0,
  ownership: [],
  recentSalesOnly: false,
  longHeldOnly: false,
};

const TYPES: PropertyType[] = ["Residential", "Vacant Land", "Commercial", "Industrial", "Agricultural"];
const OWNERS = ["Individual", "Trust", "Company"] as const;

interface Props {
  value: Filters;
  onChange: (f: Filters) => void;
}

export function FilterPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount =
    value.types.length +
    value.ownership.length +
    (value.beachfrontOnly ? 1 : 0) +
    (value.oceanViewOnly ? 1 : 0) +
    (value.largeErfOnly ? 1 : 0) +
    (value.cornerLotOnly ? 1 : 0) +
    (value.recentSalesOnly ? 1 : 0) +
    (value.longHeldOnly ? 1 : 0) +
    (value.minInvestorScore > 0 ? 1 : 0) +
    (value.minDevelopmentScore > 0 ? 1 : 0);

  function toggleType(t: PropertyType) {
    onChange({
      ...value,
      types: value.types.includes(t) ? value.types.filter((x) => x !== t) : [...value.types, t],
    });
  }
  function toggleOwner(o: (typeof OWNERS)[number]) {
    onChange({
      ...value,
      ownership: value.ownership.includes(o) ? value.ownership.filter((x) => x !== o) : [...value.ownership, o],
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-card/95 px-3.5 py-2.5 text-xs font-medium shadow-soft backdrop-blur hover:bg-card"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-panel">
          <Section title="Property type">
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <Chip key={t} active={value.types.includes(t)} onClick={() => toggleType(t)}>{t}</Chip>
              ))}
            </div>
          </Section>
          <Section title="Location">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={value.beachfrontOnly} onClick={() => onChange({ ...value, beachfrontOnly: !value.beachfrontOnly })}>Beachfront</Chip>
              <Chip active={value.oceanViewOnly} onClick={() => onChange({ ...value, oceanViewOnly: !value.oceanViewOnly })}>Ocean view</Chip>
              <Chip active={value.largeErfOnly} onClick={() => onChange({ ...value, largeErfOnly: !value.largeErfOnly })}>Large erf</Chip>
              <Chip active={value.cornerLotOnly} onClick={() => onChange({ ...value, cornerLotOnly: !value.cornerLotOnly })}>Corner lot</Chip>
            </div>
          </Section>
          <Section title="Investment signals">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={value.recentSalesOnly} onClick={() => onChange({ ...value, recentSalesOnly: !value.recentSalesOnly })}>Sold &lt; 12 mo</Chip>
              <Chip active={value.longHeldOnly} onClick={() => onChange({ ...value, longHeldOnly: !value.longHeldOnly })}>Held &gt; 10 yrs</Chip>
            </div>
          </Section>
          <Section title="Ownership">
            <div className="flex flex-wrap gap-1.5">
              {OWNERS.map((o) => (
                <Chip key={o} active={value.ownership.includes(o)} onClick={() => toggleOwner(o)}>{o}</Chip>
              ))}
            </div>
          </Section>
          <Section title={`Min investor score: ${value.minInvestorScore}`}>
            <input type="range" min={0} max={90} step={5} value={value.minInvestorScore}
              onChange={(e) => onChange({ ...value, minInvestorScore: Number(e.target.value) })}
              className="w-full accent-[var(--color-primary)]" />
          </Section>
          <Section title={`Min development score: ${value.minDevelopmentScore}`}>
            <input type="range" min={0} max={90} step={5} value={value.minDevelopmentScore}
              onChange={(e) => onChange({ ...value, minDevelopmentScore: Number(e.target.value) })}
              className="w-full accent-[var(--color-primary)]" />
          </Section>
          <button onClick={() => onChange(DEFAULT_FILTERS)}
            className="mt-1 w-full rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
      )}>
      {children}
    </button>
  );
}
