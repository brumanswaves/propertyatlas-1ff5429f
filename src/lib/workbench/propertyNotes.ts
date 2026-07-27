import { supabase } from "@/integrations/supabase/client";

export interface PropertyNotes {
  parcelId: string;
  personal: string | null;
  pros: string | null;
  cons: string | null;
  questions: string | null;
  agentContact: string | null;
  municipality: string | null;
  renovation: string | null;
  checklist: Record<string, boolean>;
  createdAt: string | null;
  updatedAt: string | null;
}

export const EMPTY_PROPERTY_NOTES: PropertyNotes = {
  parcelId: "",
  personal: "",
  pros: "",
  cons: "",
  questions: "",
  agentContact: "",
  municipality: "",
  renovation: "",
  checklist: {},
  createdAt: null,
  updatedAt: null,
};

export function normalizePropertyNotes(
  parcelId: string,
  value: unknown,
): PropertyNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PROPERTY_NOTES, parcelId };
  }
  const raw = value as Record<string, unknown>;
  return {
    parcelId,
    personal: nullableString(raw.personal),
    pros: nullableString(raw.pros),
    cons: nullableString(raw.cons),
    questions: nullableString(raw.questions),
    agentContact: nullableString(raw.agent_contact ?? raw.agentContact),
    municipality: nullableString(raw.municipality),
    renovation: nullableString(raw.renovation),
    checklist: normalizeChecklist(raw.checklist),
    createdAt: nullableString(raw.created_at ?? raw.createdAt),
    updatedAt: nullableString(raw.updated_at ?? raw.updatedAt),
  };
}

export async function loadPropertyNotes(
  parcelId: string,
  userId: string | null | undefined,
  client = supabase,
): Promise<PropertyNotes | null> {
  if (!userId) return null;
  const { data, error } = await client
    .from("property_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .maybeSingle();
  if (error) throw error;
  const rowParcelId =
    data && typeof data === "object"
      ? nullableString((data as Record<string, unknown>).parcel_id ?? (data as Record<string, unknown>).parcelId)
      : "";
  if (rowParcelId && rowParcelId !== parcelId) return null;
  return data ? normalizePropertyNotes(parcelId, data) : null;
}

export type ReportPropertyNotesLoadResult =
  | { status: "signed_out"; notes: null }
  | { status: "loaded"; notes: PropertyNotes | null }
  | { status: "stale"; notes: null }
  | { status: "failed"; notes: null; error: unknown };

export async function loadReportPropertyNotes(
  parcelId: string,
  userId: string | null | undefined,
  isCurrentRequest: () => boolean,
  client = supabase,
): Promise<ReportPropertyNotesLoadResult> {
  if (!userId) return { status: "signed_out", notes: null };
  try {
    const notes = await loadPropertyNotes(parcelId, userId, client);
    if (!isCurrentRequest()) return { status: "stale", notes: null };
    return {
      status: "loaded",
      notes: notes?.parcelId === parcelId ? notes : null,
    };
  } catch (error) {
    if (!isCurrentRequest()) return { status: "stale", notes: null };
    return { status: "failed", notes: null, error };
  }
}

export function propertyNotesToRow(
  userId: string,
  notes: PropertyNotes,
) {
  return {
    user_id: userId,
    parcel_id: notes.parcelId,
    personal: notes.personal,
    pros: notes.pros,
    cons: notes.cons,
    questions: notes.questions,
    agent_contact: notes.agentContact,
    municipality: notes.municipality,
    renovation: notes.renovation,
    checklist: notes.checklist,
  };
}

function nullableString(value: unknown): string | null {
  if (value == null) return "";
  const text = String(value);
  return text;
}

function normalizeChecklist(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}
