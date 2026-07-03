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

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function isAddressAutocompleteConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY?.trim());
}

function autocompleteSetupError(): Error {
  return new Error(
    "Address autocomplete is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY with Places enabled.",
  );
}

export async function fetchAddressAutocompleteSuggestions(
  query: string,
): Promise<AddressAutocompleteSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  if (!isAddressAutocompleteConfigured()) throw autocompleteSetupError();

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input: trimmed,
      includedRegionCodes: ["za"],
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    throw new Error("Address suggestions are temporarily unavailable.");
  }

  const data = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  return (data.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction?.placeId) return null;
      const mainText = prediction.structuredFormat?.mainText?.text ?? prediction.text?.text;
      if (!mainText) return null;
      return {
        id: prediction.placeId,
        placeId: prediction.placeId,
        label: mainText,
        subtitle: prediction.structuredFormat?.secondaryText?.text ?? "South Africa",
        source: "google" as const,
      };
    })
    .filter((item): item is AddressAutocompleteSuggestion => Boolean(item));
}

export async function fetchAddressPlaceDetails(placeId: string): Promise<AddressPlaceDetails> {
  if (!isAddressAutocompleteConfigured()) throw autocompleteSetupError();

  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": "formattedAddress,location",
    },
  });

  if (!response.ok) {
    throw new Error("Address coordinates are temporarily unavailable.");
  }

  const data = (await response.json()) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Address coordinates are temporarily unavailable.");
  }

  return {
    formattedAddress: data.formattedAddress ?? "Selected address",
    lat: lat!,
    lng: lng!,
  };
}
