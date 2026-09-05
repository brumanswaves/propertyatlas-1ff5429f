import { isOfficialParcelId } from "@/lib/parcels/officialParcelId";
import { parseHumanReviewReportContent } from "./reportContent";

const ORDER_HASH_PREFIX = "#order-";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FounderQueueOrderIdentity = {
  id: string;
  status?: string | null;
  status_enum?: string | null;
  review_focus?: string | null;
  parcel_id?: string | null;
  review_content?: unknown;
  payload?: unknown;
};

export function parseFocusedOrderId(hash: string): string | null {
  if (!hash.startsWith(ORDER_HASH_PREFIX)) return null;
  const value = hash.slice(ORDER_HASH_PREFIX.length).trim();
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function buildFocusedOrderHash(orderId: string): string {
  if (!UUID_PATTERN.test(orderId)) {
    throw new Error("A valid report order ID is required.");
  }
  return `${ORDER_HASH_PREFIX}${orderId.toLowerCase()}`;
}

export function isLegacyFounderOrder(order: FounderQueueOrderIdentity): boolean {
  return founderOrderReviewReasons(order).length > 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function founderOrderLifecycle(order: FounderQueueOrderIdentity): string {
  const value = (order.status_enum || order.status || "").trim().toLowerCase();
  if (value === "fulfilling") return "processing";
  if (value === "complete" || value === "completed" || value === "delivered") return "ready";
  return value;
}

function requiresDeliveredReportContent(order: FounderQueueOrderIdentity): boolean {
  return founderOrderLifecycle(order) === "ready";
}

export function founderOrderReviewReasons(order: FounderQueueOrderIdentity): string[] {
  const property = record(order.payload)?.propertyReference;
  const reasons: string[] = [];
  if (!isOfficialParcelId(order.parcel_id)) reasons.push("Canonical parcel missing");
  if (typeof property !== "string" || !/[a-z]/i.test(property) || !property.trim()) {
    reasons.push("Property reference incomplete");
  }
  if (!order.review_focus?.trim()) reasons.push("Structured investigation scope missing");
  if (
    requiresDeliveredReportContent(order)
    && !parseHumanReviewReportContent(order.review_content)
  ) {
    reasons.push("Delivered structured report content missing");
  }
  if (reportOrderMode(order.payload) === "UNKNOWN") reasons.push("Payment mode unavailable");
  return reasons;
}

export function reportOrderMode(payload: unknown): "LIVE" | "TEST" | "UNKNOWN" {
  const value = record(payload)?.livemode;
  if (value === true || value === "true") return "LIVE";
  if (value === false || value === "false") return "TEST";
  return "UNKNOWN";
}

export function founderDeliveryResult(notification: unknown): { success: boolean; message: string } {
  const value = record(notification);
  const receipt = record(value?.receipt);
  if (value?.ok === true && value.alreadySent === true) {
    return { success: true, message: "Report delivered; customer email already recorded as sent." };
  }
  if (value?.ok === true && receipt?.status === "sent") {
    return { success: true, message: "Report delivered and customer email recorded as sent." };
  }
  if (value?.ok === true && value.emailAccepted === true) {
    return { success: true, message: "Report delivered and customer email accepted." };
  }
  if (typeof value?.code === "string" && /DISABLED|NOT_CONFIGURED/.test(value.code)) {
    return { success: false, message: "Report delivered, but the customer email service is disabled or unavailable. No email was sent." };
  }
  return { success: false, message: "Report delivered, but customer email failed or was not confirmed. Review the notification receipt and retry for this order." };
}
