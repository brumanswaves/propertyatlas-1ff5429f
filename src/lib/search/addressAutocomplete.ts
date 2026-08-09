export interface AddressAutocompleteSuggestion {
  id: string;
  placeId: string;
  label: string;
  subtitle: string;
  source: "google";
}

export interface AddressPlaceDetails {
  formattedAddress: string;
  lng: number;
  lat: number;
}

export function isAddressAutocompleteConfigured(): boolean {
  return true;
}

export async function fetchAddressAutocompleteSuggestions(
  query: string,
): Promise<AddressAutocompleteSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const response = await fetch("/api/address/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "autocomplete", query: trimmed }),
  });

  const data = (await response.json().catch(() => null)) as { success?: boolean; suggestions?: AddressAutocompleteSuggestion[]; error?: string } | null;
  if (!response.ok || !data?.success) throw new Error(data?.error ?? "Address suggestions are temporarily unavailable.");
  return data.suggestions ?? [];
}

export async function fetchAddressPlaceDetails(placeId: string): Promise<AddressPlaceDetails> {
  const response = await fetch("/api/address/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "details", placeId }),
  });
  const data = (await response.json().catch(() => null)) as { success?: boolean; place?: { formattedAddress?: string; lat?: number; lng?: number }; error?: string } | null;
  if (!response.ok || !data?.success) throw new Error(data?.error ?? "Address coordinates are temporarily unavailable.");
  const lat = data.place?.lat;
  const lng = data.place?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Address coordinates are temporarily unavailable.");
  }

  return {
    formattedAddress: data.place?.formattedAddress ?? "Selected address",
    lat: lat!,
    lng: lng!,
  };
}
