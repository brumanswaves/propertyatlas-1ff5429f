import {
  HUMAN_REVIEW_CONTEXT_MAX_LENGTH,
  HUMAN_REVIEW_FOCUS_OPTIONS,
  HUMAN_REVIEW_INTENDED_USE_OPTIONS,
  type HumanReviewFocus,
  type HumanReviewIntendedUse,
} from "./scope";

const PREFIX = "easy-erf:pricing-signin:";
const MAX_AGE_MS = 30 * 60 * 1000;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type PricingSignInDraft = {
  parcelId: string;
  ownerId: string | null;
  focus: HumanReviewFocus | null;
  intendedUse: HumanReviewIntendedUse | null;
  context: string;
};

/** Only selection context enters the URL. Questions and consent never do. */
export function pricingReturnPath(search: string, draftId?: string): string {
  const incoming = new URLSearchParams(search);
  const selected = new URLSearchParams();
  for (const key of ["parcelId", "propertyReference", "source"]) {
    const value = incoming.get(key)?.trim();
    if (value) selected.set(key, value);
  }
  if (draftId) selected.set("handoffDraft", draftId);
  return `/pricing${selected.size ? `?${selected}` : ""}`;
}

export function savePricingSignInDraft(storage: DraftStorage, id: string, draft: PricingSignInDraft, now = Date.now()) {
  // A fresh identifier makes this an explicit same-tab sign-in handoff, not a
  // global anonymous draft that a later unrelated visitor silently inherits.
  const { parcelId, ownerId, focus, intendedUse, context } = draft;
  storage.setItem(`${PREFIX}${id}`, JSON.stringify({ parcelId, ownerId, focus, intendedUse, context, savedAt: now }));
}

export function restorePricingSignInDraft(storage: DraftStorage, id: string, parcelId: string, ownerId: string, now = Date.now()): PricingSignInDraft | null {
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id) || !ownerId) return null;
  const key = `${PREFIX}${id}`;
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    if (!value || value.parcelId !== parcelId ||
      !(value.ownerId === null || value.ownerId === ownerId) ||
      typeof value.savedAt !== "number" || now < value.savedAt || now - value.savedAt > MAX_AGE_MS ||
      !(value.focus === null || HUMAN_REVIEW_FOCUS_OPTIONS.some((item) => item.id === value.focus)) ||
      !(value.intendedUse === null || HUMAN_REVIEW_INTENDED_USE_OPTIONS.some((item) => item.id === value.intendedUse)) ||
      typeof value.context !== "string" || value.context.length > HUMAN_REVIEW_CONTEXT_MAX_LENGTH) return null;
    // Do not restore scope acknowledgement or initiate checkout after login.
    const draft: PricingSignInDraft = { parcelId, ownerId, focus: value.focus,
      intendedUse: value.focus === "intended_use" ? value.intendedUse : null, context: value.context };
    storage.removeItem(key);
    return draft;
  } catch { return null; }
}
