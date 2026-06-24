import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import type { SavedMarketEvidence } from "../types";

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

export function useSavedMarketEvidence(parcelId: string) {
  const { user } = useAuth();
  const [savedPropertyExists, setSavedPropertyExists] = useState(false);
  const [userData, setUserData] = useState<Record<string, unknown>>({});
  const [evidence, setEvidence] = useState<SavedMarketEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSavedPropertyExists(false);
    setEvidence([]);
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
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [parcelId, user]);

  const canSave = Boolean(user && savedPropertyExists);

  async function persist(next: SavedMarketEvidence[]) {
    if (!user || !savedPropertyExists) {
      toast.message("Save this property first to store market evidence.");
      return false;
    }
    const nextUserData = { ...userData, savedMarketEvidence: next };
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
    setEvidence(next);
    return true;
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

  return {
    user,
    loading,
    savedPropertyExists,
    canSave,
    evidence,
    upsertEvidence,
    deleteEvidence,
  };
}
