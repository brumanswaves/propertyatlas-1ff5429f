import { CircleDashed } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  askingPrice: "Asking price",
  propertyType: "Property type",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  garages: "Garages",
  parkingSpaces: "Parking spaces",
  erfSizeM2: "Erf size (m²)",
  floorSizeM2: "Floor size (m²)",
  streetAddress: "Street address",
  suburb: "Suburb",
  town: "Town",
  province: "Province",
  postalCode: "Postal code",
  ratesMonthly: "Rates & taxes",
  leviesMonthly: "Levies",
  occupationDate: "Occupation date",
  listingDate: "Listing date",
  agentName: "Agent name",
  agency: "Agency",
  phone: "Agent phone",
  email: "Agent email",
  erfNumber: "Erf number",
};

export function ListingMissingFields({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
        <CircleDashed className="h-3.5 w-3.5" />
        Not provided by listing
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <li
            key={field}
            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700"
          >
            {FIELD_LABELS[field] ?? field}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-stone-500">
        Missing values are not errors — the source listing simply did not publish them. Fill them
        in yourself if you have verified evidence.
      </p>
    </div>
  );
}
