import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { parseMarketAddressIntelligence } from "../addressIntelligence";
import type { PropertyIdentityOverride } from "../propertyIdentity";
import type {
  ListingCandidate,
  MarketAddressIntelligence,
  MarketEvidenceListingRole,
  SavedMarketEvidence,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseEvidence(value: unknown, parcelId: string): SavedMarketEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => {
      const importedListing = isRecord(item.importedListing) ? item.importedListing : null;
      return {
        id: String(item.id ?? crypto.randomUUID()),
        parcelId: String(item.parcelId ?? parcelId),
        sourceUrl: String(item.sourceUrl ?? ""),
        sourcePortal: String(item.sourcePortal ?? "Other"),
        title: String(item.title ?? ""),
        askingPrice: item.askingPrice == null ? null : Number(item.askingPrice),
        propertyType: item.propertyType == null ? null : String(item.propertyType),
        beds: item.beds == null ? null : Number(item.beds),
        baths: item.baths == null ? null : Number(item.baths),
        garages: item.garages == null ? null : Number(item.garages),
        parkingSpaces: item.parkingSpaces == null ? null : Number(item.parkingSpaces),
        landSizeM2: item.landSizeM2 == null ? null : Number(item.landSizeM2),
        buildingSizeM2: item.buildingSizeM2 == null ? null : Number(item.buildingSizeM2),
        relationship: String(
          item.relationship ?? "weak_comp",
        ) as SavedMarketEvidence["relationship"],
        confidence: String(item.confidence ?? "low") as SavedMarketEvidence["confidence"],
        includeInSummary: Boolean(item.includeInSummary),
        listingRole: item.listingRole
          ? (String(item.listingRole) as MarketEvidenceListingRole)
          : undefined,
        importedListing: importedListing
          ? {
              listingId: nullableString(importedListing.listingId),
              canonicalUrl: nullableString(importedListing.canonicalUrl),
              importedAt: nullableString(importedListing.importedAt),
              fetchedAt: nullableString(importedListing.fetchedAt),
              contentHash: nullableString(importedListing.contentHash),
              listingDate: nullableString(importedListing.listingDate),
              warnings: Array.isArray(importedListing.warnings)
                ? importedListing.warnings.map(String)
                : [],
              missingFields: Array.isArray(importedListing.missingFields)
                ? importedListing.missingFields.map(String)
                : [],
              matchStatus: nullableString(importedListing.matchStatus),
              matchReasons: Array.isArray(importedListing.matchReasons)
                ? importedListing.matchReasons.map(String)
                : [],
              userConfirmedAttachment: Boolean(importedListing.userConfirmedAttachment),
            }
          : null,
        notes: item.notes == null ? null : String(item.notes),
        savedAt: String(item.savedAt ?? new Date().toISOString()),
        updatedAt: String(item.updatedAt ?? item.savedAt ?? new Date().toISOString()),
      };
    })
    .filter((item) => item.sourceUrl);
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const parsed = String(value).trim();
  return parsed || null;
}

function parseCandidates(value: unknown): ListingCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      sourceType: (item.sourceType === "source_backed_seed"
        ? "source_backed_seed"
        : "manual_import") as ListingCandidate["sourceType"],
      sourcePortal: String(item.sourcePortal ?? "Other"),
      sourceUrl: String(item.sourceUrl ?? ""),
      title: String(item.title ?? "Imported listing candidate"),
      askingPrice: nullableNumber(item.askingPrice),
      propertyType: nullableString(item.propertyType),
      locationText: nullableString(item.locationText),
      microMarket: nullableString(item.microMarket),
      suburb: nullableString(item.suburb),
      town: nullableString(item.town),
      municipality: nullableString(item.municipality),
      province: nullableString(item.province),
      streetName: nullableString(item.streetName),
      descriptionText: nullableString(item.descriptionText),
      beds: nullableNumber(item.beds),
      baths: nullableNumber(item.baths),
      landSizeM2: nullableNumber(item.landSizeM2),
      buildingSizeM2: nullableNumber(item.buildingSizeM2),
      agencyName: nullableString(item.agencyName),
      imageUrl: nullableString(item.imageUrl),
      listingStatus: nullableString(item.listingStatus),
      fetchedAt: nullableString(item.fetchedAt),
      lastSeenAt: nullableString(item.lastSeenAt),
      importedAt: nullableString(item.importedAt),
      rawSourceArea: nullableString(item.rawSourceArea),
      lat: nullableNumber(item.lat),
      lng: nullableNumber(item.lng),
    }))
    .filter((item) => item.sourceUrl);
}

function parseDismissed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function parsePropertyIdentity(value: unknown): PropertyIdentityOverride | null {
  if (!isRecord(value)) return null;
  return {
    address: nullableString(value.address),
    streetName: nullableString(value.streetName),
    marketSuburb: nullableString(value.marketSuburb),
    note: nullableString(value.note),
    confirmedAt: nullableString(value.confirmedAt),
  };
}

function localMarketEvidenceKey(parcelId: string) {
  return `erfstoep.marketEvidence.${parcelId}`;
}

function readLocalUserData(parcelId: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(localMarketEvidenceKey(parcelId));
    const parsed = raw ? JSON.parse(raw) : null;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalUserData(parcelId: string, nextUserData: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localMarketEvidenceKey(parcelId), JSON.stringify(nextUserData));
}

function dispatchMarketEvidenceUpdated(parcelId: string, userData: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("erfstoep:market-evidence-updated", {
      detail: { parcelId, userData },
    }),
  );
}

function applyUserData(
  parcelId: string,
  nextUserData: Record<string, unknown>,
  setters: {
    setUserData: (value: Record<string, unknown>) => void;
    setEvidence: (value: SavedMarketEvidence[]) => void;
    setCandidates: (value: ListingCandidate[]) => void;
    setDismissedCandidateIds: (value: string[]) => void;
    setPropertyIdentity: (value: PropertyIdentityOverride | null) => void;
    setMarketAddressIntelligence: (value: MarketAddressIntelligence | null) => void;
  },
) {
  setters.setUserData(nextUserData);
  setters.setEvidence(parseEvidence(nextUserData.savedMarketEvidence, parcelId));
  setters.setCandidates(parseCandidates(nextUserData.marketEvidenceCandidates));
  setters.setDismissedCandidateIds(
    parseDismissed(nextUserData.dismissedMarketEvidenceCandidateIds),
  );
  setters.setPropertyIdentity(parsePropertyIdentity(nextUserData.propertyIdentity));
  setters.setMarketAddressIntelligence(
    parseMarketAddressIntelligence(nextUserData.marketAddressIntelligence),
  );
}

export function useSavedMarketEvidence(parcelId: string) {
  const { user } = useAuth();
  const [savedPropertyExists, setSavedPropertyExists] = useState(false);
  const [userData, setUserData] = useState<Record<string, unknown>>({});
  const [evidence, setEvidence] = useState<SavedMarketEvidence[]>([]);
  const [candidates, setCandidates] = useState<ListingCandidate[]>([]);
  const [dismissedCandidateIds, setDismissedCandidateIds] = useState<string[]>([]);
  const [propertyIdentity, setPropertyIdentity] = useState<PropertyIdentityOverride | null>(null);
  const [marketAddressIntelligence, setMarketAddressIntelligence] =
    useState<MarketAddressIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSavedPropertyExists(false);
    setEvidence([]);
    setCandidates([]);
    setDismissedCandidateIds([]);
    setPropertyIdentity(null);
    setMarketAddressIntelligence(null);
    setUserData({});
    const localUserData = readLocalUserData(parcelId);
    applyUserData(parcelId, localUserData, {
      setUserData,
      setEvidence,
      setCandidates,
      setDismissedCandidateIds,
      setPropertyIdentity,
      setMarketAddressIntelligence,
    });
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from("saved_properties")
      .select("user_data")
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const raw = isRecord(data?.user_data) ? data.user_data : localUserData;
        setSavedPropertyExists(Boolean(data));
        applyUserData(parcelId, raw, {
          setUserData,
          setEvidence,
          setCandidates,
          setDismissedCandidateIds,
          setPropertyIdentity,
          setMarketAddressIntelligence,
        });
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [parcelId, user]);

  useEffect(() => {
    function refresh(event: Event) {
      const detail = (event as CustomEvent<{ parcelId?: string; userData?: unknown }>).detail;
      if (detail?.parcelId !== parcelId || !isRecord(detail.userData)) return;
      applyUserData(parcelId, detail.userData, {
        setUserData,
        setEvidence,
        setCandidates,
        setDismissedCandidateIds,
        setPropertyIdentity,
        setMarketAddressIntelligence,
      });
    }
    window.addEventListener("erfstoep:market-evidence-updated", refresh);
    return () => window.removeEventListener("erfstoep:market-evidence-updated", refresh);
  }, [parcelId]);

  const canSave = true;

  async function persistUserData(nextUserData: Record<string, unknown>) {
    if (!user || !savedPropertyExists) {
      writeLocalUserData(parcelId, nextUserData);
      applyUserData(parcelId, nextUserData, {
        setUserData,
        setEvidence,
        setCandidates,
        setDismissedCandidateIds,
        setPropertyIdentity,
        setMarketAddressIntelligence,
      });
      dispatchMarketEvidenceUpdated(parcelId, nextUserData);
      toast.message("Saved locally for this erf. Save to My Erfs to keep it in your dashboard.");
      return true;
    }
    const { error } = await supabase
      .from("saved_properties")
      .update({ user_data: nextUserData as Record<string, unknown> as never })
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    writeLocalUserData(parcelId, nextUserData);
    applyUserData(parcelId, nextUserData, {
      setUserData,
      setEvidence,
      setCandidates,
      setDismissedCandidateIds,
      setPropertyIdentity,
      setMarketAddressIntelligence,
    });
    dispatchMarketEvidenceUpdated(parcelId, nextUserData);
    return true;
  }

  async function persist(next: SavedMarketEvidence[]) {
    const ok = await persistUserData({ ...userData, savedMarketEvidence: next });
    if (ok) {
      setEvidence(next);
    }
    return ok;
  }

  async function persistCandidates(next: ListingCandidate[]) {
    const ok = await persistUserData({ ...userData, marketEvidenceCandidates: next });
    if (ok) {
      setCandidates(next);
      toast.success("Listing candidate imported");
    }
    return ok;
  }

  async function persistDismissed(next: string[]) {
    const ok = await persistUserData({ ...userData, dismissedMarketEvidenceCandidateIds: next });
    if (ok) {
      setDismissedCandidateIds(next);
    }
    return ok;
  }

  async function upsertEvidence(
    item: Omit<SavedMarketEvidence, "id" | "parcelId" | "savedAt" | "updatedAt"> & {
      id?: string;
    },
  ) {
    const now = new Date().toISOString();
    const existing = evidence.find((entry) => entry.id === item.id);
    const nextItem: SavedMarketEvidence = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
      parcelId,
      savedAt: existing?.savedAt ?? now,
      updatedAt: now,
    };
    const next = existing
      ? evidence.map((entry) => (entry.id === nextItem.id ? nextItem : entry))
      : [nextItem, ...evidence];
    const ok = await persist(next);
    if (ok) toast.success(existing ? "Market evidence updated" : "Market evidence saved");
    return ok;
  }

  async function deleteEvidence(id: string) {
    const ok = await persist(evidence.filter((item) => item.id !== id));
    if (ok) toast.success("Market evidence deleted");
  }

  async function upsertCandidate(
    item: Omit<ListingCandidate, "id" | "sourceType" | "importedAt"> & {
      id?: string;
    },
  ) {
    const nextItem: ListingCandidate = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
      sourceType: "manual_import",
      importedAt: new Date().toISOString(),
    };
    const next = [nextItem, ...candidates.filter((candidate) => candidate.id !== nextItem.id)];
    await persistCandidates(next);
  }

  async function dismissCandidate(id: string) {
    if (dismissedCandidateIds.includes(id)) {
      return;
    }
    const ok = await persistDismissed([id, ...dismissedCandidateIds]);
    if (ok) toast.message("Candidate dismissed for this dossier");
  }

  async function savePropertyIdentity(nextIdentity: PropertyIdentityOverride) {
    const next = {
      ...nextIdentity,
      address: nextIdentity.address?.trim() || null,
      streetName: nextIdentity.streetName?.trim() || null,
      marketSuburb: nextIdentity.marketSuburb?.trim() || null,
      note: nextIdentity.note?.trim() || null,
    };
    const ok = await persistUserData({ ...userData, propertyIdentity: next });
    if (ok) toast.success("Property identity saved");
  }

  async function saveMarketAddressIntelligence(next: MarketAddressIntelligence) {
    const ok = await persistUserData({ ...userData, marketAddressIntelligence: next });
    if (ok) toast.success("Market address updated");
    return ok;
  }

  return {
    user,
    loading,
    savedPropertyExists,
    canSave,
    evidence,
    propertyIdentity,
    marketAddressIntelligence,
    candidates,
    dismissedCandidateIds,
    upsertEvidence,
    deleteEvidence,
    upsertCandidate,
    dismissCandidate,
    savePropertyIdentity,
    saveMarketAddressIntelligence,
  };
}
