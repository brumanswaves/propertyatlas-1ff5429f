import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { orderInvestigationSchema, investigationSnapshotSchema } from "./sharedInvestigation";
import { coerceWorkspaceState, readErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch, flushSavedInvestigation } from "@/lib/workbench/savedInvestigationProjection";
import { isSavedPropertyUserData, patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { toSupabaseJson } from "@/lib/supabase/json";

type Rpc<A> = { Args: A; Returns: Json };
type InvestigationDatabase = Omit<Database, "public"> & { public: Omit<Database["public"], "Functions"> & {
  Functions: Database["public"]["Functions"] & {
    read_order_investigation: Rpc<{ p_order_id: string }>;
    patch_order_investigation: Rpc<{ p_order_id: string; p_expected_revision: number; p_patch: Json }>;
    read_customer_investigation: Rpc<{ p_parcel_id: string }>;
    read_investigation_review: Rpc<{ p_order_id: string; p_version_id?: string }>;
    edit_investigation_brief: Rpc<{ p_order_id: string; p_version_id: string; p_expected_brief_revision: number; p_brief: Json }>;
    list_assigned_investigation_queue: Rpc<Record<string, never>>;
    read_assigned_investigation_header: Rpc<{ p_order_id: string }>;
    assign_order_investigator: Rpc<{ p_order_id: string; p_worker_id: string; p_can_approve: boolean; p_revoke: boolean }>;
    change_order_investigation_asset: Rpc<{ p_order_id: string; p_asset_id: string; p_expected_revision: number; p_action: "archive" | "confirm_identity" }>;
  };
}};

// This only extends generated RPC signatures for the pending migration. Auth stays on the existing client.
export const investigationClient = supabase as unknown as SupabaseClient<InvestigationDatabase>;
export async function prepareCustomerInvestigation(
  userId: string, parcel: NormalizedOfficialParcel, parcelRing: Array<[number, number]> | null,
) {
  async function assertAccount() {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) throw new Error("The active account changed. No payment was started.");
  }
  await assertAccount();
  const { data, error } = await supabase.from("saved_properties").select("user_data")
    .eq("user_id", userId).eq("parcel_id", parcel.id).maybeSingle();
  if (error) throw new Error("Your property file could not be checked. No payment was started.");
  const existing = isSavedPropertyUserData(data?.user_data) ? data.user_data : {};
  await assertAccount();
  const stored = await patchSavedPropertyUserData(parcel.id, {
    normalizedParcel: parcel, parcelRing,
    ...(!data ? buildSavedInvestigationUserDataPatch(parcel.id, readErfWorkspaceState(parcel.id, undefined, userId)) : {}),
  }, supabase, existing);
  await assertAccount();
  await flushSavedInvestigation(parcel.id, userId, !data ? stored : undefined);
}
export function requireInvestigationResult<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error?.code === "40001") throw new Error("This investigation changed. Reload before saving; your changes were not applied.");
  if (result.error) throw new Error("This investigation is unavailable. Check your assignment and reload.");
  return result.data;
}

export async function readOrderInvestigation(orderId: string, signal: AbortSignal) {
  const data = requireInvestigationResult(await investigationClient.rpc("read_order_investigation", { p_order_id: orderId }).abortSignal(signal));
  const scope = orderInvestigationSchema.parse(data);
  if (scope.orderId !== orderId) throw new Error("The returned investigation does not match the selected order.");
  return scope;
}
export async function readCustomerInvestigation(parcelId: string, signal: AbortSignal) {
  const data = requireInvestigationResult(await investigationClient.rpc("read_customer_investigation", { p_parcel_id: parcelId }).abortSignal(signal));
  const snapshot = investigationSnapshotSchema.parse(data);
  if (snapshot.parcelId !== parcelId) throw new Error("The returned investigation does not match the property.");
  return snapshot;
}
export async function patchOrderInvestigation(orderId: string, revision: number, patch: Json, signal: AbortSignal) {
  const data = requireInvestigationResult(await investigationClient.rpc("patch_order_investigation", {
    p_order_id: orderId, p_expected_revision: revision, p_patch: patch,
  }).abortSignal(signal));
  const scope = orderInvestigationSchema.parse(data);
  if (scope.orderId !== orderId) throw new Error("The saved investigation does not match the selected order.");
  return scope;
}

export function normalizeInvestigationPatch(parcelId: string, patch: Json): Json {
  const record = z.record(z.unknown()).parse(patch);
  if (!Object.hasOwn(record, "easyErfInvestigation")) return patch;
  const workspace = coerceWorkspaceState(record.easyErfInvestigation);
  return toSupabaseJson({ ...record, ...buildSavedInvestigationUserDataPatch(parcelId,
    { ...workspace, updatedAt: new Date().toISOString() }) });
}
export async function requestInvestigationReview(input: {
  action: "generate" | "approve" | "ask"; orderId: string; versionId?: string; briefRevision?: number; question?: string;
}, signal: AbortSignal): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to continue.");
  const response = await fetch("/api/investigations/review", { method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(input) });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(payload);
    throw new Error(error.success ? error.data.error : "The review request could not be completed.");
  }
  return payload;
}

export async function readInvestigationAsset(input: { orderId: string; assetId: string; versionId?: string; preview?: boolean }, signal: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to open the document.");
  const response = await fetch("/api/investigations/asset", { method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("This document is unavailable for this investigation.");
  return response.blob();
}

export async function uploadInvestigationAsset(input: { orderId: string; revision: number; category: string; assetType: string; sourceLabel: string; file: Blob; fileName: string; aiProcessingAllowed: boolean; redistributionAllowed: boolean }, signal: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to upload the document.");
  const form = new FormData();
  form.set("orderId", input.orderId); form.set("revision", String(input.revision)); form.set("category", input.category);
  form.set("assetType", input.assetType); form.set("sourceLabel", input.sourceLabel);
  form.set("file", input.file, input.fileName); form.set("aiProcessingAllowed", String(input.aiProcessingAllowed)); form.set("redistributionAllowed", String(input.redistributionAllowed));
  const response = await fetch("/api/investigations/upload", { method: "POST", signal, headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error : "The document could not be uploaded.");
  }
  return z.object({ ok: z.literal(true), assetId: z.string().uuid() }).parse(payload);
}
