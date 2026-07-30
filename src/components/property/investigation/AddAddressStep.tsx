import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { updateErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import {
  buildAddressCandidate,
  googleMapsPointUrl,
  reverseGeocodeAddressCandidates,
  selectedMarketAddress,
} from "@/features/marketEvidence/addressIntelligence";
import type { AddressCandidate, MarketAddressIntelligence } from "@/features/marketEvidence/types";

interface AddAddressStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
}

function sourceLabel(source: AddressCandidate["source"]) {
  switch (source) {
    case "official_parcel":
      return "Parcel record suggestion";
    case "municipal_record":
      return "Municipal suggestion";
    case "google_reverse_geocode":
      return "Map suggestion";
    case "manual_google_maps_whats_here":
      return "Google Maps selection";
    case "user_entered":
      return "User confirmed";
    default:
      return "Unverified suggestion";
  }
}

function uniqueCandidates(candidates: Array<AddressCandidate | null>) {
  const seen = new Set<string>();
  return candidates.filter((candidate): candidate is AddressCandidate => {
    if (!candidate?.formattedAddress) return false;
    const key = candidate.formattedAddress.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildParcelAddressSuggestion(parcel: NormalizedOfficialParcel): AddressCandidate | null {
  const field = parcel.knownFields.find((item) => {
    const addressLike = /address|display title/i.test(item.label);
    const userManaged = /user|market/i.test(`${item.label} ${item.source}`);
    return addressLike && !userManaged && Boolean(item.value?.trim());
  });
  if (!field) return null;

  const municipal = /municipal|kouga/i.test(field.source);
  return buildAddressCandidate({
    id: municipal ? "municipal-address-suggestion" : "official-parcel-address-suggestion",
    formattedAddress: field.value,
    suburb: parcel.suburbOrArea,
    town: parcel.town,
    municipality: parcel.municipality,
    province: parcel.province,
    lat: parcel.coordinates?.lat ?? null,
    lng: parcel.coordinates?.lng ?? null,
    source: municipal ? "municipal_record" : "official_parcel",
    confidence: "medium",
    reason: municipal
      ? "Address-like text found in the municipal parcel context. Verify it before saving."
      : "Address-like text found in the official parcel context. Verify it before saving.",
  });
}

export function AddAddressStep({ parcel, onContinue }: AddAddressStepProps) {
  const {
    loading,
    marketAddressIntelligence,
    saveMarketAddressIntelligence,
  } = useSavedMarketEvidence(parcel.id);
  const savedAddress = selectedMarketAddress(marketAddressIntelligence);
  const officialSuggestion = useMemo(() => buildParcelAddressSuggestion(parcel), [parcel]);
  const [mapSuggestions, setMapSuggestions] = useState<AddressCandidate[]>([]);
  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [town, setTown] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStreetAddress(savedAddress?.formattedAddress ?? "");
    setSuburb(savedAddress?.suburb ?? parcel.suburbOrArea ?? "");
    setTown(savedAddress?.town ?? parcel.town ?? "");
    setProvince(savedAddress?.province ?? parcel.province ?? "");
    setNotes(marketAddressIntelligence?.notes ?? "");
  }, [
    marketAddressIntelligence?.notes,
    parcel.id,
    parcel.province,
    parcel.suburbOrArea,
    parcel.town,
    savedAddress,
  ]);

  const suggestions = useMemo(
    () => uniqueCandidates([officialSuggestion, ...mapSuggestions]),
    [mapSuggestions, officialSuggestion],
  );
  const mapsUrl = googleMapsPointUrl(parcel.coordinates ?? null);

  function useSuggestion(candidate: AddressCandidate) {
    setStreetAddress(candidate.formattedAddress);
    setSuburb(candidate.suburb ?? parcel.suburbOrArea ?? "");
    setTown(candidate.town ?? parcel.town ?? "");
    setProvince(candidate.province ?? parcel.province ?? "");
    toast.message("Suggestion copied into the working address. Check it before saving.");
  }

  async function findMapSuggestions() {
    if (!parcel.coordinates) {
      toast.message("No parcel coordinates are available for a map suggestion.");
      return;
    }
    setResolving(true);
    try {
      const next = await reverseGeocodeAddressCandidates(
        parcel.coordinates.lat,
        parcel.coordinates.lng,
      );
      setMapSuggestions(next);
      if (!next.length) {
        toast.message("No map address suggestion was available. Enter the address manually.");
      }
    } finally {
      setResolving(false);
    }
  }

  async function saveAndContinue() {
    const cleanStreetAddress = streetAddress.trim();
    if (!cleanStreetAddress) {
      toast.error("Add a street address or location label, or skip this step for now.");
      return;
    }

    setSaving(true);
    try {
      const candidate = buildAddressCandidate({
        formattedAddress: cleanStreetAddress,
        streetName: cleanStreetAddress,
        suburb,
        town,
        municipality: parcel.municipality,
        province,
        lat: parcel.coordinates?.lat ?? null,
        lng: parcel.coordinates?.lng ?? null,
        source: "user_entered",
        confidence: "high",
        reason:
          "Working address explicitly confirmed by the user. It supports map and market matching but does not replace official erf identity.",
      });
      const candidates = uniqueCandidates([
        candidate,
        ...(marketAddressIntelligence?.candidates ?? []),
        officialSuggestion,
        ...mapSuggestions,
      ]);
      const next: MarketAddressIntelligence = {
        selectedAddressId: candidate.id,
        candidates,
        userConfirmedAddress: candidate,
        lastResolvedAt: new Date().toISOString(),
        notes: notes.trim() || null,
      };
      const ok = await saveMarketAddressIntelligence(next);
      if (!ok) return;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `pa.userAddress.${parcel.id}`,
          JSON.stringify({
            streetName: cleanStreetAddress,
            suburb: suburb.trim() || undefined,
            town: town.trim() || undefined,
            province: province.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        );
      }
      updateErfWorkspaceState(parcel.id, {
        marketAddressSaved: true,
        dirty: true,
      });
      onContinue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Working address
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Add the address people use to find this erf
            </h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0D1B2A]/66">
              This helps with maps, listings and local research. It stays separate from the official
              erf number, LPI and parcel identity.
            </p>
          </div>
          {savedAddress && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Address saved
            </span>
          )}
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-[#0D1B2A]">
              Street address or location label
            </span>
            <input
              value={streetAddress}
              onChange={(event) => setStreetAddress(event.target.value)}
              placeholder="Example: 12 Majorca Crescent, or vacant erf off Majorca Crescent"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-[#0D1B2A]">Suburb or local area</span>
            <input
              value={suburb}
              onChange={(event) => setSuburb(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-[#0D1B2A]">Town</span>
            <input
              value={town}
              onChange={(event) => setTown(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-[#0D1B2A]">Province</span>
            <input
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10"
            />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-[#0D1B2A]">Address note, optional</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Example: No street number shown yet. Confirmed from the listing map pin."
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/55 focus:ring-2 focus:ring-[#FF6A00]/10"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-dashed border-[#0D1B2A]/14 bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D1B2A]">
              <Sparkles className="h-4 w-4 text-[#FF6A00]" />
              Address suggestions
            </div>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/62">
              Suggestions are hints only. Easy Erf never promotes a map guess into official property
              data without your confirmation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={resolving}
              onClick={() => void findMapSuggestions()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resolving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              Find from map
            </button>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
              >
                Open Google Maps
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {suggestions.length ? (
          <div className="mt-3 grid gap-2">
            {suggestions.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => useSuggestion(candidate)}
                className="rounded-xl border border-[#0D1B2A]/10 bg-white p-3 text-left transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf4]"
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  {sourceLabel(candidate.source)} · {candidate.confidence}
                </span>
                <span className="mt-1 block text-sm font-semibold text-[#0D1B2A]">
                  {candidate.formattedAddress}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#0D1B2A]/60">
                  {candidate.reason}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#0D1B2A]/58">
            No address suggestion is available yet. Enter the working address manually or use the
            map.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void saveAndContinue()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save and continue to SG diagram
        </button>
      </div>
    </div>
  );
}

export default AddAddressStep;
