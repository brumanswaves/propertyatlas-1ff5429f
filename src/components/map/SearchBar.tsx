import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PROPERTIES, type Property } from "@/data/properties";
import { searchOfficialParcels, type PropertySearchResult } from "@/lib/search/propertySearch";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";

interface Props {
  onPick: (p: Property) => void;
  officialParcels?: IndexedOfficialParcel[];
  onPickOfficial?: (result: PropertySearchResult) => void;
}

function confidenceLabel(confidence: PropertySearchResult["confidence"]): string {
  switch (confidence) {
    case "exact_official_match":
      return "Exact official match";
    case "address_inside_official_parcel":
      return "Address point inside official parcel";
    case "likely_nearby_parcel":
      return "Likely official parcel";
    case "address_only":
      return "Address/area text only";
    case "no_match":
      return "No official match";
  }
}

export function SearchBar({ onPick, officialParcels = [], onPickOfficial }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [showDemoExamples, setShowDemoExamples] = useState(false);

  const officialResults = useMemo(() => {
    if (!q.trim()) return [];
    return searchOfficialParcels(q, officialParcels).slice(0, 8);
  }, [officialParcels, q]);

  const demoResults = useMemo(() => {
    if (!q.trim() || !showDemoExamples || officialResults.length > 0) return [];
    const t = q.toLowerCase();
    return PROPERTIES.filter(
      (p) =>
        p.street.toLowerCase().includes(t) || p.area.toLowerCase().includes(t) || p.erf.includes(t),
    ).slice(0, 6);
  }, [officialResults.length, q, showDemoExamples]);
  const canShowDemoFallback = q.trim().length > 0 && officialResults.length === 0;

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group flex items-center gap-2.5 rounded-2xl bg-white/96 px-3 py-2.5 ring-1 ring-[#0D1B2A]/8 shadow-[0_18px_50px_-20px_rgba(13,27,42,0.38),0_2px_6px_-2px_rgba(13,27,42,0.08)] backdrop-blur-md transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FF6A00]/50 md:px-4 md:py-3">
        <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setShowDemoExamples(false);
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
        <div className="absolute left-0 right-0 top-full z-[90] mt-2 max-h-[min(72vh,32rem)] overflow-y-auto rounded-2xl border border-[#0D1B2A]/10 bg-white shadow-[0_24px_70px_-30px_rgba(13,27,42,0.36)]">
          <div className="border-b border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
              Official parcel search
            </div>
            {officialResults.length === 0 && (
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                No official parcel match found yet. Zoom in and click a CSG or Kouga parcel outline,
                or search by address, suburb, erf number, LPI, or parcel key.
              </p>
            )}
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              For official parcel data, zoom in and click a CSG or Kouga parcel outline on the map.
            </p>
          </div>

          {officialResults.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                onPickOfficial?.(result);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full flex-col gap-2 border-b border-[#0D1B2A]/8 px-4 py-3 text-left hover:bg-[#f8f3ea]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#0D1B2A]">{result.title}</div>
                  <div className="text-xs text-[#0D1B2A]/62">{result.subtitle}</div>
                </div>
                <span className="shrink-0 rounded-full bg-[#174634]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#174634]">
                  Official
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-[#0D1B2A]/64">
                <span>{confidenceLabel(result.confidence)}</span>
                <span aria-hidden="true">-</span>
                <span>{result.matchReason}</span>
                <span aria-hidden="true">-</span>
                <span>{result.sourceLabel}</span>
              </div>
              <div className="grid gap-1 text-[11px] text-[#0D1B2A]/58 sm:grid-cols-2">
                {result.fields.lpi && <span>LPI: {result.fields.lpi}</span>}
                {result.fields.parcelKey && <span>Parcel key: {result.fields.parcelKey}</span>}
                {result.fields.municipality && (
                  <span>Municipality: {result.fields.municipality}</span>
                )}
                {result.fields.province && <span>Province: {result.fields.province}</span>}
              </div>
            </button>
          ))}

          {canShowDemoFallback && (
            <div className="border-t border-dashed border-[#0D1B2A]/10 bg-[#fbf8f1]/55 px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                Optional pilot examples
              </div>
              <button
                type="button"
                onClick={() => setShowDemoExamples((value) => !value)}
                className="mt-2 inline-flex items-center rounded-full border border-[#0D1B2A]/10 bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B] hover:bg-[#f8f3ea]"
              >
                {showDemoExamples ? "Hide pilot demo examples" : "Show pilot demo examples"}
              </button>
              <p className="mt-1.5 text-[11px] leading-4 text-[#0D1B2A]/50">
                Hidden by default. Demo records are secondary training examples, not official
                parcel/address matches.
              </p>
            </div>
          )}

          {showDemoExamples && demoResults.length === 0 && (
            <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm text-[#0D1B2A]/70">
              No pilot demo example matched.
            </div>
          )}

          {showDemoExamples &&
            demoResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onPick(r);
                  setOpen(false);
                  setQ("");
                  setShowDemoExamples(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-t border-[#0D1B2A]/8 px-4 py-3 text-left text-sm hover:bg-[#f8f3ea]"
              >
                <div>
                  <div className="font-medium text-[#0D1B2A]">{r.street}</div>
                  <div className="text-xs text-[#0D1B2A]/58">
                    {r.area} - Erf {r.erf} - {r.type}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#0D1B2A]/8 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0D1B2A]/70">
                  Pilot demo example
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
