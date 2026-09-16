import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";

export interface PropertyJourneyLocation {
  userId: string | null;
  selection: OfficialFeatureSelection | null;
  parcelId: string | null;
  tab: string;
  stepId: string | null;
  guidedReturnStepId?: "strategy" | "site-potential" | null;
}

export function readPropertyJourneyLocation(userId: string | null): PropertyJourneyLocation | null {
  if (typeof window === "undefined") return null;
  const value = window.history.state?.easyErfJourney as PropertyJourneyLocation | undefined;
  return value && value.userId === userId && typeof value.tab === "string" ? value : null;
}

/** Navigation metadata only. No evidence, drafts or credentials enter browser history. */
export function writePropertyJourneyLocation(location: PropertyJourneyLocation, replace = false) {
  if (typeof window === "undefined") return;
  const current = readPropertyJourneyLocation(location.userId);
  if (JSON.stringify(current) === JSON.stringify(location)) return;
  if (!current && !replace) {
    window.history.replaceState({ ...window.history.state, easyErfJourney: {
      userId: location.userId, selection: null, parcelId: null, tab: "overview", stepId: null,
    } }, "");
  }
  const state = { ...window.history.state, easyErfJourney: location };
  if (replace) window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}
