import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  parsePropertyQuery,
  searchByCoordinate,
  searchOfficialParcels,
  type PropertySearchResult,
} from "@/lib/search/propertySearch";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";
import {
  fetchAddressPlaceDetails,
  fetchAddressAutocompleteSuggestions,
  isAddressAutocompleteConfigured,
  type AddressAutocompleteSuggestion,
} from "@/lib/search/addressAutocomplete";

interface Props {
  officialParcels?: IndexedOfficialParcel[];
  onPickOfficial?: (result: PropertySearchResult) => void;
}

type SearchMode = "address" | "erf";

interface StructuredErfFields {
  province: string;
  municipality: string;
  erf: string;
  portion: string;
  code: string;
}

type AddressResolution =
  | { status: "checking"; address: string; lat: number; lng: number }
  | {
      status: "exact" | "likely";
      address: string;
      lat: number;
      lng: number;
      match: PropertySearchResult;
    }
  | { status: "address-only"; address: string; lat: number; lng: number };

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
  const [manualMode, setManualMode] = useState<SearchMode | null>(null);
  const [structured, setStructured] = useState<StructuredErfFields>({
    province: "",
    municipality: "",
    erf: "",
    portion: "0",
    code: "",
  });
  const [addressSuggestions, setAddressSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressResolution, setAddressResolution] = useState<AddressResolution | null>(null);
  const [submittedErfQuery, setSubmittedErfQuery] = useState("");
  const parsedQuery = useMemo(() => parsePropertyQuery(q), [q]);
  const detectedMode: SearchMode =
    parsedQuery.lpi ||
    parsedQuery.parcelKey ||
    parsedQuery.erfNumber ||
    /\b(erf|portion|ptn|lpi|parcel\s*key)\b/i.test(q)
      ? "erf"
      : "address";
  const activeMode = manualMode ?? detectedMode;
  const visibleAreaTerms = useMemo(
    () =>
      Array.from(
        new Set(
          officialParcels
            .flatMap((parcel) => [parcel.town, parcel.municipality, parcel.province])
            .filter((value): value is string => Boolean(value?.trim()))
            .flatMap((value) => value.toLowerCase().split(/\s+/))
            .filter((term) => term.length > 2),
        ),
      ),
    [officialParcels],
  );
  const visibleAreaLabel = useMemo(() => {
    const clean = (value: string | undefined) => {
      if (!value) return undefined;
      const normalized = value.trim();
      if (!normalized || normalized === "EASTERN") return undefined;
      if (normalized === normalized.toUpperCase()) {
        return normalized
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase())
          .replace(/\bCape\b/, "Cape");
      }
      return normalized;
    };
    const sample =
      officialParcels.find((parcel) => parcel.town && parcel.municipality && parcel.province) ??
      officialParcels.find((parcel) => parcel.town || parcel.municipality || parcel.province);
    const label = [clean(sample?.town), clean(sample?.municipality), clean(sample?.province)]
      .filter(Boolean)
      .join(", ");
    return label || (officialParcels.length > 0 ? "Current map area" : "");
  }, [officialParcels]);
  const structuredQuery = useMemo(() => {
    const code = structured.code.trim();
    if (code) return code;
    const erf = structured.erf.trim();
    if (!erf) return q;
    return [
      "Erf",
      erf,
      structured.portion.trim() ? `portion ${structured.portion.trim()}` : null,
      structured.municipality.trim(),
      structured.province.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }, [q, structured]);
  const officialQuery = activeMode === "erf" ? submittedErfQuery || (manualMode ? "" : q) : q;

  const officialResults = useMemo(() => {
    if (!officialQuery.trim()) return [];
    return searchOfficialParcels(officialQuery, officialParcels, { visibleAreaTerms }).slice(0, 8);
  }, [officialParcels, officialQuery, visibleAreaTerms]);
  const needsAreaContext =
    activeMode === "erf" &&
    Boolean(parsedQuery.erfNumber) &&
    !parsedQuery.areaText &&
    !visibleAreaLabel &&
    officialResults.length === 0;
  const ambiguousErfSearch =
    activeMode === "erf" &&
    Boolean(parsedQuery.erfNumber) &&
    !parsedQuery.areaText &&
    officialResults.length > 1;

  useEffect(() => {
    const query = q.trim();
    setAddressResolution(null);
    if (activeMode !== "address" || query.length < 3) {
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
  }, [activeMode, q]);

  function resetSearch() {
    setOpen(false);
    setQ("");
    setAddressSuggestions([]);
    setAddressError(null);
    setAddressResolution(null);
  }

  async function pickAddressSuggestion(suggestion: AddressAutocompleteSuggestion) {
    setAddressLoading(true);
    setAddressError(null);
    setAddressResolution({
      status: "checking",
      address: suggestion.label,
      lat: 0,
      lng: 0,
    });
    try {
      const details = await fetchAddressPlaceDetails(suggestion.placeId);
      const officialMatch = searchByCoordinate(details.lat, details.lng, officialParcels);
      if (officialMatch) {
        setAddressResolution({
          status:
            officialMatch.confidence === "address_inside_official_parcel" ? "exact" : "likely",
          address: details.formattedAddress,
          lat: details.lat,
          lng: details.lng,
          match: officialMatch,
        });
        return;
      }
      setAddressResolution({
        status: "address-only",
        address: details.formattedAddress,
        lat: details.lat,
        lng: details.lng,
      });
    } catch (error) {
      setAddressError(
        error instanceof Error ? error.message : "Address coordinates are temporarily unavailable.",
      );
    } finally {
      setAddressLoading(false);
    }
  }

  function updateStructured(next: Partial<StructuredErfFields>) {
    setStructured((value) => ({ ...value, ...next }));
    setSubmittedErfQuery("");
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
          <div className="flex gap-1 border-b border-[#0D1B2A]/8 bg-white px-3 py-2">
            {(["address", "erf"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setManualMode(mode)}
                className={
                  activeMode === mode
                    ? "flex-1 rounded-full bg-[#0D1B2A] px-3 py-2 text-xs font-bold text-white"
                    : "flex-1 rounded-full bg-[#fbf8f1] px-3 py-2 text-xs font-bold text-[#0D1B2A]/64 hover:bg-[#fff3df]"
                }
              >
                {mode === "address" ? "Address" : "Erf / LPI"}
              </button>
            ))}
          </div>

          <div className="border-b border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
              Official parcel search
            </div>
            {visibleAreaLabel && (
              <p className="mt-1 text-xs leading-5 text-[#174634]">
                Searching inside visible map area: {visibleAreaLabel}
              </p>
            )}
            {officialResults.length === 0 && (
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
                No official parcel match found yet. Zoom in and click a CSG or Kouga parcel outline,
                or search by address, suburb, erf number, LPI, or parcel key.
              </p>
            )}
            {needsAreaContext && (
              <p className="mt-1 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                Erf number searches need province, municipality, township/area, portion, or a
                zoomed-in loaded map area to avoid ambiguous matches.
              </p>
            )}
            {ambiguousErfSearch && (
              <p className="mt-1 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                Multiple loaded parcels match this erf number. Add township/area or portion to
                narrow the official match.
              </p>
            )}
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              For official parcel data, zoom in and click a CSG or Kouga parcel outline on the map.
            </p>
          </div>

          {activeMode === "erf" && (
            <div className="grid gap-2 border-b border-[#0D1B2A]/8 bg-[#fbf8f1] px-4 py-3 sm:grid-cols-2">
              <input
                value={structured.province}
                onChange={(e) => updateStructured({ province: e.target.value })}
                placeholder={visibleAreaLabel ? "Province from visible area" : "Province"}
                className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
              />
              <input
                value={structured.municipality}
                onChange={(e) => updateStructured({ municipality: e.target.value })}
                placeholder="Municipality / town / township"
                className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
              />
              <input
                value={structured.erf}
                onChange={(e) => updateStructured({ erf: e.target.value })}
                placeholder="Erf number"
                className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
              />
              <input
                value={structured.portion}
                onChange={(e) => updateStructured({ portion: e.target.value })}
                placeholder="Portion, default 0"
                className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
              />
              <input
                value={structured.code}
                onChange={(e) => updateStructured({ code: e.target.value })}
                placeholder="LPI or parcel key optional"
                className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50 sm:col-span-2"
              />
              <button
                type="button"
                onClick={() => setSubmittedErfQuery(structuredQuery)}
                className="rounded-xl bg-[#0D1B2A] px-3 py-2 text-xs font-bold text-white hover:bg-[#142941] sm:col-span-2"
              >
                Search official parcel identity
              </button>
            </div>
          )}

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

          {activeMode === "address" && (
            <div className="border-t border-[#0D1B2A]/8 bg-white px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
              Address suggestions
            </div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Address suggestions give a coordinate only. Selecting one checks that point against
              loaded official parcel boundaries.
            </p>
            {!isAddressAutocompleteConfigured() && (
              <p className="mt-2 rounded-xl bg-[#fff8ec] px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                Address autocomplete is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY with
                Places enabled.
              </p>
            )}
          </div>
          )}

          {activeMode === "address" && addressLoading && (
            <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm text-[#0D1B2A]/68">
              Finding address suggestions...
            </div>
          )}

          {activeMode === "address" && addressError && (
            <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm text-[#8A3A12]">
              {addressError}
            </div>
          )}

          {activeMode === "address" && addressResolution && (
            <div className="border-t border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3 text-sm leading-6 text-[#0D1B2A]/72">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A4A09]">
                {addressResolution.status === "checking"
                  ? "Checking official parcel match..."
                  : addressResolution.status === "exact"
                    ? "Address matched to official parcel"
                    : addressResolution.status === "likely"
                      ? "Likely nearby parcel match"
                      : "Address found only"}
              </div>
              <div className="mt-2 font-semibold text-[#0D1B2A]">{addressResolution.address}</div>
              {addressResolution.status !== "checking" && (
                <div className="mt-1 font-mono text-[11px] text-[#0D1B2A]/62">
                  {addressResolution.lat.toFixed(6)}, {addressResolution.lng.toFixed(6)}
                </div>
              )}
              {(addressResolution.status === "exact" || addressResolution.status === "likely") && (
                <div className="mt-3 rounded-xl bg-white/80 p-3">
                  <div className="font-semibold text-[#0D1B2A]">
                    {addressResolution.match.title}
                  </div>
                  <div className="text-xs text-[#0D1B2A]/62">
                    {addressResolution.match.subtitle}
                  </div>
                  {addressResolution.match.distanceMeters !== undefined && (
                    <div className="mt-1 text-xs text-[#0D1B2A]/62">
                      About {Math.round(addressResolution.match.distanceMeters)}m from the address
                      point.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onPickOfficial?.(addressResolution.match);
                      resetSearch();
                    }}
                    className="mt-3 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#142941]"
                  >
                    {addressResolution.status === "exact"
                      ? "Open official erf Workbench"
                      : "Review likely erf match"}
                  </button>
                </div>
              )}
              {addressResolution.status === "address-only" && (
                <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                  Address found, but no official parcel boundary match was found for this point.
                </p>
              )}
            </div>
          )}

          {activeMode === "address" &&
            !addressLoading &&
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
                    Google address suggestion
                  </span>
                </div>
                <div className="text-[11px] leading-4 text-[#0D1B2A]/58">
                  Selecting this checks the point against loaded official parcels.
                </div>
              </button>
            ))}

          {activeMode === "address" &&
            !addressLoading &&
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
