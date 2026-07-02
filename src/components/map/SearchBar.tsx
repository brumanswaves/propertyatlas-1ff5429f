import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  searchByCoordinate,
  searchOfficialParcels,
  type PropertySearchResult,
} from "@/lib/search/propertySearch";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";
import {
  fetchAddressAutocompleteSuggestions,
  type AddressAutocompleteSuggestion,
} from "@/lib/search/addressAutocomplete";

interface Props {
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

export function SearchBar({ officialParcels = [], onPickOfficial }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressOnlyMessage, setAddressOnlyMessage] = useState<string | null>(null);

  const officialResults = useMemo(() => {
    if (!q.trim()) return [];
    return searchOfficialParcels(q, officialParcels).slice(0, 8);
  }, [officialParcels, q]);

  useEffect(() => {
    const query = q.trim();
    setAddressOnlyMessage(null);
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressError(null);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);
    setAddressError(null);
    const timer = window.setTimeout(() => {
      fetchAddressAutocompleteSuggestions(query)
        .then((suggestions) => {
          if (!cancelled) setAddressSuggestions(suggestions);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setAddressSuggestions([]);
            setAddressError(
              error instanceof Error
                ? error.message
                : "Address suggestions are temporarily unavailable.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setAddressLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  function resetSearch() {
    setOpen(false);
    setQ("");
    setAddressSuggestions([]);
    setAddressError(null);
    setAddressOnlyMessage(null);
  }

  function pickAddressSuggestion(suggestion: AddressAutocompleteSuggestion) {
    const officialMatch = searchByCoordinate(suggestion.lat, suggestion.lng, officialParcels);
    if (officialMatch) {
      onPickOfficial?.(officialMatch);
      resetSearch();
      return;
    }
    setAddressOnlyMessage(
      "Address found, but ErfStoep does not yet have an official parcel boundary match for this point.",
    );
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group flex items-center gap-2.5 rounded-2xl bg-white/96 px-3 py-2.5 ring-1 ring-[#0D1B2A]/8 shadow-[0_18px_50px_-20px_rgba(13,27,42,0.38),0_2px_6px_-2px_rgba(13,27,42,0.08)] backdrop-blur-md transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FF6A00]/50 md:px-4 md:py-3">
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
            onClick={() => {
              setQ("");
              setAddressOnlyMessage(null);
            }}
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
                resetSearch();
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

          <div className="border-t border-[#0D1B2A]/8 bg-white px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
              Address suggestions
            </div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Address suggestions give a coordinate only. Selecting one checks that point against
              loaded official parcel boundaries.
            </p>
          </div>

          {addressLoading && (
            <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm text-[#0D1B2A]/68">
              Finding address suggestions...
            </div>
          )}

          {addressError && (
            <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm text-[#8A3A12]">
              {addressError}
            </div>
          )}

          {addressOnlyMessage && (
            <div className="border-t border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3 text-sm leading-6 text-[#0D1B2A]/72">
              {addressOnlyMessage}
            </div>
          )}

          {!addressLoading &&
            !addressError &&
            addressSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => pickAddressSuggestion(suggestion)}
                className="flex w-full flex-col gap-1 border-t border-[#0D1B2A]/8 px-4 py-3 text-left hover:bg-[#f8f3ea]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#0D1B2A]">{suggestion.label}</div>
                    <div className="text-xs text-[#0D1B2A]/58">{suggestion.subtitle}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#FF6A00]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9A4A09]">
                    Address suggestion
                  </span>
                </div>
                <div className="text-[11px] leading-4 text-[#0D1B2A]/58">
                  Selecting this checks the point against loaded official parcels.
                </div>
              </button>
            ))}

          {!addressLoading &&
            !addressError &&
            addressSuggestions.length === 0 &&
            officialResults.length === 0 && (
              <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm leading-6 text-[#0D1B2A]/68">
                No address suggestion found yet. Try a fuller address, suburb, LPI, or parcel key.
              </div>
            )}
        </div>
      )}
    </div>
  );
}
