// Provider registry. The frontend should ALWAYS go through `getActiveProvider()`
// rather than importing a specific provider module. Swapping providers is a
// localStorage change (admin-only switch in the dashboard).

import type { PropertyProvider } from "./PropertyProvider";
import type { ProviderId } from "./types";
import { demoProvider } from "./demo";
import {
  lightstoneProvider,
  municipalGisProvider,
  surveyorGeneralProvider,
  winDeedProvider,
} from "./stubs";

const REGISTRY: Record<ProviderId, PropertyProvider> = {
  demo: demoProvider,
  "surveyor-general": surveyorGeneralProvider,
  "municipal-gis": municipalGisProvider,
  windeed: winDeedProvider,
  lightstone: lightstoneProvider,
};

const STORAGE_KEY = "pa.activeProvider";

export function listProviders(): PropertyProvider[] {
  return Object.values(REGISTRY);
}

export function getProvider(id: ProviderId): PropertyProvider {
  return REGISTRY[id] ?? demoProvider;
}

export function getActiveProviderId(): ProviderId {
  if (typeof window === "undefined") return "demo";
  const stored = window.localStorage.getItem(STORAGE_KEY) as ProviderId | null;
  return stored && stored in REGISTRY ? stored : "demo";
}

export function setActiveProviderId(id: ProviderId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent("pa:provider-change", { detail: id }));
}

export function getActiveProvider(): PropertyProvider {
  return getProvider(getActiveProviderId());
}
