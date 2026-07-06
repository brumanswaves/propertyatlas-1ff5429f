export interface DeedsOfficeOption {
  id: string;
  label: string;
}

export const SA_DEEDS_OFFICES: DeedsOfficeOption[] = [
  { id: "bloemfontein", label: "Bloemfontein" },
  { id: "cape-town", label: "Cape Town" },
  { id: "johannesburg", label: "Johannesburg" },
  { id: "kimberley", label: "Kimberley" },
  { id: "king-williams-town", label: "King William's Town" },
  { id: "limpopo", label: "Limpopo" },
  { id: "mpumalanga", label: "Mpumalanga" },
  { id: "pietermaritzburg", label: "Pietermaritzburg" },
  { id: "pretoria", label: "Pretoria" },
  { id: "mthatha", label: "Mthatha" },
  { id: "vryburg", label: "Vryburg" },
];

export function suggestedDeedsOfficeForProvince(province: string | undefined): string | undefined {
  const normalized = province?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("eastern cape")) return "King William's Town";
  if (normalized.includes("western cape")) return "Cape Town";
  if (normalized.includes("kwazulu") || normalized.includes("natal")) return "Pietermaritzburg";
  if (normalized.includes("gauteng")) return "Johannesburg";
  if (normalized.includes("free state")) return "Bloemfontein";
  if (normalized.includes("northern cape")) return "Kimberley";
  if (normalized.includes("limpopo")) return "Limpopo";
  if (normalized.includes("mpumalanga")) return "Mpumalanga";
  if (normalized.includes("north west")) return "Vryburg";
  return undefined;
}
