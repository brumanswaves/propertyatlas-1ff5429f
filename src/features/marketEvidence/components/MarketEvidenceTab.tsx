import { useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { copyToClipboard, openExternalUrl } from "@/lib/external";
import { toast } from "sonner";
import { evidenceFromCandidate, runActiveListingRadar } from "../activeListingRadar";
import {
  buildAddressCandidate,
  buildInitialAddressCandidate,
  googleMapsPointUrl,
  marketAddressToPropertyIdentityOverride,
  selectedMarketAddress,
} from "../addressIntelligence";
import { runAreaListingRadar } from "../areaRadar";
import { calculateMarketEvidenceSummary } from "../calculateMarketEvidenceSummary";
import { KOUGA_AREA_SCAN_MARKETS } from "../constants";
import {
  buildSimpleListingSearches,
  resolvePropertyIdentity,
  type PropertyIdentity,
  type PropertyIdentityOverride,
  type SimpleListingSearch,
} from "../propertyIdentity";
import {
  CONFIDENCE_LABELS,
  type AddressCandidate,
  type AreaRadarMode,
  type AreaRadarOptions,
  type AreaRadarPropertyType,
  type AreaRadarResult,
  type AreaRadarSortMode,
  type AreaRadarSource,
  type AreaSearchScope,
  type ListingCandidate,
  type MarketAddressIntelligence,
  type MarketEvidenceConfidence,
  type MarketEvidenceRelationship,
  type RadarCandidateResult,
  type SavedMarketEvidence,
} from "../types";
import { useSavedMarketEvidence } from "../hooks/useSavedMarketEvidence";

const COMP_RELATIONSHIPS: Array<{ value: MarketEvidenceRelationship; label: string }> = [
  { value: "target_asset", label: "Exact listing" },
  { value: "possible_target_asset", label: "Possible exact listing" },
  { value: "same_street_comp", label: "Same street comp" },
  { value: "same_suburb_comp", label: "Same area comp" },
  { value: "vacant_land_comp", label: "Vacant land comp" },
  { value: "broader_market_comp", label: "Broader market comp" },
  { value: "not_related", label: "Not relevant" },
];

const SOURCES: AreaRadarSource[] = [
  "all",
  "Property24",
  "Private Property",
  "Pam Golding",
  "Seeff",
  "Chas Everitt",
  "Rawson",
  "RE/MAX",
];

const PROPERTY_TYPES: Array<{ value: AreaRadarPropertyType; label: string }> = [
  { value: "all", label: "All" },
  { value: "house", label: "House" },
  { value: "vacant_land", label: "Vacant land / plot / stand" },
  { value: "farm_smallholding", label: "Farm / smallholding" },
  { value: "commercial", label: "Commercial" },
  { value: "sectional_title", label: "Sectional title" },
];

const AREA_SCOPES: Array<{ value: AreaSearchScope; label: string }> = [
  { value: "1km", label: "1km around parcel" },
  { value: "3km", label: "3km around parcel" },
  { value: "10km", label: "10km around parcel" },
  { value: "same_suburb", label: "Same suburb" },
  { value: "same_town", label: "Same town" },
  { value: "municipality", label: "Municipality" },
];

const SORT_MODES: Array<{ value: AreaRadarSortMode; label: string }> = [
  { value: "best_match", label: "Best radar match" },
  { value: "nearest_first", label: "Nearest first" },
  { value: "newest_first", label: "Newest first" },
  { value: "price_low_high", label: "Price low to high" },
  { value: "price_high_low", label: "Price high to low" },
];

const PILL_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800";
const PILL_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-50";
const CHOICE =
  "rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 text-left text-sm font-semibold text-stone-800 hover:bg-amber-50";
const CHOICE_ACTIVE =
  "rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-left text-sm font-semibold text-stone-950 shadow-sm";
const FIELD = "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm";

type CompDraft = {
  id?: string;
  sourceUrl: string;
  sourcePortal: string;
  title: string;
  askingPrice: string;
  propertyType: string;
  beds: string;
  baths: string;
  landSizeM2: string;
  buildingSizeM2: string;
  relationship: MarketEvidenceRelationship;
  notes: string;
};

type CandidateDraft = {
  sourceUrl: string;
  sourcePortal: AreaRadarSource;
  title: string;
  askingPrice: string;
  propertyType: string;
  locationText: string;
  suburb: string;
  town: string;
  municipality: string;
  province: string;
  streetName: string;
  landSizeM2: string;
  lat: string;
  lng: string;
};

type AddressDraft = {
  formattedAddress: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  town: string;
  province: string;
  notes: string;
};

function emptyCompDraft(): CompDraft {
  return {
    sourceUrl: "",
    sourcePortal: "",
    title: "",
    askingPrice: "",
    propertyType: "",
    beds: "",
    baths: "",
    landSizeM2: "",
    buildingSizeM2: "",
    relationship: "same_suburb_comp",
    notes: "",
  };
}

function emptyCandidateDraft(
  identity: PropertyIdentity,
  parcel: NormalizedOfficialParcel,
): CandidateDraft {
  return {
    sourceUrl: "",
    sourcePortal: "Property24",
    title: "",
    askingPrice: "",
    propertyType: "",
    locationText: identity.bestAddress ?? "",
    suburb: identity.marketSuburb ?? identity.officialSuburb ?? "",
    town: identity.town ?? "",
    municipality: identity.municipality ?? "",
    province: identity.province ?? "",
    streetName: identity.streetName ?? "",
    landSizeM2: identity.landSizeM2 ? String(identity.landSizeM2) : "",
    lat: parcel.coordinates?.lat != null ? String(parcel.coordinates.lat) : "",
    lng: parcel.coordinates?.lng != null ? String(parcel.coordinates.lng) : "",
  };
}

function draftFromComp(item: SavedMarketEvidence): CompDraft {
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    sourcePortal: item.sourcePortal,
    title: item.title,
    askingPrice: item.askingPrice ? String(item.askingPrice) : "",
    propertyType: item.propertyType ?? "",
    beds: item.beds ? String(item.beds) : "",
    baths: item.baths ? String(item.baths) : "",
    landSizeM2: item.landSizeM2 ? String(item.landSizeM2) : "",
    buildingSizeM2: item.buildingSizeM2 ? String(item.buildingSizeM2) : "",
    relationship: item.relationship,
    notes: item.notes ?? "",
  };
}

function n(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function coord(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | undefined | null) {
  if (!value) return "Not enough priced comps yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function rate(value: number | undefined | null) {
  if (!value) return "Not enough priced comps yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}/m2`;
}

function portalFromUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("property24")) return "Property24";
  if (lower.includes("privateproperty")) return "Private Property";
  if (lower.includes("pamgolding")) return "Pam Golding";
  if (lower.includes("seeff")) return "Seeff";
  if (lower.includes("remax")) return "RE/MAX";
  if (lower.includes("rawson")) return "Rawson";
  if (lower.includes("chaseveritt")) return "Chas Everitt";
  return "Other";
}

function confidenceLabel(identity: PropertyIdentity) {
  if (identity.confidence === "high") return "High confidence";
  if (identity.confidence === "medium") return "Medium confidence";
  if (identity.confidence === "low") return "Low confidence";
  return "Needs confirmation";
}

function addressDraftFromIdentity(identity: PropertyIdentity): AddressDraft {
  return {
    formattedAddress: identity.bestAddress ?? "",
    streetNumber: identity.streetNumber ?? "",
    streetName: identity.streetName ?? "",
    suburb: identity.marketSuburb ?? identity.officialSuburb ?? "",
    town: identity.town ?? "",
    province: identity.province ?? "",
    notes: "",
  };
}

function areaPhrase(identity: PropertyIdentity, options: AreaRadarOptions) {
  const area =
    identity.marketSuburb ??
    identity.officialSuburb ??
    identity.town ??
    identity.municipality ??
    identity.province ??
    "this area";
  const type =
    options.propertyType === "vacant_land"
      ? "vacant land"
      : options.propertyType === "house"
        ? "property"
        : options.propertyType === "farm_smallholding"
          ? "smallholding farm"
          : "property";
  return `${area} ${type} for sale`;
}

function suggestedAreaChips(identity: PropertyIdentity) {
  const context = [
    identity.marketSuburb,
    identity.officialSuburb,
    identity.town,
    identity.municipality,
    identity.province,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/kouga|st francis|cape st francis|humansdorp|jeffreys/.test(context)) return [];
  return KOUGA_AREA_SCAN_MARKETS.filter((market) => {
    if (market === "Kouga") return true;
    return context.includes(market.toLowerCase()) || /st francis|kouga/.test(context);
  }).slice(0, 7);
}

export function MarketEvidenceTab({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const {
    loading,
    savedPropertyExists,
    evidence,
    propertyIdentity,
    marketAddressIntelligence,
    candidates,
    upsertEvidence,
    deleteEvidence,
    upsertCandidate,
    savePropertyIdentity,
    saveMarketAddressIntelligence,
  } = useSavedMarketEvidence(parcel.id);
  const selectedAddress = selectedMarketAddress(marketAddressIntelligence);
  const identityOverride = useMemo(
    () =>
      selectedAddress ? marketAddressToPropertyIdentityOverride(selectedAddress) : propertyIdentity,
    [selectedAddress, propertyIdentity],
  );
  const identity = useMemo(
    () => resolvePropertyIdentity(parcel, identityOverride),
    [parcel, identityOverride],
  );
  const searches = useMemo(() => buildSimpleListingSearches(identity), [identity]);
  const summary = useMemo(() => calculateMarketEvidenceSummary(evidence), [evidence]);
  const [identityDraft, setIdentityDraft] = useState<PropertyIdentityOverride>(() => ({
    address: identity.bestAddress ?? "",
    streetName: identity.streetName ?? "",
    marketSuburb: identity.marketSuburb ?? "",
    note: identity.userNote ?? "",
  }));
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(() =>
    addressDraftFromIdentity(identity),
  );
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [compDraft, setCompDraft] = useState<CompDraft>(() => emptyCompDraft());
  const [candidateDraft, setCandidateDraft] = useState<CandidateDraft>(() =>
    emptyCandidateDraft(identity, parcel),
  );
  const [showCompForm, setShowCompForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [radarMode, setRadarMode] = useState<AreaRadarMode>("exact_match");
  const [areaOptions, setAreaOptions] = useState<AreaRadarOptions>({
    scope: "10km",
    source: "all",
    propertyType: "all",
    sort: "best_match",
  });
  const [radarRan, setRadarRan] = useState(false);

  const exactResults = useMemo(
    () => runActiveListingRadar(parcel, candidates, selectedAddress),
    [parcel, candidates, selectedAddress],
  );
  const areaResults = useMemo(
    () => runAreaListingRadar(parcel, candidates, areaOptions, marketAddressIntelligence),
    [parcel, candidates, areaOptions, marketAddressIntelligence],
  );
  const visibleRadarResults = radarMode === "area_listings" ? areaResults : exactResults;
  const mapsUrl = googleMapsPointUrl(parcel.coordinates);
  const areaChips = suggestedAreaChips(identity);

  useEffect(() => {
    setIdentityDraft({
      address: identity.bestAddress ?? "",
      streetName: identity.streetName ?? "",
      marketSuburb: identity.marketSuburb ?? "",
      note: identity.userNote ?? "",
      confirmedAt: propertyIdentity?.confirmedAt ?? null,
    });
    setAddressDraft(addressDraftFromIdentity(identity));
  }, [identity, propertyIdentity?.confirmedAt]);

  async function copy(phrase: string) {
    const ok = await copyToClipboard(phrase);
    if (ok) toast.success("Search phrase copied");
    else toast.error("Could not copy phrase");
  }

  async function confirmAddress() {
    await savePropertyIdentity({
      ...identityDraft,
      address: identity.bestAddress ?? identityDraft.address ?? null,
      streetName: identity.streetName ?? identityDraft.streetName ?? null,
      marketSuburb: identity.marketSuburb ?? identityDraft.marketSuburb ?? null,
      confirmedAt: new Date().toISOString(),
    });
    setEditingIdentity(false);
  }

  async function saveEditedIdentity() {
    await savePropertyIdentity(identityDraft);
    setEditingIdentity(false);
  }

  async function saveAddressCandidate(source: AddressCandidate["source"] = "user_entered") {
    if (!addressDraft.formattedAddress.trim()) {
      toast.error("Market address is required");
      return;
    }
    const candidate = buildAddressCandidate({
      formattedAddress: addressDraft.formattedAddress,
      streetNumber: addressDraft.streetNumber,
      streetName: addressDraft.streetName,
      suburb: addressDraft.suburb,
      town: addressDraft.town,
      municipality: identity.municipality,
      province: addressDraft.province,
      lat: parcel.coordinates?.lat ?? null,
      lng: parcel.coordinates?.lng ?? null,
      source,
      confidence: "unverified",
      reason:
        "Market address is used for portal matching. It does not replace official parcel data.",
    });
    const existing = marketAddressIntelligence?.candidates ?? [];
    await saveMarketAddressIntelligence({
      selectedAddressId: candidate.id,
      candidates: [candidate, ...existing],
      userConfirmedAddress: candidate,
      lastResolvedAt: new Date().toISOString(),
      notes: addressDraft.notes || null,
    });
    setEditingAddress(false);
  }

  async function useSuggestedAddress(candidate: AddressCandidate) {
    await saveMarketAddressIntelligence({
      selectedAddressId: candidate.id,
      candidates: [candidate, ...(marketAddressIntelligence?.candidates ?? [])].filter(
        (item, index, array) => array.findIndex((entry) => entry.id === item.id) === index,
      ),
      userConfirmedAddress: {
        ...candidate,
        confidence: "high",
        updatedAt: new Date().toISOString(),
      },
      lastResolvedAt: new Date().toISOString(),
      notes: marketAddressIntelligence?.notes ?? null,
    });
  }

  async function clearAddress() {
    await saveMarketAddressIntelligence({
      selectedAddressId: null,
      candidates: marketAddressIntelligence?.candidates ?? [],
      userConfirmedAddress: null,
      lastResolvedAt: new Date().toISOString(),
      notes: marketAddressIntelligence?.notes ?? null,
    });
  }

  async function saveCandidate() {
    if (!candidateDraft.sourceUrl.trim()) {
      toast.error("Candidate URL is required");
      return;
    }
    await upsertCandidate({
      sourcePortal:
        candidateDraft.sourcePortal === "all"
          ? portalFromUrl(candidateDraft.sourceUrl)
          : candidateDraft.sourcePortal,
      sourceUrl: candidateDraft.sourceUrl.trim(),
      title: candidateDraft.title.trim() || "Imported listing candidate",
      askingPrice: n(candidateDraft.askingPrice),
      propertyType: candidateDraft.propertyType.trim() || null,
      locationText: candidateDraft.locationText.trim() || null,
      microMarket: candidateDraft.suburb.trim() || null,
      suburb: candidateDraft.suburb.trim() || null,
      town: candidateDraft.town.trim() || null,
      municipality: candidateDraft.municipality.trim() || null,
      province: candidateDraft.province.trim() || null,
      streetName: candidateDraft.streetName.trim() || null,
      descriptionText: null,
      beds: null,
      baths: null,
      landSizeM2: n(candidateDraft.landSizeM2),
      buildingSizeM2: null,
      agencyName: null,
      imageUrl: null,
      listingStatus: "imported",
      fetchedAt: null,
      lastSeenAt: new Date().toISOString(),
      rawSourceArea: candidateDraft.suburb.trim() || candidateDraft.town.trim() || null,
      lat: coord(candidateDraft.lat),
      lng: coord(candidateDraft.lng),
    });
    setCandidateDraft(emptyCandidateDraft(identity, parcel));
    setShowCandidateForm(false);
    setRadarRan(true);
  }

  async function saveComp() {
    if (!compDraft.sourceUrl.trim()) {
      toast.error("Comp URL is required");
      return;
    }
    const confidence: MarketEvidenceConfidence =
      compDraft.relationship === "target_asset"
        ? "high"
        : compDraft.relationship === "not_related"
          ? "excluded"
          : compDraft.relationship === "broader_market_comp"
            ? "low"
            : "medium";
    await upsertEvidence({
      id: compDraft.id,
      sourceUrl: compDraft.sourceUrl.trim(),
      sourcePortal: compDraft.sourcePortal.trim() || portalFromUrl(compDraft.sourceUrl),
      title: compDraft.title.trim() || "Saved comp",
      askingPrice: n(compDraft.askingPrice),
      propertyType: compDraft.propertyType.trim() || null,
      beds: n(compDraft.beds),
      baths: n(compDraft.baths),
      landSizeM2: n(compDraft.landSizeM2),
      buildingSizeM2: n(compDraft.buildingSizeM2),
      relationship: compDraft.relationship,
      confidence,
      includeInSummary: compDraft.relationship !== "not_related" && confidence !== "excluded",
      notes: compDraft.notes.trim() || null,
    });
    setCompDraft(emptyCompDraft());
    setShowCompForm(false);
  }

  async function verifyCandidate(
    result: RadarCandidateResult | AreaRadarResult,
    relationship: MarketEvidenceRelationship,
  ) {
    await upsertEvidence(evidenceFromCandidate(result.candidate, result.match, relationship));
  }

  return (
    <div className="space-y-5 text-stone-950">
      <PropertyIdentityCard
        identity={identity}
        selectedAddress={selectedAddress}
        savedPropertyExists={savedPropertyExists}
        editing={editingIdentity}
        draft={identityDraft}
        setDraft={setIdentityDraft}
        onEdit={() => setEditingIdentity(true)}
        onConfirm={confirmAddress}
        onSave={saveEditedIdentity}
      />

      <AddressIntelligenceSection
        identity={identity}
        parcel={parcel}
        savedPropertyExists={savedPropertyExists}
        selectedAddress={selectedAddress}
        intelligence={marketAddressIntelligence}
        mapsUrl={mapsUrl}
        editing={editingAddress}
        draft={addressDraft}
        setDraft={setAddressDraft}
        onEdit={() => setEditingAddress(true)}
        onSave={() => saveAddressCandidate("user_entered")}
        onUseSuggested={useSuggestedAddress}
        onClear={clearAddress}
        onAddFromMaps={() => {
          setEditingAddress(true);
          setAddressDraft({ ...addressDraft, notes: "Manual Google Maps What's here? lookup" });
        }}
      />

      <RadarConsole
        mode={radarMode}
        setMode={setRadarMode}
        options={areaOptions}
        setOptions={setAreaOptions}
        candidates={candidates}
        results={visibleRadarResults}
        radarRan={radarRan}
        setRadarRan={setRadarRan}
        showCandidateForm={showCandidateForm}
        setShowCandidateForm={setShowCandidateForm}
        candidateDraft={candidateDraft}
        setCandidateDraft={setCandidateDraft}
        onSaveCandidate={saveCandidate}
        onVerifyCandidate={verifyCandidate}
        identity={identity}
        copy={copy}
      />

      <FallbackSearchTools
        searches={searches}
        identity={identity}
        areaOptions={areaOptions}
        copy={copy}
      />

      <SavedCompsSection
        loading={loading}
        evidence={evidence}
        savedPropertyExists={savedPropertyExists}
        compDraft={compDraft}
        setCompDraft={setCompDraft}
        showCompForm={showCompForm}
        setShowCompForm={setShowCompForm}
        saveComp={saveComp}
        deleteEvidence={deleteEvidence}
      />

      {evidence.length > 0 && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
          <SectionTitle>Market Thesis from saved evidence</SectionTitle>
          <p className="mt-1 text-sm text-emerald-900">
            Simple math from saved comps only. Unverified radar candidates do not affect this.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Saved comps" value={String(summary.totalEvidence)} />
            <Metric label="Included comps" value={String(summary.includedEvidence)} />
            <Metric label="Average asking price" value={money(summary.averageAskingPrice)} />
            <Metric label="Median asking price" value={money(summary.medianAskingPrice)} />
            <Metric label="Average land R/m2" value={rate(summary.averageLandPricePerM2)} />
            <Metric label="Median land R/m2" value={rate(summary.medianLandPricePerM2)} />
          </div>
        </section>
      )}

      {areaChips.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <SectionTitle>Kouga area suggestions</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {areaChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => copy(`${chip} property for sale`)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-amber-50"
              >
                {chip}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PropertyIdentityCard({
  identity,
  selectedAddress,
  savedPropertyExists,
  editing,
  draft,
  setDraft,
  onEdit,
  onConfirm,
  onSave,
}: {
  identity: PropertyIdentity;
  selectedAddress: AddressCandidate | null;
  savedPropertyExists: boolean;
  editing: boolean;
  draft: PropertyIdentityOverride;
  setDraft: (draft: PropertyIdentityOverride) => void;
  onEdit: () => void;
  onConfirm: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-[#fff8ec] to-[#f8efe2] p-5 shadow-[0_18px_50px_rgba(120,72,24,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-200/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-900">
            <Search className="h-3.5 w-3.5" /> Listings & Comps
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">
            Find listings and comps for this erf
          </h3>
          <p className="mt-1 text-sm text-stone-700">
            First confirm the property identity. Then search for exact and area listing candidates.
          </p>
        </div>
        <Badge>{confidenceLabel(identity)}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <IdentityField
          label="Subject"
          value={
            identity.officialErf
              ? `Erf ${identity.officialErf}, Portion ${identity.officialPortion ?? "0"}`
              : "Official erf not known"
          }
        />
        <IdentityField
          label="Official parcel address"
          value={identity.bestAddress ?? "No confirmed street address yet"}
          strong={Boolean(identity.bestAddress)}
        />
        <IdentityField
          label="Selected market address"
          value={selectedAddress?.formattedAddress ?? "No market address selected yet"}
          strong={Boolean(selectedAddress)}
        />
        <IdentityField
          label="Market area"
          value={identity.marketSuburb ?? identity.officialSuburb ?? identity.town ?? "Not known"}
        />
      </div>

      {selectedAddress && selectedAddress.formattedAddress !== identity.bestAddress && (
        <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-stone-700">
          Market address is used for portal matching. It does not replace official parcel data.
        </p>
      )}
      {identity.warnings.length > 0 && (
        <div className="mt-3 grid gap-1">
          {identity.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-stone-700"
            >
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!savedPropertyExists || !identity.bestAddress}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Confirm address
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-50"
        >
          <Pencil className="h-4 w-4" /> Edit address
        </button>
        {!savedPropertyExists && (
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-stone-700">
            Save this erf first to store an edited address.
          </span>
        )}
      </div>

      {editing && (
        <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
          <input
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            placeholder="Address"
            value={draft.address ?? ""}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              placeholder="Street name"
              value={draft.streetName ?? ""}
              onChange={(event) => setDraft({ ...draft, streetName: event.target.value })}
            />
            <input
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              placeholder="Market suburb"
              value={draft.marketSuburb ?? ""}
              onChange={(event) => setDraft({ ...draft, marketSuburb: event.target.value })}
            />
          </div>
          <textarea
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            rows={2}
            placeholder="Identity note"
            value={draft.note ?? ""}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!savedPropertyExists}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <BookmarkCheck className="h-4 w-4" /> Save identity
          </button>
        </div>
      )}
    </section>
  );
}

function AddressIntelligenceSection({
  identity,
  parcel,
  savedPropertyExists,
  selectedAddress,
  intelligence,
  mapsUrl,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onUseSuggested,
  onClear,
  onAddFromMaps,
}: {
  identity: PropertyIdentity;
  parcel: NormalizedOfficialParcel;
  savedPropertyExists: boolean;
  selectedAddress: AddressCandidate | null;
  intelligence: MarketAddressIntelligence | null;
  mapsUrl: string | null;
  editing: boolean;
  draft: AddressDraft;
  setDraft: (draft: AddressDraft) => void;
  onEdit: () => void;
  onSave: () => void;
  onUseSuggested: (candidate: AddressCandidate) => void;
  onClear: () => void;
  onAddFromMaps: () => void;
}) {
  const suggested = useMemo(() => buildInitialAddressCandidate(parcel), [parcel]);
  const hasAddress = Boolean(selectedAddress);
  const candidates = intelligence?.candidates ?? [];

  return (
    <section className="rounded-3xl border border-stone-200 bg-[#fffdf8] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Address Intelligence</SectionTitle>
          <p className="mt-1 text-sm text-stone-700">
            Market address is used for portal matching. It does not replace official parcel data.
          </p>
        </div>
        <Badge>{hasAddress ? "Selected market address" : "Needs address confirmation"}</Badge>
      </div>

      {selectedAddress ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-sm font-semibold">{selectedAddress.formattedAddress}</p>
          <p className="mt-1 text-xs text-emerald-900">
            Source: {selectedAddress.source}. Confidence: {selectedAddress.confidence}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className={PILL_SECONDARY}>
              Edit
            </button>
            <button type="button" onClick={onClear} className={PILL_SECONDARY}>
              Clear selection
            </button>
            {mapsUrl && (
              <button
                type="button"
                onClick={(event) => openExternalUrl(mapsUrl, event)}
                className={PILL_PRIMARY}
              >
                <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
              </button>
            )}
          </div>
        </div>
      ) : suggested ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold">{suggested.formattedAddress}</p>
          <p className="mt-1 text-xs text-stone-700">
            Suggested from {suggested.source}. Verify manually before using.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUseSuggested(suggested)}
              className={PILL_PRIMARY}
            >
              Use this address
            </button>
            <button type="button" onClick={onEdit} className={PILL_SECONDARY}>
              Edit before using
            </button>
            {mapsUrl && (
              <button
                type="button"
                onClick={(event) => openExternalUrl(mapsUrl, event)}
                className={PILL_SECONDARY}
              >
                Open in Google Maps
              </button>
            )}
          </div>
        </div>
      ) : parcel.coordinates ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold">No confirmed market address yet.</p>
          <p className="mt-1 text-sm text-stone-700">
            Open Google Maps at this parcel point. Use "What's here?" if needed, then paste or
            confirm the market address below.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mapsUrl && (
              <button
                type="button"
                onClick={(event) => openExternalUrl(mapsUrl, event)}
                className={PILL_PRIMARY}
              >
                <MapPin className="h-3.5 w-3.5" /> Open Google Maps at parcel point
              </button>
            )}
            <button type="button" onClick={onAddFromMaps} className={PILL_SECONDARY}>
              Add address manually
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
          <p className="text-sm font-semibold">
            No address or parcel point is available yet. You can still use area-level Market
            Evidence, but exact matching will be weaker.
          </p>
          <button type="button" onClick={onEdit} className={`${PILL_SECONDARY} mt-3`}>
            Add address manually
          </button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-3 grid gap-2">
          {candidates.slice(0, 3).map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onUseSuggested(candidate)}
              className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left text-xs hover:bg-amber-50"
            >
              <span className="font-semibold">{candidate.formattedAddress}</span>
              <span className="ml-2 text-stone-500">{candidate.source}</span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <AddressForm
          draft={draft}
          setDraft={setDraft}
          onSave={onSave}
          disabled={!savedPropertyExists}
          fallbackArea={identity.marketSuburb ?? identity.town ?? ""}
        />
      )}
    </section>
  );
}

function AddressForm({
  draft,
  setDraft,
  onSave,
  disabled,
  fallbackArea,
}: {
  draft: AddressDraft;
  setDraft: (draft: AddressDraft) => void;
  onSave: () => void;
  disabled: boolean;
  fallbackArea: string;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
      <input
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        placeholder="Formatted address"
        value={draft.formattedAddress}
        onChange={(event) => setDraft({ ...draft, formattedAddress: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Street number"
          value={draft.streetNumber}
          onChange={(event) => setDraft({ ...draft, streetNumber: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Street name"
          value={draft.streetName}
          onChange={(event) => setDraft({ ...draft, streetName: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder={`Suburb or market area${fallbackArea ? `, e.g. ${fallbackArea}` : ""}`}
          value={draft.suburb}
          onChange={(event) => setDraft({ ...draft, suburb: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Town"
          value={draft.town}
          onChange={(event) => setDraft({ ...draft, town: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Province"
          value={draft.province}
          onChange={(event) => setDraft({ ...draft, province: event.target.value })}
        />
      </div>
      <textarea
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        rows={2}
        placeholder="Notes"
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
      />
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className={`${PILL_PRIMARY} w-fit disabled:opacity-50`}
      >
        <BookmarkCheck className="h-4 w-4" /> Use selected address
      </button>
    </div>
  );
}

function RadarConsole({
  mode,
  setMode,
  options,
  setOptions,
  candidates,
  results,
  radarRan,
  setRadarRan,
  showCandidateForm,
  setShowCandidateForm,
  candidateDraft,
  setCandidateDraft,
  onSaveCandidate,
  onVerifyCandidate,
  identity,
  copy,
}: {
  mode: AreaRadarMode;
  setMode: (mode: AreaRadarMode) => void;
  options: AreaRadarOptions;
  setOptions: (options: AreaRadarOptions) => void;
  candidates: ListingCandidate[];
  results: Array<RadarCandidateResult | AreaRadarResult>;
  radarRan: boolean;
  setRadarRan: (value: boolean) => void;
  showCandidateForm: boolean;
  setShowCandidateForm: (value: boolean) => void;
  candidateDraft: CandidateDraft;
  setCandidateDraft: (draft: CandidateDraft) => void;
  onSaveCandidate: () => void;
  onVerifyCandidate: (
    result: RadarCandidateResult | AreaRadarResult,
    relationship: MarketEvidenceRelationship,
  ) => void;
  identity: PropertyIdentity;
  copy: (phrase: string) => void;
}) {
  const fallbackPhrase = areaPhrase(identity, options);
  return (
    <section className="rounded-3xl border border-amber-200 bg-[#fff8ec] p-5 shadow-[0_16px_40px_rgba(120,72,24,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            <Target className="h-3.5 w-3.5" /> Active Listing Radar
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            Scan cached and imported listing candidates
          </h3>
          <p className="mt-1 text-sm text-stone-700">
            PropertyAtlas does not scan portals live. Radar only scores source-backed cached or
            manually imported candidates.
          </p>
        </div>
        <Badge>{candidates.length} cached candidates</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("exact_match");
            setRadarRan(true);
          }}
          className={mode === "exact_match" ? CHOICE_ACTIVE : CHOICE}
        >
          Find possible exact match
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("area_listings");
            setRadarRan(true);
          }}
          className={mode === "area_listings" ? CHOICE_ACTIVE : CHOICE}
        >
          Search area listings
        </button>
      </div>

      {mode === "area_listings" && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4" /> Area Radar Controls
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              label="Search area"
              value={options.scope}
              onChange={(value) => setOptions({ ...options, scope: value as AreaSearchScope })}
              options={AREA_SCOPES}
            />
            <Select
              label="Sources"
              value={options.source}
              onChange={(value) => setOptions({ ...options, source: value as AreaRadarSource })}
              options={SOURCES.map((source) => ({
                value: source,
                label: source === "all" ? "All sources" : source,
              }))}
            />
            <Select
              label="Property type"
              value={options.propertyType}
              onChange={(value) =>
                setOptions({ ...options, propertyType: value as AreaRadarPropertyType })
              }
              options={PROPERTY_TYPES}
            />
            <Select
              label="Sort"
              value={options.sort}
              onChange={(value) => setOptions({ ...options, sort: value as AreaRadarSortMode })}
              options={SORT_MODES}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setRadarRan(true)} className={PILL_PRIMARY}>
          Run radar
        </button>
        <button
          type="button"
          onClick={() => setShowCandidateForm(!showCandidateForm)}
          className={PILL_SECONDARY}
        >
          <Plus className="h-3.5 w-3.5" /> Import candidate manually
        </button>
      </div>

      {showCandidateForm && (
        <CandidateForm
          draft={candidateDraft}
          setDraft={setCandidateDraft}
          onSave={onSaveCandidate}
        />
      )}

      {radarRan && candidates.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-white/75 p-4">
          <p className="text-sm font-semibold">
            No listing candidates are loaded for this area yet.
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Active Listing Radar needs source-backed candidates to scan. Import a candidate manually
            now, or use the fallback search tools until the Kouga cached listing pool is added.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCandidateForm(true)}
              className={PILL_PRIMARY}
            >
              Import candidate manually
            </button>
            <button type="button" onClick={() => copy(fallbackPhrase)} className={PILL_SECONDARY}>
              Copy fallback search phrase
            </button>
            <button
              type="button"
              onClick={() => setShowCandidateForm(true)}
              className={PILL_SECONDARY}
            >
              Add candidate from URL
            </button>
          </div>
        </div>
      )}

      {radarRan && candidates.length > 0 && results.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/75 p-4">
          <p className="text-sm font-semibold">
            {mode === "area_listings"
              ? `No cached ${options.source === "all" ? "" : `${options.source} `}candidates are available yet for this area.`
              : "No candidates cleared the radar threshold."}
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Open a portal and use the selected area search below, or import a candidate manually.
          </p>
          <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-2 text-sm font-semibold">
            {fallbackPhrase}
          </div>
        </div>
      )}

      {radarRan && results.length > 0 && (
        <div className="mt-4 grid gap-3">
          {results.map((result) => (
            <CandidateCard key={result.candidate.id} result={result} onVerify={onVerifyCandidate} />
          ))}
        </div>
      )}
    </section>
  );
}

function FallbackSearchTools({
  searches,
  identity,
  areaOptions,
  copy,
}: {
  searches: SimpleListingSearch[];
  identity: PropertyIdentity;
  areaOptions: AreaRadarOptions;
  copy: (phrase: string) => void;
}) {
  return (
    <details className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-stone-800">
        Fallback Search Tools
      </summary>
      <p className="mt-2 text-sm text-stone-600">
        Use these when the cached candidate pool is empty. Google search is fallback only; Google
        Maps is allowed for address intelligence.
      </p>
      <div className="mt-4 grid gap-3">
        {[
          ...searches,
          {
            id: "area-fallback",
            label: "Selected area fallback",
            phrase: areaPhrase(identity, areaOptions),
            helper: "Use this phrase with the selected portal/source filters.",
            primaryPortalUrls: [],
          },
        ].map((search) => (
          <SimpleSearchCard key={search.id} search={search} onCopy={copy} />
        ))}
      </div>
    </details>
  );
}

function SavedCompsSection({
  loading,
  evidence,
  savedPropertyExists,
  compDraft,
  setCompDraft,
  showCompForm,
  setShowCompForm,
  saveComp,
  deleteEvidence,
}: {
  loading: boolean;
  evidence: SavedMarketEvidence[];
  savedPropertyExists: boolean;
  compDraft: CompDraft;
  setCompDraft: (draft: CompDraft) => void;
  showCompForm: boolean;
  setShowCompForm: (value: boolean) => void;
  saveComp: () => void;
  deleteEvidence: (id: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-[#fffdf8] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionTitle>Saved Market Evidence</SectionTitle>
          <p className="mt-1 text-sm text-stone-600">
            Verify candidates into saved evidence. Market thesis uses saved evidence only.
          </p>
        </div>
        <button
          type="button"
          disabled={!savedPropertyExists}
          onClick={() => {
            setCompDraft(emptyCompDraft());
            setShowCompForm(!showCompForm);
          }}
          className={`${PILL_PRIMARY} disabled:opacity-50`}
        >
          <Plus className="h-3.5 w-3.5" /> Add comp
        </button>
      </div>
      {!savedPropertyExists && (
        <p className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-stone-700">
          Save this erf first to store comps and edited addresses.
        </p>
      )}
      {showCompForm && savedPropertyExists && (
        <CompForm draft={compDraft} setDraft={setCompDraft} onSave={saveComp} />
      )}
      {loading ? (
        <p className="mt-3 text-sm text-stone-600">Loading saved market evidence...</p>
      ) : evidence.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">
          No saved comps yet. Verify a radar candidate or save a useful listing URL.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {evidence.map((item) => (
            <CompRow
              key={item.id}
              item={item}
              onEdit={() => {
                setCompDraft(draftFromComp(item));
                setShowCompForm(true);
              }}
              onDelete={() => deleteEvidence(item.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: CandidateDraft;
  setDraft: (draft: CandidateDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
      <input
        className={FIELD}
        placeholder="Candidate URL required"
        value={draft.sourceUrl}
        onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          label="Source portal"
          value={draft.sourcePortal}
          onChange={(value) => setDraft({ ...draft, sourcePortal: value as AreaRadarSource })}
          options={SOURCES.filter((source) => source !== "all").map((source) => ({
            value: source,
            label: source,
          }))}
        />
        <input
          className={FIELD}
          placeholder="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Asking price"
          inputMode="decimal"
          value={draft.askingPrice}
          onChange={(event) => setDraft({ ...draft, askingPrice: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Property type"
          value={draft.propertyType}
          onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Location text"
          value={draft.locationText}
          onChange={(event) => setDraft({ ...draft, locationText: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Street name"
          value={draft.streetName}
          onChange={(event) => setDraft({ ...draft, streetName: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Suburb"
          value={draft.suburb}
          onChange={(event) => setDraft({ ...draft, suburb: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Town"
          value={draft.town}
          onChange={(event) => setDraft({ ...draft, town: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Municipality"
          value={draft.municipality}
          onChange={(event) => setDraft({ ...draft, municipality: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Province"
          value={draft.province}
          onChange={(event) => setDraft({ ...draft, province: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Land size m2"
          inputMode="decimal"
          value={draft.landSizeM2}
          onChange={(event) => setDraft({ ...draft, landSizeM2: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Latitude optional"
          inputMode="decimal"
          value={draft.lat}
          onChange={(event) => setDraft({ ...draft, lat: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Longitude optional"
          inputMode="decimal"
          value={draft.lng}
          onChange={(event) => setDraft({ ...draft, lng: event.target.value })}
        />
      </div>
      <button type="button" onClick={onSave} className={`${PILL_PRIMARY} w-fit`}>
        <BookmarkCheck className="h-4 w-4" /> Import candidate
      </button>
    </div>
  );
}

function CandidateCard({
  result,
  onVerify,
}: {
  result: RadarCandidateResult | AreaRadarResult;
  onVerify: (
    result: RadarCandidateResult | AreaRadarResult,
    relationship: MarketEvidenceRelationship,
  ) => void;
}) {
  const areaReasons = "areaReasons" in result ? result.areaReasons : [];
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{result.candidate.title}</h4>
          <p className="mt-1 text-sm text-stone-600">
            {result.candidate.sourcePortal} · {money(result.candidate.askingPrice)}
          </p>
        </div>
        <Badge>{result.match.score} radar score</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...result.match.reasons, ...areaReasons].map((reason) => (
          <Badge key={reason}>{reason}</Badge>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onVerify(result, "possible_target_asset")}
          className={PILL_PRIMARY}
        >
          Verify as possible exact listing
        </button>
        <button
          type="button"
          onClick={() => onVerify(result, "same_suburb_comp")}
          className={PILL_SECONDARY}
        >
          Verify as nearby comp
        </button>
        <button
          type="button"
          onClick={() => onVerify(result, "vacant_land_comp")}
          className={PILL_SECONDARY}
        >
          Verify as vacant land comp
        </button>
        <button
          type="button"
          onClick={() => onVerify(result, "not_related")}
          className={PILL_SECONDARY}
        >
          Not relevant
        </button>
      </div>
    </article>
  );
}

function IdentityField({
  label,
  value,
  strong = true,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/70 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className={strong ? "mt-1 text-sm font-semibold" : "mt-1 text-sm text-stone-600"}>
        {value}
      </div>
    </div>
  );
}

function SimpleSearchCard({
  search,
  onCopy,
}: {
  search: SimpleListingSearch;
  onCopy: (phrase: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{search.label}</h4>
          <p className="mt-1 text-sm text-stone-600">{search.helper}</p>
        </div>
        <button type="button" onClick={() => onCopy(search.phrase)} className={PILL_SECONDARY}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
      <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-2 text-sm font-semibold">
        {search.phrase}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {search.primaryPortalUrls.map((portal) => (
          <button
            type="button"
            key={portal.portal}
            onClick={(event) => openExternalUrl(portal.url, event)}
            className={PILL_PRIMARY}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open {portal.portal}
          </button>
        ))}
      </div>
    </article>
  );
}

function CompForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: CompDraft;
  setDraft: (draft: CompDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
      <input
        className={FIELD}
        placeholder="Comp URL required"
        value={draft.sourceUrl}
        onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={FIELD}
          placeholder="Portal"
          value={draft.sourcePortal}
          onChange={(event) => setDraft({ ...draft, sourcePortal: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Asking price"
          inputMode="decimal"
          value={draft.askingPrice}
          onChange={(event) => setDraft({ ...draft, askingPrice: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Property type"
          value={draft.propertyType}
          onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Beds"
          inputMode="decimal"
          value={draft.beds}
          onChange={(event) => setDraft({ ...draft, beds: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Baths"
          inputMode="decimal"
          value={draft.baths}
          onChange={(event) => setDraft({ ...draft, baths: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Land size m2"
          inputMode="decimal"
          value={draft.landSizeM2}
          onChange={(event) => setDraft({ ...draft, landSizeM2: event.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Building size m2"
          inputMode="decimal"
          value={draft.buildingSizeM2}
          onChange={(event) => setDraft({ ...draft, buildingSizeM2: event.target.value })}
        />
        <select
          className={FIELD}
          value={draft.relationship}
          onChange={(event) =>
            setDraft({ ...draft, relationship: event.target.value as MarketEvidenceRelationship })
          }
        >
          {COMP_RELATIONSHIPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={FIELD}
        rows={2}
        placeholder="Notes"
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
      />
      <button type="button" onClick={onSave} className={`${PILL_PRIMARY} w-fit`}>
        <BookmarkCheck className="h-4 w-4" /> Save comp
      </button>
    </div>
  );
}

function CompRow({
  item,
  onEdit,
  onDelete,
}: {
  item: SavedMarketEvidence;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const relationship = COMP_RELATIONSHIPS.find((option) => option.value === item.relationship);
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{item.sourcePortal}</Badge>
            <Badge>{relationship?.label ?? item.relationship}</Badge>
            <Badge>{CONFIDENCE_LABELS[item.confidence]}</Badge>
            {!item.includeInSummary && <Badge>Excluded</Badge>}
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {money(item.askingPrice)} {item.landSizeM2 ? ` / ${item.landSizeM2} m2 land` : ""}
          </p>
          {item.notes && <p className="mt-1 text-xs text-stone-600">{item.notes}</p>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(event) => openExternalUrl(item.sourceUrl, event)}
            className="rounded-full p-1.5 hover:bg-amber-50"
            aria-label="Open source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 hover:bg-amber-50"
            aria-label="Edit comp"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1.5 hover:bg-orange-50 hover:text-destructive"
            aria-label="Delete comp"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-stone-600">
      {label}
      <select className={FIELD} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/75 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold tracking-tight text-stone-950">{children}</h3>;
}
