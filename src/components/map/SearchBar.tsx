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
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full bg-card/95 px-4 py-2.5 shadow-panel backdrop-blur">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search address, erf number, or area…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
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
