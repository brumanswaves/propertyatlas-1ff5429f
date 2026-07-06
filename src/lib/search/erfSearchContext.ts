import {
  SA_DEEDS_OFFICES,
  suggestedDeedsOfficeForProvince,
} from "@/lib/search/deedsOfficeRegistry";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";

export interface ErfSearchContext {
  deedsOfficeOptions: string[];
  townshipOptions: string[];
  municipalityOptions: string[];
  provinceOptions: string[];
  registryLabelOptions: string[];
  suggestedDeedsOffice?: string;
  suggestedTownship?: string;
  currentAreaLabel: string;
  loadedAreaTerms: string[];
}

function cleanLabel(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^(eastern|western|northern|kwazulu)$/i.test(text)) return undefined;
  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bSg\b/g, "SG")
    .replace(/\bCsg\b/g, "CSG");
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map(cleanLabel).filter((v): v is string => Boolean(v)))).sort(
    (a, b) => a.localeCompare(b),
  );
}

function rankedLabels(values: Array<string | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = cleanLabel(value);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a, aCount], [b, bCount]) => {
      const preferredA = /sea vista|st francis|cape st francis|kouga|santareme/i.test(a) ? 1 : 0;
      const preferredB = /sea vista|st francis|cape st francis|kouga|santareme/i.test(b) ? 1 : 0;
      if (preferredB !== preferredA) return preferredB - preferredA;
      if (bCount !== aCount) return bCount - aCount;
      return a.localeCompare(b);
    })
    .map(([label]) => label);
}

function isRegistryOnlyLabel(value: string | undefined): boolean {
  return Boolean(value && /humansdorp/i.test(value));
}

export function deriveErfSearchContext(parcels: IndexedOfficialParcel[]): ErfSearchContext {
  const rankedTownships = rankedLabels(parcels.map((parcel) => parcel.town));
  const townshipOptions = rankedTownships.filter((label) => !isRegistryOnlyLabel(label));
  const registryLabelOptions = rankedTownships.filter(isRegistryOnlyLabel);
  const municipalityOptions = rankedLabels(parcels.map((parcel) => parcel.municipality));
  const provinceOptions = rankedLabels(parcels.map((parcel) => parcel.province));
  const suggestedTownship =
    townshipOptions.find((label) =>
      /sea vista|st francis|cape st francis|santareme/i.test(label),
    ) ?? townshipOptions[0];
  const suggestedProvince = provinceOptions[0];
  const suggestedDeedsOffice = suggestedDeedsOfficeForProvince(suggestedProvince);
  const currentAreaLabel =
    [suggestedTownship, municipalityOptions[0], suggestedProvince].filter(Boolean).join(", ") ||
    (parcels.length ? "Current map area" : "");
  const loadedAreaTerms = Array.from(
    new Set(
      parcels
        .flatMap((parcel) => [parcel.town, parcel.municipality, parcel.province])
        .filter((value): value is string => Boolean(value?.trim()))
        .flatMap((value) => value.toLowerCase().split(/\s+/))
        .filter((term) => term.length > 2),
    ),
  );

  return {
    deedsOfficeOptions: SA_DEEDS_OFFICES.map((office) => office.label),
    townshipOptions,
    municipalityOptions,
    provinceOptions,
    registryLabelOptions,
    suggestedDeedsOffice,
    suggestedTownship,
    currentAreaLabel,
    loadedAreaTerms,
  };
}
