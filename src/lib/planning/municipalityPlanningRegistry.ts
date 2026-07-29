import { KOUGA_PLANNING_REGISTRY } from "./kougaPlanningRegistry";
import type {
  LocalDesignGuideline,
  MunicipalityPlanningRegistryEntry,
  MunicipalityPlanningSource,
  PlanningSourceStatus,
  ZoneDefinition,
} from "./municipalityPlanningTypes";

const REGISTRY: MunicipalityPlanningRegistryEntry[] = [KOUGA_PLANNING_REGISTRY];

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function listMunicipalityPlanningRegistries(): MunicipalityPlanningRegistryEntry[] {
  return REGISTRY;
}

/** Matches free-text municipality values from parcel/address data. */
export function findMunicipalityPlanningRegistry(
  municipality: string | null | undefined,
): MunicipalityPlanningRegistryEntry | null {
  const needle = normalize(municipality);
  if (!needle) return null;
  for (const entry of REGISTRY) {
    if (normalize(entry.municipality) === needle) return entry;
    if (entry.municipalityAliases.some((alias) => needle.includes(normalize(alias)))) return entry;
  }
  return null;
}

/**
 * Matches a planning area (suburb/precinct) from any free-text location hints
 * available on the parcel. Returns the registry's canonical spelling.
 */
export function matchPlanningArea(
  entry: MunicipalityPlanningRegistryEntry,
  hints: Array<string | null | undefined>,
): string | null {
  const haystack = hints.map(normalize).filter(Boolean).join(" | ");
  if (!haystack) return null;
  const matches = entry.planningAreas.filter((area) => haystack.includes(normalize(area)));
  if (!matches.length) return null;
  // Prefer the most specific (longest) match, e.g. "St Francis Bay Canals"
  // over "St Francis Bay Village" when both partially appear.
  return matches.sort((a, b) => b.length - a.length)[0];
}

/** Sources that may be relied on as currently published rules. */
export function activePlanningSources(
  entry: MunicipalityPlanningRegistryEntry,
): MunicipalityPlanningSource[] {
  return entry.sources.filter((source) => source.status === "active");
}

export function planningSourcesByStatus(
  entry: MunicipalityPlanningRegistryEntry,
  status: PlanningSourceStatus,
): MunicipalityPlanningSource[] {
  return entry.sources.filter((source) => source.status === status);
}

/** Sources that must never be presented as enforceable law. */
export function nonEnforceablePlanningSources(
  entry: MunicipalityPlanningRegistryEntry,
): MunicipalityPlanningSource[] {
  return entry.sources.filter(
    (source) =>
      source.status === "draft" ||
      source.status === "pending" ||
      source.status === "manual_candidate" ||
      source.status === "unknown",
  );
}

export function planningSourcesFor(
  entry: MunicipalityPlanningRegistryEntry,
  planningArea: string | null,
): MunicipalityPlanningSource[] {
  return entry.sources.filter(
    (source) =>
      source.status !== "superseded" &&
      (source.planningAreas.length === 0 ||
        (planningArea != null && source.planningAreas.includes(planningArea))),
  );
}

export function findPlanningSource(
  entry: MunicipalityPlanningRegistryEntry,
  sourceId: string,
): MunicipalityPlanningSource | null {
  return entry.sources.find((source) => source.id === sourceId) ?? null;
}

export function listZones(entry: MunicipalityPlanningRegistryEntry): ZoneDefinition[] {
  return entry.zones;
}

export function findZone(
  entry: MunicipalityPlanningRegistryEntry,
  zoneCode: string | null | undefined,
): ZoneDefinition | null {
  const needle = normalize(zoneCode).replace(/[^a-z0-9]/g, "");
  if (!needle) return null;
  return (
    entry.zones.find((zone) => normalize(zone.code).replace(/[^a-z0-9]/g, "") === needle) ?? null
  );
}

export function guidelinesForPlanningArea(
  entry: MunicipalityPlanningRegistryEntry,
  planningArea: string | null,
): LocalDesignGuideline[] {
  return entry.guidelines.filter(
    (guideline) =>
      guideline.planningAreas.length === 0 ||
      (planningArea != null && guideline.planningAreas.includes(planningArea)),
  );
}

/**
 * A zoning polygon lookup is only attempted when a registry adapter exists AND
 * has been verified. Everything else must fall back to manual selection.
 */
export function canAttemptOfficialZoningDetection(
  entry: MunicipalityPlanningRegistryEntry | null,
): boolean {
  return Boolean(entry?.zoningPolygonAdapter?.verified);
}
