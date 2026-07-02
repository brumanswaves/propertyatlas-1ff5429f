export interface AddressAutocompleteSuggestion {
  id: string;
  label: string;
  subtitle: string;
  lng: number;
  lat: number;
  source: "mapbox";
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

function contextSubtitle(
  context: Array<{ id?: string; text?: string }> | undefined,
  placeName: string | undefined,
): string {
  const parts =
    context
      ?.filter((item) =>
        ["neighborhood", "locality", "place", "region"].some((prefix) =>
          item.id?.startsWith(prefix),
        ),
      )
      .map((item) => item.text)
      .filter((value): value is string => Boolean(value)) ?? [];
  return parts.length ? parts.join(", ") : (placeName ?? "South Africa");
}

export async function fetchAddressAutocompleteSuggestions(
  query: string,
): Promise<AddressAutocompleteSuggestion[]> {
  const trimmed = query.trim();
  if (!MAPBOX_TOKEN || trimmed.length < 3) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: "true",
    country: "za",
    language: "en",
    limit: "5",
    types: "address,poi,neighborhood,locality,place",
  });
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    trimmed,
  )}.json?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Address suggestions are temporarily unavailable.");
  }
  const data = (await response.json()) as {
    features?: Array<{
      id?: string;
      place_name?: string;
      text?: string;
      address?: string;
      center?: [number, number];
      context?: Array<{ id?: string; text?: string }>;
    }>;
  };

  return (data.features ?? [])
    .map((feature, index) => {
      const center = feature.center;
      if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return null;
      const label = [feature.address, feature.text].filter(Boolean).join(" ") || feature.place_name;
      if (!label) return null;
      return {
        id: feature.id ?? `${center[0]},${center[1]},${index}`,
        label,
        subtitle: contextSubtitle(feature.context, feature.place_name),
        lng: center[0],
        lat: center[1],
        source: "mapbox" as const,
      };
    })
    .filter((item): item is AddressAutocompleteSuggestion => Boolean(item));
}
