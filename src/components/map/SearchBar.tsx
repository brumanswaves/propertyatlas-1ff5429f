import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LocateFixed, MapPin, Search, X } from "lucide-react";
import {
  parsePropertyQuery,
  searchByCoordinate,
  searchOfficialParcels,
  type PropertySearchResult,
} from "@/lib/search/propertySearch";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";
import { deriveErfSearchContext } from "@/lib/search/erfSearchContext";
import {
  fetchAddressPlaceDetails,
  fetchAddressAutocompleteSuggestions,
  isAddressAutocompleteConfigured,
  type AddressAutocompleteSuggestion,
} from "@/lib/search/addressAutocomplete";

interface Props {
  officialParcels?: IndexedOfficialParcel[];
  onOpenOfficialWorkbench?: (result: PropertySearchResult) => void;
  onHighlightOfficialFromSearch?: (result: PropertySearchResult) => void;
  onLocateAddress?: (target: AddressMapTarget) => void;
}

export interface AddressMapTarget {
  address: string;
  lat: number;
  lng: number;
}

type SearchLane = "address" | "erf";

interface StructuredErfFields {
  deedsOffice: string;
  township: string;
  erf: string;
  portion: string;
  code: string;
}

type AddressResolution =
  | { status: "checking"; address: string }
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
      return "Likely nearby parcel";
    case "address_only":
      return "Address text only";
    case "no_match":
      return "No official match";
  }
}

function resultArea(result: PropertySearchResult): string {
  return [result.fields.town, result.fields.municipality, result.fields.province]
    .filter(Boolean)
    .join(", ");
}

export function SearchBar({
  officialParcels = [],
  onOpenOfficialWorkbench,
  onHighlightOfficialFromSearch,
  onLocateAddress,
}: Props) {
  const [open, setOpen] = useState(false);
  const [lane, setLane] = useState<SearchLane | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [erfQueryText, setErfQueryText] = useState("");
  const [structured, setStructured] = useState<StructuredErfFields>({
    deedsOffice: "",
    township: "",
    erf: "",
    portion: "0",
    code: "",
  });
  const [addressSuggestions, setAddressSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressResolution, setAddressResolution] = useState<AddressResolution | null>(null);
  const [submittedErfQuery, setSubmittedErfQuery] = useState("");
  const [erfSearched, setErfSearched] = useState(false);

  const context = useMemo(() => deriveErfSearchContext(officialParcels), [officialParcels]);

  useEffect(() => {
    if (!lane || structured.deedsOffice || structured.township) return;
    setStructured((value) => ({
      ...value,
      deedsOffice: context.suggestedDeedsOffice ?? value.deedsOffice,
      township: context.suggestedTownship ?? value.township,
    }));
  }, [
    context.suggestedDeedsOffice,
    context.suggestedTownship,
    lane,
    structured.deedsOffice,
    structured.township,
  ]);

  const addressInput = addressQuery.trim();
  useEffect(() => {
    setAddressResolution(null);
    if (lane !== "address" || addressInput.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressError(null);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);
    setAddressError(null);
    const timer = window.setTimeout(() => {
      fetchAddressAutocompleteSuggestions(addressInput)
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
  }, [addressInput, lane]);

  const erfSearchQuery = useMemo(() => {
    const code = structured.code.trim();
    if (code) return code;
    const erf = structured.erf.trim();
    if (!erf) return erfQueryText;
    return [
      "Erf",
      erf,
      structured.portion.trim() ? `portion ${structured.portion.trim()}` : null,
      structured.township.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }, [erfQueryText, structured]);

  const erfResults = useMemo(() => {
    if (!submittedErfQuery.trim()) return [];
    return searchOfficialParcels(submittedErfQuery, officialParcels, {
      loadedAreaTerms: context.loadedAreaTerms,
    }).slice(0, 8);
  }, [context.loadedAreaTerms, officialParcels, submittedErfQuery]);

  const parsedErfQuery = useMemo(() => parsePropertyQuery(erfSearchQuery), [erfSearchQuery]);
  const shouldWarnErfAmbiguous =
    lane === "erf" &&
    erfSearched &&
    Boolean(parsedErfQuery.erfNumber) &&
    !parsedErfQuery.areaText &&
    !context.currentAreaLabel &&
    !structured.township.trim() &&
    !structured.deedsOffice.trim();
  const selectedOfficeHasLoadedCoverage =
    !structured.deedsOffice ||
    !context.suggestedDeedsOffice ||
    structured.deedsOffice === context.suggestedDeedsOffice;
  const allTownshipOptions = useMemo(() => {
    if (!selectedOfficeHasLoadedCoverage) return [];
    return Array.from(new Set([...context.townshipOptions, ...context.municipalityOptions]));
  }, [context.municipalityOptions, context.townshipOptions, selectedOfficeHasLoadedCoverage]);

  function clearAll() {
    setOpen(false);
    setLane(null);
    setAddressQuery("");
    setErfQueryText("");
    setSubmittedErfQuery("");
    setErfSearched(false);
    setAddressSuggestions([]);
    setAddressError(null);
    setAddressResolution(null);
  }

  function chooseLane(nextLane: SearchLane) {
    setLane(nextLane);
    setOpen(true);
    setAddressResolution(null);
    setAddressError(null);
    setSubmittedErfQuery("");
    setErfSearched(false);
  }

  async function pickAddressSuggestion(suggestion: AddressAutocompleteSuggestion) {
    setAddressLoading(true);
    setAddressError(null);
    setAddressResolution({ status: "checking", address: suggestion.label });
    try {
      const details = await fetchAddressPlaceDetails(suggestion.placeId);
      onLocateAddress?.({
        address: details.formattedAddress,
        lat: details.lat,
        lng: details.lng,
      });
      const officialMatch = searchByCoordinate(details.lat, details.lng, officialParcels);
      if (officialMatch) {
        onHighlightOfficialFromSearch?.(officialMatch);
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

  function runErfSearch() {
    setErfSearched(true);
    setSubmittedErfQuery(erfSearchQuery);
  }

  function highlightResult(result: PropertySearchResult) {
    onHighlightOfficialFromSearch?.(result);
    setOpen(false);
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md transition focus-within:bg-white/[0.09] focus-within:ring-[#FF6A00]/45 md:px-4 md:py-3">
        <Search className="h-4 w-4 shrink-0 text-white/50" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-transparent text-left text-[14px] font-medium text-white/90 placeholder:text-white/45 outline-none"
        >
          {lane === "address" && addressQuery
            ? addressQuery
            : lane === "erf" && (structured.erf || structured.code || erfQueryText)
              ? structured.code || structured.erf || erfQueryText
              : "Search address, erf number, suburb, LPI, or parcel key"}
        </button>
        {(lane || addressQuery || erfQueryText || structured.erf || structured.code) && (
          <button
            type="button"
            onClick={clearAll}
            className="text-white/50 hover:text-white"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[90] mt-2 max-h-[min(74vh,34rem)] overflow-y-auto rounded-2xl border border-[#0D1B2A]/10 bg-white shadow-[0_24px_70px_-30px_rgba(13,27,42,0.36)]">
          {!lane && (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseLane("address")}
                className="rounded-2xl border border-[#FF6A00]/20 bg-[#fff8ec] p-4 text-left transition hover:border-[#FF6A00]/45 hover:bg-[#fff3df]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6A00]/12 text-[#9A4A09]">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="mt-3 text-sm font-bold text-[#0D1B2A]">Address Search</div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  Search by street address or place name.
                </p>
              </button>
              <button
                type="button"
                onClick={() => chooseLane("erf")}
                className="rounded-2xl border border-[#0D1B2A]/10 bg-[#fbf8f1] p-4 text-left transition hover:border-[#0D1B2A]/25 hover:bg-[#f8f3ea]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D1B2A]/8 text-[#0D1B2A]">
                  <LocateFixed className="h-4 w-4" />
                </span>
                <div className="mt-3 text-sm font-bold text-[#0D1B2A]">Erf Search</div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  Search by Deeds Office, township, erf number, portion, LPI, or parcel key.
                </p>
              </button>
            </div>
          )}

          {lane === "address" && (
            <div>
              <div className="border-b border-[#0D1B2A]/8 bg-[#fff8ec] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setLane(null)}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[#0D1B2A]/64 hover:text-[#0D1B2A]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Search type
                </button>
                <div className="text-sm font-bold text-[#0D1B2A]">Address Search</div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  Address suggestions provide coordinates. ErfStoep then checks that point against
                  loaded official parcel boundaries.
                </p>
                <input
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  autoFocus
                  placeholder="Enter street address or place name"
                  className="mt-3 w-full rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00]/55"
                />
                {!isAddressAutocompleteConfigured() && (
                  <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                    Address autocomplete is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY with
                    Places enabled.
                  </p>
                )}
              </div>

              {addressInput.length > 0 && addressInput.length < 3 && (
                <div className="px-4 py-3 text-sm text-[#0D1B2A]/62">
                  Type at least 3 characters to search addresses.
                </div>
              )}
              {addressLoading && (
                <div className="px-4 py-3 text-sm text-[#0D1B2A]/68">
                  Finding address suggestions...
                </div>
              )}
              {addressError && (
                <div className="px-4 py-3 text-sm text-[#8A3A12]">{addressError}</div>
              )}

              {addressResolution && (
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
                  <div className="mt-2 font-semibold text-[#0D1B2A]">
                    {addressResolution.address}
                  </div>
                  {addressResolution.status !== "checking" && (
                    <div className="mt-1 font-mono text-[11px] text-[#0D1B2A]/62">
                      {addressResolution.lat.toFixed(6)}, {addressResolution.lng.toFixed(6)}
                    </div>
                  )}
                  {(addressResolution.status === "exact" ||
                    addressResolution.status === "likely") && (
                    <div className="mt-3 rounded-xl bg-white/80 p-3">
                      <div className="font-semibold text-[#0D1B2A]">
                        {addressResolution.match.title}
                      </div>
                      <div className="text-xs text-[#0D1B2A]/62">
                        {resultArea(addressResolution.match) || addressResolution.match.subtitle}
                      </div>
                      {addressResolution.match.distanceMeters !== undefined && (
                        <div className="mt-1 text-xs text-[#0D1B2A]/62">
                          About {Math.round(addressResolution.match.distanceMeters)}m from the
                          address point.
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => highlightResult(addressResolution.match)}
                          className="rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#142941]"
                        >
                          Highlight erf on map
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenOfficialWorkbench?.(addressResolution.match);
                            clearAll();
                          }}
                          className="rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-bold text-[#0D1B2A] hover:bg-[#fbf8f1]"
                        >
                          Open Workbench
                        </button>
                      </div>
                    </div>
                  )}
                  {addressResolution.status === "address-only" && (
                    <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                      Address found, but no official parcel boundary match was found for this point.
                      No official erf identity has been inferred.
                    </p>
                  )}
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
                        Google address suggestion
                      </span>
                    </div>
                    <div className="text-[11px] leading-4 text-[#0D1B2A]/58">
                      Selecting this zooms to the coordinate and checks loaded official parcels.
                    </div>
                  </button>
                ))}
            </div>
          )}

          {lane === "erf" && (
            <div>
              <div className="border-b border-[#0D1B2A]/8 bg-[#fbf8f1] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setLane(null)}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[#0D1B2A]/64 hover:text-[#0D1B2A]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Search type
                </button>
                <div className="text-sm font-bold text-[#0D1B2A]">Erf Search</div>
                <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
                  LPI and parcel key are exact. Erf numbers repeat across South Africa, so use a
                  Deeds Office, township, or loaded map area context.
                </p>
                {context.currentAreaLabel && (
                  <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-[#174634]">
                    Suggested from loaded map area: {context.currentAreaLabel}
                  </p>
                )}
              </div>

              <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
                <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0D1B2A]/58">
                  Deeds Office
                  <select
                    value={structured.deedsOffice}
                    onChange={(e) =>
                      setStructured((value) => ({ ...value, deedsOffice: e.target.value }))
                    }
                    className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs normal-case tracking-normal text-[#0D1B2A] outline-none focus:border-[#FF6A00]/50"
                  >
                    <option value="">Choose Deeds Office</option>
                    {context.deedsOfficeOptions.map((office) => (
                      <option key={office} value={office}>
                        {office}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0D1B2A]/58">
                  Township / area
                  <input
                    value={structured.township}
                    onChange={(e) =>
                      setStructured((value) => ({ ...value, township: e.target.value }))
                    }
                    list="erf-search-townships"
                    placeholder={
                      selectedOfficeHasLoadedCoverage
                        ? "Loaded map area only"
                        : "No loaded township coverage"
                    }
                    className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs normal-case tracking-normal text-[#0D1B2A] outline-none focus:border-[#FF6A00]/50"
                  />
                  <datalist id="erf-search-townships">
                    {allTownshipOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
                <input
                  value={structured.erf}
                  onChange={(e) => setStructured((value) => ({ ...value, erf: e.target.value }))}
                  placeholder="Erf number"
                  className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
                />
                <input
                  value={structured.portion}
                  onChange={(e) =>
                    setStructured((value) => ({ ...value, portion: e.target.value }))
                  }
                  placeholder="Portion number, default 0"
                  className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50"
                />
                <input
                  value={structured.code}
                  onChange={(e) => setStructured((value) => ({ ...value, code: e.target.value }))}
                  placeholder="LPI or parcel key"
                  className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50 sm:col-span-2"
                />
                <input
                  value={erfQueryText}
                  onChange={(e) => setErfQueryText(e.target.value)}
                  placeholder="Optional free-text area context"
                  className="rounded-xl border border-[#0D1B2A]/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]/50 sm:col-span-2"
                />
                <button
                  type="button"
                  onClick={runErfSearch}
                  className="rounded-xl bg-[#0D1B2A] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#142941] sm:col-span-2"
                >
                  Search official parcel identity
                </button>
              </div>

              {allTownshipOptions.length === 0 && (
                <div className="mx-4 mb-3 rounded-xl bg-[#fff8ec] px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                  Township options are available for loaded map areas only. Zoom into the area or
                  search exact LPI/parcel key.
                </div>
              )}
              {context.registryLabelOptions.length > 0 && selectedOfficeHasLoadedCoverage && (
                <div className="mx-4 mb-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[#0D1B2A]/58 ring-1 ring-[#0D1B2A]/8">
                  Registry label: {context.registryLabelOptions.slice(0, 3).join(", ")}. Use the
                  clean area selector above where available.
                </div>
              )}
              {shouldWarnErfAmbiguous && (
                <div className="mx-4 mb-3 rounded-xl bg-[#fff8ec] px-3 py-2 text-xs leading-5 text-[#8A3A12]">
                  Erf numbers repeat across South Africa. Choose a Deeds Office and township, or
                  zoom into the area first.
                </div>
              )}
              {erfSearched && submittedErfQuery && erfResults.length === 0 && (
                <div className="border-t border-[#0D1B2A]/8 px-4 py-3 text-sm leading-6 text-[#0D1B2A]/68">
                  No official parcel match found yet. Zoom in and click a CSG or Kouga parcel
                  outline, or search by address, erf number, LPI, or parcel key.
                </div>
              )}
              {erfResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => highlightResult(result)}
                  className="block w-full border-t border-[#0D1B2A]/8 px-4 py-3 text-left hover:bg-[#f8f3ea]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#0D1B2A]">{result.title}</div>
                      <div className="text-xs text-[#0D1B2A]/62">
                        {resultArea(result) || result.subtitle}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#174634]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#174634]">
                      Official
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[#0D1B2A]/64">
                    <span>{confidenceLabel(result.confidence)}</span>
                    <span aria-hidden="true">-</span>
                    <span>{result.matchReason}</span>
                    <span aria-hidden="true">-</span>
                    <span>{result.sourceLabel}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[11px] text-[#0D1B2A]/58 sm:grid-cols-2">
                    {result.fields.lpi && <span>LPI: {result.fields.lpi}</span>}
                    {result.fields.parcelKey && <span>Parcel key: {result.fields.parcelKey}</span>}
                    {result.fields.municipality && (
                      <span>Municipality: {result.fields.municipality}</span>
                    )}
                    {result.fields.province && <span>Province: {result.fields.province}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        highlightResult(result);
                      }}
                      className="rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#142941]"
                    >
                      Highlight erf on map
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenOfficialWorkbench?.(result);
                        clearAll();
                      }}
                      className="rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-bold text-[#0D1B2A] hover:bg-[#fbf8f1]"
                    >
                      Open Workbench
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
