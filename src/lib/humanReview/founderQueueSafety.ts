const ORDER_HASH_PREFIX = "#order-";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FounderQueueOrderIdentity = {
  id: string;
  review_focus?: string | null;
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
  return !order.review_focus?.trim();
}

export function reportOrderMode(payload: unknown): "LIVE" | "TEST" {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "TEST";
  const value = (payload as Record<string, unknown>).livemode;
  return value === true || value === "true" ? "LIVE" : "TEST";
}
