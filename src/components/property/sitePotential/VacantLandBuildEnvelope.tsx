import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Ruler, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateBuildEnvelope,
  createEmptyBuildEnvelopeInputs,
  type BuildEnvelopeInputs,
  type BuildEnvelopeResult,
  type BuildEnvelopeRuleSource,
} from "@/lib/sitePotential/buildEnvelope";
import {
  clearStoredBuildEnvelopeInputs,
  readStoredBuildEnvelopeInputs,
  writeStoredBuildEnvelopeInputs,
  type StoredBuildEnvelopeInputs,
} from "@/lib/sitePotential/buildEnvelopeStore";
import { BuildEnvelopeDiagram } from "./BuildEnvelopeDiagram";

export interface VacantLandBuildEnvelopeProps {
  parcelId: string;
  parcelLabel: string;
  /** Official exterior ring in [lng, lat]. Null when geometry is unavailable. */
  ring: Array<[number, number]> | null;
  recordedAreaM2: number | null;
  zoneLabel?: string | null;
  onResultChange?: (result: BuildEnvelopeResult) => void;
}

const STATE_TONE: Record<BuildEnvelopeResult["state"], string> = {
  verified: "border-[#16a34a]/30 bg-[#16a34a]/10 text-[#166534]",
  estimated: "border-[#FF6A00]/30 bg-[#FF6A00]/10 text-[#9a3412]",
  more_information_required: "border-[#0D1B2A]/15 bg-[#0D1B2A]/5 text-[#0D1B2A]",
  unavailable: "border-[#0D1B2A]/15 bg-[#0D1B2A]/5 text-[#0D1B2A]",
};

const RULE_SOURCE_OPTIONS: Array<{ id: BuildEnvelopeRuleSource; label: string; body: string }> = [
  {
    id: "document",
    label: "Zoning document",
    body: "You have a zoning certificate or scheme extract for this erf.",
  },
  {
    id: "registry",
    label: "Published rule set",
    body: "Use the municipality's published rules for the zone.",
  },
  {
    id: "manual",
    label: "My own assumption",
    body: "Entered by you and clearly labelled as an assumption.",
  },
];

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function VacantLandBuildEnvelope({
  parcelId,
  parcelLabel,
  ring,
  recordedAreaM2,
  zoneLabel = null,
  onResultChange,
}: VacantLandBuildEnvelopeProps) {
  const [answers, setAnswers] = useState<StoredBuildEnvelopeInputs>(() => {
    const stored = readStoredBuildEnvelopeInputs(parcelId);
    const empty = createEmptyBuildEnvelopeInputs(parcelId, null, recordedAreaM2);
    const { ring: _ring, parcelId: _id, ...rest } = empty;
    return { ...rest, zoneLabel, ...(stored ?? {}), recordedAreaM2 };
  });

  useEffect(() => {
    const stored = readStoredBuildEnvelopeInputs(parcelId);
    const empty = createEmptyBuildEnvelopeInputs(parcelId, null, recordedAreaM2);
    const { ring: _ring, parcelId: _id, ...rest } = empty;
    setAnswers({ ...rest, zoneLabel, ...(stored ?? {}), recordedAreaM2 });
  }, [parcelId, recordedAreaM2, zoneLabel]);

  const patch = useCallback(
    (next: Partial<StoredBuildEnvelopeInputs>) => {
      setAnswers((current) => {
        const merged = { ...current, ...next };
        writeStoredBuildEnvelopeInputs(parcelId, merged);
        return merged;
      });
    },
    [parcelId],
  );

  const inputs = useMemo<BuildEnvelopeInputs>(
    () => ({ ...answers, parcelId, ring, recordedAreaM2 }),
    [answers, parcelId, ring, recordedAreaM2],
  );

  const result = useMemo(() => calculateBuildEnvelope(inputs), [inputs]);

  useEffect(() => {
    onResultChange?.(result);
  }, [onResultChange, result]);

  const edgeOptions = result.parcelPolygon.map((_, index) => index);

  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Vacant land
          </div>
          <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            What could potentially be built here
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#64748B]">
            Calculated from the official parcel boundary and the planning rules recorded for{" "}
            {parcelLabel}. Nothing here is generated imagery, and nothing is an approval.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold",
            STATE_TONE[result.state],
          )}
        >
          {result.stateLabel}
        </span>
      </header>

      <p className="mt-3 rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3 text-[12px] leading-5 text-[#0D1B2A]/75">
        {result.stateExplanation}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <BuildEnvelopeDiagram result={result} />

        <div className="space-y-4">
          {/* Step 1 — boundary */}
          <Step index={1} title="Confirm the parcel boundary">
            <label className="flex items-start gap-2 text-[12px] text-[#0D1B2A]/80">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={answers.boundaryConfirmed}
                disabled={result.parcelPolygon.length < 3}
                onChange={(event) => patch({ boundaryConfirmed: event.target.checked })}
              />
              <span>
                The outline shown matches the erf I am investigating. Dimensions stay hidden until
                this is confirmed.
              </span>
            </label>
          </Step>

          {/* Step 2 — street edge */}
          <Step index={2} title="Which boundary faces the street?">
            <div className="flex flex-wrap gap-2">
              {edgeOptions.map((index) => {
                const edge = result.edges[index];
                const active = answers.streetEdgeIndex === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => patch({ streetEdgeIndex: index })}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                      active
                        ? "border-[#FF6A00] bg-[#FF6A00]/10 text-[#9a3412]"
                        : "border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:border-[#0D1B2A]/30",
                    )}
                  >
                    Boundary {index + 1}
                    {result.showsDimensions ? ` · ${edge?.lengthM ?? 0} m` : ""}
                  </button>
                );
              })}
              {edgeOptions.length === 0 && (
                <p className="text-[12px] text-[#64748B]">
                  No boundary geometry is loaded for this erf.
                </p>
              )}
            </div>
            <input
              type="text"
              value={answers.streetName ?? ""}
              onChange={(event) => patch({ streetName: event.target.value || null })}
              placeholder="Street name (optional)"
              className="mt-3 w-full rounded-xl border border-[#0D1B2A]/15 px-3 py-2 text-[12px] text-[#0D1B2A]"
            />
          </Step>

          {/* Step 3 — rule source */}
          <Step index={3} title="Where do the build rules come from?">
            <div className="grid gap-2">
              {RULE_SOURCE_OPTIONS.map((option) => {
                const active = answers.ruleSource === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => patch({ ruleSource: option.id })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition",
                      active
                        ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]"
                        : "border-[#0D1B2A]/12 bg-white hover:border-[#0D1B2A]/25",
                    )}
                  >
                    <span className="block text-[12px] font-semibold text-[#0D1B2A]">
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-[#64748B]">{option.body}</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={answers.zoneLabel ?? ""}
              onChange={(event) => patch({ zoneLabel: event.target.value || null })}
              placeholder="Zone (e.g. Residential 1)"
              className="mt-3 w-full rounded-xl border border-[#0D1B2A]/15 px-3 py-2 text-[12px] text-[#0D1B2A]"
            />
          </Step>

          {/* Step 4 — building lines */}
          <Step index={4} title="Building lines">
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Street (m)"
                value={answers.streetSetbackM}
                onChange={(value) => patch({ streetSetbackM: value })}
              />
              <NumberField
                label="Side (m)"
                value={answers.sideSetbackM}
                onChange={(value) => patch({ sideSetbackM: value })}
              />
              <NumberField
                label="Rear (m)"
                value={answers.rearSetbackM}
                onChange={(value) => patch({ rearSetbackM: value })}
              />
            </div>
          </Step>

          {/* Step 5 — bulk */}
          <Step index={5} title="Coverage and height">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Max coverage (%)"
                value={answers.maxCoveragePercent}
                onChange={(value) => patch({ maxCoveragePercent: value })}
              />
              <NumberField
                label="Max height (m)"
                value={answers.maxHeightM}
                onChange={(value) => patch({ maxHeightM: value })}
              />
            </div>
          </Step>

          {/* Step 6 — dwellings */}
          <Step index={6} title="Dwelling units">
            <div className="grid gap-2">
              <NumberField
                label="Primary dwelling units"
                value={answers.dwellingUnits}
                onChange={(value) => patch({ dwellingUnits: value })}
              />
              <input
                type="text"
                value={answers.additionalDwellingRule ?? ""}
                onChange={(event) =>
                  patch({ additionalDwellingRule: event.target.value || null })
                }
                placeholder="Additional dwelling rule (e.g. one second dwelling permitted)"
                className="w-full rounded-xl border border-[#0D1B2A]/15 px-3 py-2 text-[12px] text-[#0D1B2A]"
              />
              <label className="flex items-center gap-2 text-[12px] text-[#0D1B2A]/80">
                <input
                  type="checkbox"
                  checked={answers.additionalDwellingRequiresConsent}
                  onChange={(event) =>
                    patch({ additionalDwellingRequiresConsent: event.target.checked })
                  }
                />
                Additional dwelling requires municipal consent
              </label>
            </div>
          </Step>

          {/* Step 7 — constraints */}
          <Step index={7} title="Servitudes and exclusion areas">
            <textarea
              value={answers.servitudeNotes ?? ""}
              onChange={(event) => patch({ servitudeNotes: event.target.value || null })}
              rows={2}
              placeholder="Record any registered servitude, easement or no-build area you have confirmed."
              className="w-full rounded-xl border border-[#0D1B2A]/15 px-3 py-2 text-[12px] text-[#0D1B2A]"
            />
          </Step>
        </div>
      </div>

      {/* Deterministic summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryTile
          label="Erf area"
          value={result.summary.erfAreaM2 != null ? `${result.summary.erfAreaM2} m²` : "Not available"}
          note={result.summary.erfAreaSourceLabel}
        />
        <SummaryTile
          label="Theoretical ground floor"
          value={
            result.summary.theoreticalGroundFloorM2 != null
              ? `${result.summary.theoreticalGroundFloorM2} m²`
              : "Not available"
          }
          note={
            result.summary.maxCoveragePercent != null
              ? `At ${result.summary.maxCoveragePercent}% coverage`
              : "Coverage not confirmed"
          }
        />
        <SummaryTile
          label="Setback envelope"
          value={
            result.summary.setbackEnvelopeAreaM2 != null
              ? `${result.summary.setbackEnvelopeAreaM2} m²`
              : "Not available"
          }
          note="Area inside all building lines"
        />
        <SummaryTile
          label="Maximum height"
          value={result.summary.maxHeightM != null ? `${result.summary.maxHeightM} m` : "Not confirmed"}
          note="As recorded above"
        />
        <SummaryTile
          label="Dwelling allowance"
          value={result.summary.dwellingAllowance}
          note={result.summary.additionalDwellingRule}
        />
        <SummaryTile
          label="Indicative upper floor"
          value={
            result.summary.indicativeUpperFloorM2 != null
              ? `${result.summary.indicativeUpperFloorM2} m²`
              : "Not available"
          }
          note="Only shown when the height allowance supports a second storey"
        />
      </div>

      {result.summary.knownConstraints.length > 0 && (
        <ul className="mt-4 space-y-1 text-[12px] text-[#0D1B2A]/80">
          {result.summary.knownConstraints.map((item) => (
            <li key={item} className="flex gap-2">
              <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A00]" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {result.missingInformation.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[#0D1B2A]/12 bg-[#F7FBFF] p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#0D1B2A]">
            <Info className="h-4 w-4 text-[#FF6A00]" />
            Still needed before this can be verified
          </div>
          <ul className="mt-2 grid gap-1 text-[12px] text-[#0D1B2A]/75 sm:grid-cols-2">
            {result.missingInformation.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.assumptions.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] leading-5 text-[#64748B]">
          {result.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {result.sources.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16a34a]" />
          Based on: {result.sources.join(", ")}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          clearStoredBuildEnvelopeInputs(parcelId);
          const empty = createEmptyBuildEnvelopeInputs(parcelId, null, recordedAreaM2);
          const { ring: _ring, parcelId: _id, ...rest } = empty;
          setAnswers(rest);
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset these answers
      </button>
    </section>
  );
}

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0D1B2A] text-[10px] font-bold text-white">
          {index}
        </span>
        <span className="text-[12px] font-semibold text-[#0D1B2A]">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold text-[#64748B]">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(numberOrNull(event.target.value))}
        className="mt-1 w-full rounded-xl border border-[#0D1B2A]/15 px-3 py-2 text-[12px] font-normal text-[#0D1B2A]"
      />
    </label>
  );
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold text-[#0D1B2A]">{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-[#64748B]">{note}</div>
    </div>
  );
}
