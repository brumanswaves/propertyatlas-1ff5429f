import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PROPERTIES, type Property } from "@/data/properties";

interface Props {
  onPick: (p: Property) => void;
}

export function SearchBar({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const demoResults = useMemo(() => {
    if (!q.trim()) return [];
    const t = q.toLowerCase();
    return PROPERTIES.filter(
      (p) =>
        p.street.toLowerCase().includes(t) ||
        p.area.toLowerCase().includes(t) ||
        p.erf.includes(t),
    ).slice(0, 6);
  }, [q]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group flex items-center gap-2.5 rounded-2xl bg-white/96 px-4 py-3 ring-1 ring-[#0D1B2A]/8 shadow-[0_18px_50px_-20px_rgba(13,27,42,0.38),0_2px_6px_-2px_rgba(13,27,42,0.08)] backdrop-blur-md transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FF6A00]/50">
        <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search address, erf number, suburb, LPI, or parcel key"
          className="w-full bg-transparent text-[14px] font-medium text-[#0D1B2A] outline-none placeholder:font-normal placeholder:text-[#64748B]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-[#64748B] hover:text-[#0D1B2A]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-[#0D1B2A]/10 bg-white shadow-[0_24px_70px_-30px_rgba(13,27,42,0.36)]">
          <div className="border-b border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
              Pilot demo examples
            </div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              These are demo records, not official parcel/address matches. For official data, zoom in
              and click a CSG or Kouga parcel outline on the map.
            </p>
          </div>

          {demoResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-[#0D1B2A]/70">
              No demo example matched. Try zooming the map and clicking an official parcel outline.
            </div>
          )}

          {demoResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onPick(r);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#f8f3ea]"
            >
              <div>
                <div className="font-medium text-[#0D1B2A]">{r.street}</div>
                <div className="text-xs text-[#0D1B2A]/58">
                  {r.area} - Erf {r.erf} - {r.type}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#0D1B2A]/8 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0D1B2A]/70">
                Demo
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
