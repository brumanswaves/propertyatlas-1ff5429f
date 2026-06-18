import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

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
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm md:hidden"
          />
          <div className="pa-fade-up fixed inset-x-2 bottom-2 z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel md:absolute md:inset-auto md:left-0 md:bottom-auto md:top-full md:mt-2 md:w-80 md:max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain p-4">
              <Section title="Property type">
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <Chip key={t} active={value.types.includes(t)} onClick={() => toggleType(t)}>{t}</Chip>
                  ))}
                </div>
              </Section>
              <p className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                More filters (Kouga record, municipal context, zoning, SG document, saved by me, notes, listings, report interest) will activate as their data sources come online.
              </p>
              <button onClick={() => onChange(DEFAULT_FILTERS)}
                className="mt-1 w-full rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                Reset
              </button>
            </div>
          </div>
        </>
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
