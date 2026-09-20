import { describe, expect, it } from "vitest";
import { pricingReturnPath, restorePricingSignInDraft, savePricingSignInDraft, type PricingSignInDraft } from "../signInHandoff";
import { safeReturnPath } from "@/lib/navigation";

const id = "d842cf05-45bd-4a3c-932c-cce35f497621";
const draft: PricingSignInDraft = { parcelId: "csg:lpi:fixture42", ownerId: null, focus: "intended_use", intendedUse: "second_dwelling", context: "Could I add a second dwelling?" };
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe("pricing sign-in handoff", () => {
  it("returns through the existing safe auth route to the exact erf without private answers or arbitrary redirects", () => {
    const path = pricingReturnPath("?parcelId=csg%3Alpi%3Afixture42&propertyReference=Erf+42&source=report&context=private&redirect=https://evil.invalid", id);
    expect(safeReturnPath(path)).toBe(path);
    const query = new URL(path, "https://easyerf.invalid").searchParams;
    expect(query.get("parcelId")).toBe(draft.parcelId);
    expect(query.get("source")).toBe("report");
    expect(query.get("handoffDraft")).toBe(id);
    expect(query.has("context")).toBe(false);
    expect(query.has("redirect")).toBe(false);
    expect(pricingReturnPath("?context=private")).toBe("/pricing");
  });
  it("restores an explicitly handed-off guest brief once after sign-in without carrying consent", () => {
    const store = storage(); store.setItem("unrelated", "keep");
    savePricingSignInDraft(store, id, { ...draft, scopeAcknowledged: true } as PricingSignInDraft, 100);
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-a", 101)).toEqual({ ...draft, ownerId: "owner-a" });
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-a", 102)).toBeNull();
    expect(store.getItem("unrelated")).toBe("keep");
  });
  it("never restores another account's or parcel's answers and preserves them for the right owner", () => {
    const store = storage(); savePricingSignInDraft(store, id, { ...draft, ownerId: "owner-a" }, 100);
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-b", 101)).toBeNull();
    expect(restorePricingSignInDraft(store, id, "different-parcel", "owner-a", 101)).toBeNull();
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-a", 101)?.context).toBe(draft.context);
  });
  it.each([-1, 30 * 60 * 1000 + 1])("does not revive a future or expired brief (%i)", (age) => {
    const store = storage(); savePricingSignInDraft(store, id, draft, 100);
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-a", 100 + age)).toBeNull();
  });
  it("handles unavailable or malformed storage without changing other data", () => {
    const store = storage(); store.setItem(`easy-erf:pricing-signin:${id}`, "invalid-json");
    expect(restorePricingSignInDraft(store, id, draft.parcelId, "owner-a")).toBeNull();
    expect(() => savePricingSignInDraft({ ...store, setItem: () => { throw new Error("Storage unavailable"); } }, id, draft)).toThrow("Storage unavailable");
    expect(restorePricingSignInDraft({ ...store, getItem: () => { throw new Error("Storage unavailable"); } }, id, draft.parcelId, "owner-a")).toBeNull();
  });
});
