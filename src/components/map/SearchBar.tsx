import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PROPERTIES, type Property } from "@/data/properties";

interface Props {
  onPick: (p: Property) => void;
}

export function SearchBar({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const t = q.toLowerCase();
    return PROPERTIES.filter(
      (p) =>
        p.street.toLowerCase().includes(t) ||
        p.area.toLowerCase().includes(t) ||
        p.erf.includes(t),
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group flex items-center gap-2.5 rounded-2xl bg-white/92 px-4 py-3 ring-1 ring-[#0D1B2A]/8 shadow-[0_16px_40px_-16px_rgba(13,27,42,0.30),0_2px_6px_-2px_rgba(13,27,42,0.08)] backdrop-blur-md transition focus-within:ring-2 focus-within:ring-[#FF6A00]/50 focus-within:bg-white">
        <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search any South African erf — address, erf number, or suburb"
          className="w-full bg-transparent text-[14px] font-medium text-[#0D1B2A] outline-none placeholder:font-normal placeholder:text-[#64748B]"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-[#64748B] hover:text-[#0D1B2A]">
            <X className="h-4 w-4" />
          </button>
        )}
        <kbd className="hidden rounded-md border border-[#0D1B2A]/10 bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-medium text-[#64748B] sm:inline">
          ⌘K
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onPick(r);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted"
            >
              <div>
                <div className="font-medium">{r.street}</div>
                <div className="text-xs text-muted-foreground">
                  {r.area} · Erf {r.erf} · {r.type}
                </div>
              </div>
              <span className="text-xs font-medium text-primary">View</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
