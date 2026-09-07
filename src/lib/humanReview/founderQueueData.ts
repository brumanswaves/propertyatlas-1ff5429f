import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isOfficialParcelId } from "@/lib/parcels/officialParcelId";
import { parseFocusedOrderId } from "./founderQueueSafety";

export type FounderQueueSummary = {
  id: string;
  parcel_id: string | null;
  report_type: string;
  status: string;
  status_enum: string | null;
  provider: string;
  price_cents: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  payment_mode: "LIVE" | "TEST" | "UNKNOWN";
  has_property_reference: boolean;
  has_review_focus: boolean;
  has_report_content: boolean;
};

export type FounderOrderDetail = {
  id: string;
  user_id: string | null;
  parcel_id: string | null;
  report_type: string;
  status: string;
  status_enum: string | null;
  provider: string;
  payload: unknown;
  price_cents: number;
  pdf_storage_path: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  review_focus: string | null;
  intended_use: string | null;
  review_context: string | null;
  review_content: unknown;
  review_content_updated_at: string | null;
};

// Narrow schema extension for the migration in this release. The existing
// client, auth session and RLS are reused; no privileged client is constructed.
type QueueDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      list_easy_erf_founder_queue: {
        Args: { p_limit?: number };
        Returns: FounderQueueSummary[];
      };
    };
  };
};

const SUMMARY_KEYS = [
  "id", "parcel_id", "report_type", "status", "status_enum", "provider",
  "price_cents", "created_at", "updated_at", "completed_at", "payment_mode",
  "has_property_reference", "has_review_focus", "has_report_content",
] as const;

export function isFullFounderOrderId(value: string): boolean {
  return parseFocusedOrderId(`#order-${value}`) === value.toLowerCase();
}

export function parseFounderQueueSummaries(value: unknown): FounderQueueSummary[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid queue response");
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid queue row");
    }
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).length !== SUMMARY_KEYS.length ||
        Object.keys(row).some((key) => !(SUMMARY_KEYS as readonly string[]).includes(key))) {
      throw new Error("Queue response contains unexpected fields");
    }
    for (const key of ["id", "report_type", "status", "provider", "created_at", "updated_at"] as const) {
      if (typeof row[key] !== "string") throw new Error("Invalid queue metadata");
    }
    for (const key of ["parcel_id", "status_enum", "completed_at"] as const) {
      if (row[key] !== null && typeof row[key] !== "string") throw new Error("Invalid queue metadata");
    }
    for (const key of ["has_property_reference", "has_review_focus", "has_report_content"] as const) {
      if (typeof row[key] !== "boolean") throw new Error("Invalid queue flags");
    }
    if (!isFullFounderOrderId(row.id as string) || row.provider !== "stripe" ||
        !Number.isInteger(row.price_cents) ||
        !["LIVE", "TEST", "UNKNOWN"].includes(row.payment_mode as string)) {
      throw new Error("Invalid queue identity");
    }
    const id = (row.id as string).toLowerCase();
    if (ids.has(id)) throw new Error("Duplicate queue identity");
    ids.add(id);
    return { ...row, id } as FounderQueueSummary;
  });
}

export function founderQueueSummaryReviewReasons(order: FounderQueueSummary): string[] {
  const reasons: string[] = [];
  if (!isOfficialParcelId(order.parcel_id)) reasons.push("Canonical parcel missing");
  if (!order.has_property_reference) reasons.push("Property reference incomplete");
  if (!order.has_review_focus) reasons.push("Structured investigation scope missing");
  const status = (order.status_enum || order.status).trim().toLowerCase();
  if (["ready", "complete", "completed", "delivered"].includes(status) && !order.has_report_content) {
    reasons.push("Delivered structured report content missing");
  }
  if (order.payment_mode === "UNKNOWN") reasons.push("Payment mode unavailable");
  return reasons;
}

export function isLegacyFounderSummary(order: FounderQueueSummary): boolean {
  return founderQueueSummaryReviewReasons(order).length > 0;
}

export const FOUNDER_DETAIL_COLUMNS =
  "id,user_id,parcel_id,report_type,status,status_enum,provider,payload,price_cents,pdf_storage_path,failure_reason,created_at,updated_at,completed_at,review_focus,intended_use,review_context,review_content,review_content_updated_at";

export async function readFounderQueue(client: SupabaseClient<Database>, signal: AbortSignal) {
  const queueClient = client as unknown as SupabaseClient<QueueDatabase>;
  const { data, error } = await queueClient.rpc("list_easy_erf_founder_queue", { p_limit: 100 }).abortSignal(signal);
  if (error) throw new Error("Could not load the investigation queue");
  return parseFounderQueueSummaries(data);
}

export async function readFounderOrder(client: SupabaseClient<Database>, id: string, signal: AbortSignal): Promise<FounderOrderDetail | null> {
  if (!isFullFounderOrderId(id)) throw new Error("A complete order UUID is required");
  const expectedId = id.toLowerCase();
  const { data, error } = await client.from("report_orders")
    .select(FOUNDER_DETAIL_COLUMNS)
    .eq("id", expectedId)
    .eq("provider", "stripe")
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw new Error("Could not load the exact investigation");
  if (!data) return null;
  if (data.id.toLowerCase() !== expectedId || data.provider !== "stripe") {
    throw new Error("The returned investigation did not match the selected order");
  }
  return data as FounderOrderDetail;
}
