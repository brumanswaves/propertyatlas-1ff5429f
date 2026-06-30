import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { parseMarketAddressIntelligence } from "../addressIntelligence";
import type { PropertyIdentityOverride } from "../propertyIdentity";
import type { ListingCandidate, MarketAddressIntelligence, SavedMarketEvidence } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseEvidence(value: unknown, parcelId: string): SavedMarketEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      parcelId: String(item.parcelId ?? parcelId),
      sourceUrl: String(item.sourceUrl ?? ""),
      sourcePortal: String(item.sourcePortal ?? "Other"),
      title: String(item.title ?? ""),
      askingPrice: item.askingPrice == null ? null : Number(item.askingPrice),
      propertyType: item.propertyType == null ? null : String(item.propertyType),
      beds: item.beds == null ? null : Number(item.beds),
      baths: item.baths == null ? null : Number(item.baths),
      landSizeM2: item.landSizeM2 == null ? null : Number(item.landSizeM2),
      buildingSizeM2: item.buildingSizeM2 == null ? null : Number(item.buildingSizeM2),
      relationship: String(item.relationship ?? "weak_comp") as SavedMarketEvidence["relationship"],
      confidence: String(item.confidence ?? "low") as SavedMarketEvidence["confidence"],
      includeInSummary: Boolean(item.includeInSummary),
      notes: item.notes == null ? null : String(item.notes),
      savedAt: String(item.savedAt ?? new Date().toISOString()),
      updatedAt: String(item.updatedAt ?? item.savedAt ?? new Date().toISOString()),
    }))
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
      sourceType: item.sourceType === "source_backed_seed" ? "source_backed_seed" : "manual_import",
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
        const raw = isRecord(data?.user_data) ? data.user_data : {};
        setSavedPropertyExists(Boolean(data));
        setUserData(raw);
        setEvidence(parseEvidence(raw.savedMarketEvidence, parcelId));
        setCandidates(parseCandidates(raw.marketEvidenceCandidates));
        setDismissedCandidateIds(parseDismissed(raw.dismissedMarketEvidenceCandidateIds));
        setPropertyIdentity(parsePropertyIdentity(raw.propertyIdentity));
        setMarketAddressIntelligence(parseMarketAddressIntelligence(raw.marketAddressIntelligence));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [parcelId, user]);

  const canSave = Boolean(user && savedPropertyExists);

  async function persistUserData(nextUserData: Record<string, unknown>) {
    if (!user || !savedPropertyExists) {
      toast.message("Save this property first to store market evidence.");
      return false;
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
    setUserData(nextUserData);
    setEvidence(parseEvidence(nextUserData.savedMarketEvidence, parcelId));
    setCandidates(parseCandidates(nextUserData.marketEvidenceCandidates));
    setDismissedCandidateIds(parseDismissed(nextUserData.dismissedMarketEvidenceCandidateIds));
    setPropertyIdentity(parsePropertyIdentity(nextUserData.propertyIdentity));
    setMarketAddressIntelligence(
      parseMarketAddressIntelligence(nextUserData.marketAddressIntelligence),
    );
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
