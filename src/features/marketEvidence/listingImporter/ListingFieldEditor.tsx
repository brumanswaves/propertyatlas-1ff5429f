import type { ImportedListing } from "./types";

const FIELD =
  "w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/40";
const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-stone-500";

function num(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(value: string): string | null {
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function ListingFieldEditor({
  listing,
  onChange,
}: {
  listing: ImportedListing;
  onChange: (next: ImportedListing) => void;
}) {
  const p = listing.property;
  function setProp<K extends keyof typeof p>(key: K, value: (typeof p)[K]) {
    onChange({ ...listing, property: { ...p, [key]: value } });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Asking price (ZAR)">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.askingPrice ?? ""}
          onChange={(e) => setProp("askingPrice", num(e.target.value))}
        />
      </Field>
      <Field label="Property type">
        <input
          className={FIELD}
          defaultValue={p.propertyType ?? ""}
          onChange={(e) => setProp("propertyType", str(e.target.value))}
        />
      </Field>
      <Field label="Bedrooms">
        <input
          className={FIELD}
          inputMode="decimal"
          defaultValue={p.bedrooms ?? ""}
          onChange={(e) => setProp("bedrooms", num(e.target.value))}
        />
      </Field>
      <Field label="Bathrooms">
        <input
          className={FIELD}
          inputMode="decimal"
          defaultValue={p.bathrooms ?? ""}
          onChange={(e) => setProp("bathrooms", num(e.target.value))}
        />
      </Field>
      <Field label="Garages">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.garages ?? ""}
          onChange={(e) => setProp("garages", num(e.target.value))}
        />
      </Field>
      <Field label="Parking spaces">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.parkingSpaces ?? ""}
          onChange={(e) => setProp("parkingSpaces", num(e.target.value))}
        />
      </Field>
      <Field label="Erf size (m²)">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.erfSizeM2 ?? ""}
          onChange={(e) => setProp("erfSizeM2", num(e.target.value))}
        />
      </Field>
      <Field label="Floor size (m²)">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.floorSizeM2 ?? ""}
          onChange={(e) => setProp("floorSizeM2", num(e.target.value))}
        />
      </Field>
      <Field label="Street address">
        <input
          className={FIELD}
          defaultValue={p.streetAddress ?? ""}
          onChange={(e) => setProp("streetAddress", str(e.target.value))}
        />
      </Field>
      <Field label="Suburb">
        <input
          className={FIELD}
          defaultValue={p.suburb ?? ""}
          onChange={(e) => setProp("suburb", str(e.target.value))}
        />
      </Field>
      <Field label="Town">
        <input
          className={FIELD}
          defaultValue={p.town ?? ""}
          onChange={(e) => setProp("town", str(e.target.value))}
        />
      </Field>
      <Field label="Province">
        <input
          className={FIELD}
          defaultValue={p.province ?? ""}
          onChange={(e) => setProp("province", str(e.target.value))}
        />
      </Field>
      <Field label="Rates & taxes (monthly)">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.ratesMonthly ?? ""}
          onChange={(e) => setProp("ratesMonthly", num(e.target.value))}
        />
      </Field>
      <Field label="Levies (monthly)">
        <input
          className={FIELD}
          inputMode="numeric"
          defaultValue={p.leviesMonthly ?? ""}
          onChange={(e) => setProp("leviesMonthly", num(e.target.value))}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}
