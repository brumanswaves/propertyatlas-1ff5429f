import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, MapPin, Search } from "lucide-react";
import { AREA_UNAVAILABLE_LABEL, canonicalAreaM2, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

interface ConfirmPropertyStepProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  mapSlot?: ReactNode;
  onConfirm: () => void;
  onFlagUncertain: () => void;
  onBackToMap: () => void;
}

function valueOrMissing(value: unknown) {
  return value === null || value === undefined || value === "" ? "Not available yet" : String(value);
}

function formatArea(parcel: NormalizedOfficialParcel) {
  return formatAreaM2WithUnit(canonicalAreaM2(parcel.rawProperties)) ?? AREA_UNAVAILABLE_LABEL;
}

function formatCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "Not available";
}

export function ConfirmPropertyStep({
  parcel,
  workspaceState,
  mapSlot,
  onConfirm,
  onFlagUncertain,
  onBackToMap,
}: ConfirmPropertyStepProps) {
  const confirmed =
    workspaceState.identityStatus === "looks_correct" || workspaceState.identityStatus === "checked";
  const uncertain = workspaceState.identityStatus === "uncertain";

  return (
    <div className="space-y-4">
      {confirmed && (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Property identity confirmed. Easy Erf has moved you to the next incomplete step.
        </div>
      )}
      {uncertain && (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <div>
              <p className="text-sm font-semibold text-red-950">
                You marked this erf as possibly wrong.
              </p>
              <p className="mt-1 text-sm leading-6 text-red-950/72">
                Return to the map or search again before relying on market, strategy or report
                outputs.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBackToMap}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Back to map
                </button>
                <button
                  type="button"
                  onClick={onBackToMap}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-900"
                >
                  <Search className="h-3.5 w-3.5" />
                  Search another property
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xl font-semibold tracking-tight text-[#0D1B2A]">
          Confirm this is the correct erf
        </h4>
        <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
          Check the official parcel identity before Easy Erf guides you into sources, market
          evidence, strategy and the report.
        </p>
      </div>

      <dl className="grid gap-3 md:grid-cols-2">
        {[
          ["Erf number", valueOrMissing(parcel.erfNumber)],
          ["Portion", valueOrMissing(parcel.portion ?? 0)],
          ["Township / area", valueOrMissing(parcel.suburbOrArea ?? parcel.town)],
          ["Municipality", valueOrMissing(parcel.municipality)],
          ["Extent", formatArea(parcel)],
          ["Official source", valueOrMissing(parcel.sourceLabel)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-3">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[#0D1B2A]">{value}</dd>
          </div>
        ))}
      </dl>

      {mapSlot}

      <details className="rounded-[1rem] border border-[#0D1B2A]/10 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#0D1B2A]">
          Advanced parcel details
        </summary>
        <div className="mt-3 grid gap-2 text-sm text-[#0D1B2A]/70 md:grid-cols-2">
          <div>Latitude: {formatCoordinate(parcel.coordinates?.lat)}</div>
          <div>Longitude: {formatCoordinate(parcel.coordinates?.lng)}</div>
          <div>LPI: {valueOrMissing(parcel.lpi)}</div>
          <div>Parcel key: {valueOrMissing(parcel.parcelKey)}</div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_-24px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F]"
        >
          <CheckCircle2 className="h-4 w-4" />
          Yes, this is the correct erf
        </button>
        <button
          type="button"
          onClick={onFlagUncertain}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-5 py-3 text-sm font-semibold text-[#0D1B2A] transition hover:border-red-300 hover:bg-red-50"
        >
          <AlertTriangle className="h-4 w-4" />
          This may be the wrong erf
        </button>
      </div>
    </div>
  );
}

export default ConfirmPropertyStep;
