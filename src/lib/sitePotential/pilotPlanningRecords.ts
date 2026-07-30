/**
 * Property-specific pilot planning records.
 *
 * These are hand-captured prototype control sets for a very small number of
 * canonical pilot parcels. They exist so the Site Potential result is usable
 * on a reference erf while automatic zoning detection is still unavailable.
 *
 * Honesty rules:
 *  - A pilot record is ALWAYS user-supplied prototype data. It can never make
 *    the envelope "Verified" and it never claims a zoning document supplied
 *    the numbers.
 *  - A record only ever applies to the exact canonical parcel it is keyed to.
 *    Matching is by canonical parcel id or LPI code, never by erf number
 *    alone, so "Erf 1570" in another township can never inherit it.
 */

export interface PilotPlanningRecord {
  /** Canonical parcel ids this record may be applied to. */
  parcelIds: string[];
  /** Canonical LPI codes this record may be applied to. */
  lpiCodes: string[];
  label: string;
  zoneLabel: string;
  /** Official recorded extent, when the pilot brief states one. */
  siteAreaM2: number | null;
  streetSetbackM: number;
  sideSetbackM: number;
  rearSetbackM: number;
  maxCoveragePercent: number;
  maxHeightM: number;
  dwellingUnits: number;
  additionalDwellingRule: string;
  additionalDwellingRequiresConsent: boolean;
  streetName: string | null;
  /**
   * Known street frontage length range in metres. Used to select the correct
   * street-facing boundary from real cadastral geometry instead of guessing.
   */
  streetFrontageLengthRangeM: [number, number] | null;
  /** Visible provenance wording. Never upgraded to verified. */
  provenanceLabel: string;
}

function normaliseKey(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Erf 1570, Padrone Crescent, St Francis Bay (Kouga). Prototype record. */
const ERF_1570_ST_FRANCIS_BAY: PilotPlanningRecord = {
  parcelIds: ["csg:lpi:C03400140000157000000"],
  lpiCodes: ["C03400140000157000000"],
  label: "Erf 1570, St Francis Bay",
  zoneLabel: "Residential 1",
  siteAreaM2: 619,
  streetSetbackM: 3,
  sideSetbackM: 1.5,
  rearSetbackM: 1.5,
  maxCoveragePercent: 50,
  maxHeightM: 8.5,
  dwellingUnits: 1,
  additionalDwellingRule: "One additional dwelling",
  additionalDwellingRequiresConsent: true,
  streetName: "Padrone Crescent",
  streetFrontageLengthRangeM: [17, 18.6],
  provenanceLabel:
    "User-supplied prototype control set for this erf. Estimated, not confirmed with the municipality.",
};

const PILOT_PLANNING_RECORDS: PilotPlanningRecord[] = [ERF_1570_ST_FRANCIS_BAY];

export interface PilotPlanningLookup {
  parcelId: string | null | undefined;
  lpiCode?: string | null;
}

/** Returns the pilot record for this exact parcel, or null. Never fuzzy. */
export function findPilotPlanningRecord({
  parcelId,
  lpiCode,
}: PilotPlanningLookup): PilotPlanningRecord | null {
  const idKey = normaliseKey(parcelId);
  const lpiKey = normaliseKey(lpiCode);
  const parcelLpiKey = normaliseKey(
    typeof parcelId === "string" && parcelId.includes(":")
      ? parcelId.slice(parcelId.lastIndexOf(":") + 1)
      : null,
  );

  for (const record of PILOT_PLANNING_RECORDS) {
    const ids = record.parcelIds.map(normaliseKey);
    const lpis = record.lpiCodes.map(normaliseKey);
    if (idKey && ids.includes(idKey)) return record;
    if (lpiKey && lpis.includes(lpiKey)) return record;
    if (parcelLpiKey && lpis.includes(parcelLpiKey)) return record;
  }
  return null;
}
