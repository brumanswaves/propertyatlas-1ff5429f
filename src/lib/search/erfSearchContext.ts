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
  suggestedDeedsOffice?: string;
  suggestedTownship?: string;
  currentAreaLabel: string;
  loadedAreaTerms: string[];
}

function cleanLabel(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
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

export function deriveErfSearchContext(parcels: IndexedOfficialParcel[]): ErfSearchContext {
  const townshipOptions = uniqueSorted(parcels.map((parcel) => parcel.town));
  const municipalityOptions = uniqueSorted(parcels.map((parcel) => parcel.municipality));
  const provinceOptions = uniqueSorted(parcels.map((parcel) => parcel.province));
  const suggestedTownship = townshipOptions[0] ?? municipalityOptions[0];
  const suggestedProvince = provinceOptions[0];
  const suggestedDeedsOffice = suggestedDeedsOfficeForProvince(suggestedProvince);
  const currentAreaLabel =
    [suggestedTownship, municipalityOptions[0], suggestedProvince].filter(Boolean).join(", ") ||
    (parcels.length ? "loaded map area" : "");
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
    suggestedDeedsOffice,
    suggestedTownship,
    currentAreaLabel,
    loadedAreaTerms,
  };
}
