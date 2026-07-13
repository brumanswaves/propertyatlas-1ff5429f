import { useState } from "react";
import { MapPin } from "lucide-react";
import type { ListingMatchChoice } from "./types";

const OPTION =
  "flex flex-col items-start gap-1 rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left text-sm transition hover:border-accent/60 hover:bg-accent/5";
const OPTION_ACTIVE = "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,106,0,0.35)]";
const FIELD =
  "w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/40";

export function ListingMatchSelector({
  hasSelectedErf,
  selectedErfLabel,
  value,
  onChange,
}: {
  hasSelectedErf: boolean;
  selectedErfLabel?: string | null;
  value: ListingMatchChoice;
  onChange: (next: ListingMatchChoice) => void;
}) {
  const [manualErf, setManualErf] = useState(
    value.kind === "manual" ? (value.erfNumber ?? "") : "",
  );
  const [manualAddress, setManualAddress] = useState(
    value.kind === "manual" ? (value.address ?? "") : "",
  );

  const kind = value.kind;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Which erf does this listing relate to?
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!hasSelectedErf}
          onClick={() => onChange({ kind: "current_erf" })}
          className={`${OPTION} ${kind === "current_erf" ? OPTION_ACTIVE : ""} ${
            !hasSelectedErf ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Currently selected erf
          </span>
          <span className="font-medium text-stone-900">
            {selectedErfLabel ?? "No erf selected"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ kind: "map_pick" })}
          className={`${OPTION} ${kind === "map_pick" ? OPTION_ACTIVE : ""}`}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <MapPin className="h-3 w-3" /> Select an erf on the map
          </span>
          <span className="text-stone-700">Pick a parcel after saving to attach later.</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ kind: "unmatched_area_comp" })}
          className={`${OPTION} ${kind === "unmatched_area_comp" ? OPTION_ACTIVE : ""}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Save as unmatched area comparable
          </span>
          <span className="text-stone-700">Keep as market signal without linking to an erf.</span>
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({ kind: "manual", erfNumber: manualErf || null, address: manualAddress || null })
          }
          className={`${OPTION} ${kind === "manual" ? OPTION_ACTIVE : ""}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Manually enter erf or address
          </span>
          <span className="text-stone-700">Attach using an erf number or a verified address.</span>
        </button>
      </div>

      {kind === "manual" && (
        <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Erf number
            </span>
            <input
              className={FIELD}
              value={manualErf}
              onChange={(e) => {
                setManualErf(e.target.value);
                onChange({ kind: "manual", erfNumber: e.target.value || null, address: manualAddress || null });
              }}
              placeholder="e.g. 962"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Address
            </span>
            <input
              className={FIELD}
              value={manualAddress}
              onChange={(e) => {
                setManualAddress(e.target.value);
                onChange({ kind: "manual", erfNumber: manualErf || null, address: e.target.value || null });
              }}
              placeholder="Street, suburb, town"
            />
          </label>
        </div>
      )}
    </div>
  );
}
