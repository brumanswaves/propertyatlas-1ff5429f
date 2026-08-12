import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { Info, Ruler, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateBuildEnvelope,
  projectRingToLocalMetres,
  type BuildEnvelopeInputs,
  type BuildEnvelopeResult,
  type BuildEnvelopeRuleSource,
} from "@/lib/sitePotential/buildEnvelope";
import {
  clearStoredBuildEnvelopeInputs,
  readStoredBuildEnvelopeInputs,
  writeStoredBuildEnvelopeInputs,
  type StoredBuildEnvelopeOverrides,
} from "@/lib/sitePotential/buildEnvelopeStore";
import { findPilotPlanningRecord } from "@/lib/sitePotential/pilotPlanningRecords";
import {
  resolveConfirmedStreetFrontages,
  resolveSitePotentialInputs,
} from "@/lib/sitePotential/resolveSitePotentialInputs";
import { detectStreetFrontage, type RoadLineInput } from "@/lib/sitePotential/streetFrontage";
import { writeStoredStreetFrontageDetection } from "@/lib/sitePotential/streetFrontageStore";
import { SatelliteParcelMap } from "./SatelliteParcelMap";

import { BuildEnvelopeDiagram } from "./BuildEnvelopeDiagram";
import { buildSitePotentialRulePrefill } from "@/lib/sitePotential/planningRuleAdapter";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";

export interface VacantLandBuildEnvelopeProps {
  parcelId: string;
  parcelLabel: string;
  /** Official exterior ring in [lng, lat]. Null when geometry is unavailable. */
  ring: Array<[number, number]> | null;
  recordedAreaM2: number | null;
  zoneLabel?: string | null;
  onResultChange?: (result: BuildEnvelopeResult) => void;
  /** Same planning assessment that powers Zoning & Build — single source of truth. */
  assessment?: ParcelPlanningAssessment | null;
  /**
   * True only when a property-matched zoning document actually supplied the
   * zone and the numeric controls.
   */
  documentRuleEvidence?: boolean;
  /** Canonical LPI code, used to match a property-specific pilot record. */
  lpiCode?: string | null;
  onOpenTab?: (tab: string) => void;
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
    body: "A zoning certificate for this erf supplied these numbers.",
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
  assessment = null,
  documentRuleEvidence = false,
  lpiCode = null,
  onOpenTab,
}: VacantLandBuildEnvelopeProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const prefill = useMemo(
    () => (assessment ? buildSitePotentialRulePrefill(assessment) : null),
    [assessment],
  );
  const pilot = useMemo(() => findPilotPlanningRecord({ parcelId, lpiCode }), [parcelId, lpiCode]);

  /** Only fields the user actually touched. Never seeded from a prefill. */
  const [overrides, setOverrides] = useState<StoredBuildEnvelopeOverrides>(
    () => readStoredBuildEnvelopeInputs(parcelId, userId) ?? {},
  );

  useLayoutEffect(() => {
    setOverrides(readStoredBuildEnvelopeInputs(parcelId, userId) ?? {});
  }, [parcelId, userId]);

  const edgeLengths = useMemo(() => {
    const polygon = ring ? projectRingToLocalMetres(ring) : [];
    return polygon.map((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      return Math.hypot(b.x - a.x, b.y - a.y);
    });
  }, [ring]);

  /** Road lines rendered by the satellite map near this parcel. */
  const [roads, setRoads] = useState<RoadLineInput[] | null>(null);
  const savedStreetName = overrides.streetName ?? pilot?.streetName ?? null;

  /**
   * Deterministic frontage detection from real road geometry. A user-confirmed
   * edge short-circuits scoring inside the detector itself.
   */
  const detection = useMemo(
    () =>
      detectStreetFrontage({
        ring,
        roads: roads ?? [],
        savedStreetName,
        confirmedEdgeIndex: overrides.streetFrontageConfirmedByUser ? null : (overrides.streetEdgeIndex ?? null),
      }),
    [ring, roads, savedStreetName, overrides.streetEdgeIndex, overrides.streetFrontageConfirmedByUser],
  );

  // Detection evidence is audited separately from the confirmed answer.
  useEffect(() => {
    if (detection.method !== "map_road_match") return;
    writeStoredStreetFrontageDetection(
      parcelId,
      {
        edgeIndex: detection.edgeIndex,
        roadName: detection.roadName,
        confidence: detection.confidence,
        method: detection.method,
      },
      undefined,
      userId,
    );
  }, [detection, parcelId, userId]);

  const resolved = useMemo(
    () =>
      resolveSitePotentialInputs({
        overrides,
        prefill,
        pilot,
        documentRuleEvidence,
        edgeLengths,
        recordedAreaM2,
        detectedStreetEdge:
          detection.method === "map_road_match" && detection.edgeIndex != null
            ? {
                edgeIndex: detection.edgeIndex,
                roadName: detection.roadName,
                confidence: detection.confidence,
              }
            : null,
      }),
    [overrides, prefill, pilot, documentRuleEvidence, edgeLengths, recordedAreaM2, detection],
  );

  const patch = useCallback(
    (next: StoredBuildEnvelopeOverrides) => {
      setOverrides((current) => {
        const merged = { ...current, ...next };
        writeStoredBuildEnvelopeInputs(parcelId, merged, userId);
        return merged;
      });
    },
    [parcelId, userId],
  );

  const answers = resolved.answers;
  const additionalStreetEdgeIndexes = useMemo(
    () => answers.additionalStreetEdgeIndexes ?? [],
    [answers.additionalStreetEdgeIndexes],
  );
  const streetFrontageConfirmed =
    answers.streetFrontageConfirmedByUser || resolved.fields.streetEdgeIndex.origin === "user";
  const confirmedStreetEdgeIndexes = useMemo(
    () =>
      streetFrontageConfirmed && answers.streetEdgeIndex != null
        ? [answers.streetEdgeIndex, ...additionalStreetEdgeIndexes].sort((a, b) => a - b)
        : [],
    [additionalStreetEdgeIndexes, answers.streetEdgeIndex, streetFrontageConfirmed],
  );

  const toggleStreetFrontage = useCallback(
    (edgeIndex: number) => {
      const selected = confirmedStreetEdgeIndexes.includes(edgeIndex)
        ? confirmedStreetEdgeIndexes.filter((index) => index !== edgeIndex)
        : [...confirmedStreetEdgeIndexes, edgeIndex];
      const next = resolveConfirmedStreetFrontages(
        selected,
        answers.streetEdgeIndex,
        edgeLengths.length,
      );
      patch({
        streetFrontageConfirmedByUser: true,
        streetEdgeIndex: next.streetEdgeIndex,
        additionalStreetEdgeIndexes: next.additionalStreetEdgeIndexes,
        secondaryStreetEdgeIndex: null,
      });
    },
    [answers.streetEdgeIndex, confirmedStreetEdgeIndexes, edgeLengths.length, patch],
  );

  const inputs = useMemo<BuildEnvelopeInputs>(
    () => ({
      ...answers,
      zoneLabel: answers.zoneLabel ?? zoneLabel,
      parcelId,
      ring,
      recordedAreaM2: answers.recordedAreaM2 ?? recordedAreaM2,
    }),
    [answers, parcelId, ring, recordedAreaM2, zoneLabel],
  );

  const result = useMemo(() => calculateBuildEnvelope(inputs), [inputs]);

  useEffect(() => {
    onResultChange?.(result);
  }, [onResultChange, result]);

  const edgeOptions = result.parcelPolygon.map((_, index) => index);
  const coverageAreaM2 = result.summary.theoreticalGroundFloorM2;

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

      {resolved.invalidatedStoredDocumentSource && (
        <p className="mt-3 rounded-2xl border border-[#FF6A00]/25 bg-[#FF6A00]/[0.06] px-4 py-3 text-[12px] leading-5 text-[#9a3412]">
          A previously stored “Zoning document” selection was ignored: no property-matched zoning
          document has supplied the zone and numeric controls for this erf.
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
          Street frontage
        </div>
        <h3 className="mt-1 text-sm font-semibold text-[#0D1B2A]">
          Which property boundaries face a street?
        </h3>
        <p className="mt-1 text-[12px] leading-5 text-[#0D1B2A]/72">
          Select every property boundary that faces a street. Easy Erf may suggest a side from
          nearby road geometry; your selections are saved as working site context, not verified
          planning controls.
        </p>
        <p className="mt-2 text-[11px] leading-5 text-[#64748B]">
          {streetFrontageConfirmed
            ? confirmedStreetEdgeIndexes.length
              ? `${confirmedStreetEdgeIndexes.length} street-facing boundary${confirmedStreetEdgeIndexes.length === 1 ? " is" : "ies are"} confirmed by you.${savedStreetName ? ` ${savedStreetName}.` : ""}`
              : "You confirmed that no property boundary is currently treated as street-facing."
            : detection.edgeIndex != null
              ? `Likely frontage detected from nearby road geometry${detection.roadName ? `: ${detection.roadName}` : ""}. Select the map boundaries to confirm or change it.`
              : "No likely frontage was detected yet. Select any street-facing boundary directly on the map."}
        </p>
      </section>

      {/* Result first: large satellite visual, compact build summary beside it. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <SatelliteParcelMap
          ring={ring}
          result={result}
          onRoadsDetected={setRoads}
          selectableEdges
          confirmedStreetEdgeIndexes={confirmedStreetEdgeIndexes}
          suggestedStreetEdgeIndex={streetFrontageConfirmed ? null : detection.edgeIndex}
          onEdgeSelect={toggleStreetFrontage}
        />

        <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Build summary
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                STATE_TONE[result.state],
              )}
            >
              {resolved.ruleStatus === "verified"
                ? "Verified"
                : resolved.ruleStatus === "estimated"
                  ? "Estimated"
                  : "Incomplete"}
            </span>
          </div>

          <dl className="mt-3 divide-y divide-[#0D1B2A]/8">
            <SummaryRow
              label="Site area"
              value={
                result.summary.erfAreaM2 != null
                  ? `${result.summary.erfAreaM2} m²`
                  : "Not available"
              }
              note={result.summary.erfAreaSourceLabel}
            />
            <SummaryRow
              label={
                resolved.ruleStatus === "verified"
                  ? "Maximum verified coverage"
                  : "Coverage working assumption"
              }
              value={
                result.summary.maxCoveragePercent != null
                  ? `${resolved.ruleStatus === "verified" ? "" : "Working assumption: "}${result.summary.maxCoveragePercent}%${
                      coverageAreaM2 != null ? ` · ${coverageAreaM2} m²` : ""
                    }`
                  : "Not confirmed"
              }
              note={
                resolved.ruleStatus === "verified"
                  ? resolved.fields.maxCoveragePercent.provenance
                  : `${resolved.fields.maxCoveragePercent.provenance} Property-specific planning controls not yet verified.`
              }
            />
            <SummaryRow
              label="Maximum height"
              value={
                result.summary.maxHeightM != null
                  ? `${result.summary.maxHeightM} m`
                  : "Not confirmed"
              }
              note={resolved.fields.maxHeightM.provenance}
            />
            <SummaryRow
              label="Street building line"
              value={
                answers.streetSetbackM != null ? `${answers.streetSetbackM} m` : "Not confirmed"
              }
              note={
                answers.streetName
                  ? `${answers.streetName} frontage · ${resolved.fields.streetSetbackM.provenance}`
                  : resolved.fields.streetSetbackM.provenance
              }
            />
            <SummaryRow
              label="Side building lines"
              value={answers.sideSetbackM != null ? `${answers.sideSetbackM} m` : "Not confirmed"}
              note={resolved.fields.sideSetbackM.provenance}
            />
            <SummaryRow
              label="Rear building line"
              value={answers.rearSetbackM != null ? `${answers.rearSetbackM} m` : "Not confirmed"}
              note={resolved.fields.rearSetbackM.provenance}
            />
            <SummaryRow
              label="Dwellings allowed"
              value={result.summary.dwellingAllowance}
              note={result.summary.additionalDwellingRule}
            />
            <SummaryRow
              label="Setback envelope"
              value={
                result.summary.setbackEnvelopeAreaM2 != null
                  ? `${result.summary.setbackEnvelopeAreaM2} m²`
                  : "Not available"
              }
              note="Area inside all building lines, shown separately from the coverage footprint."
            />
          </dl>

          {result.summary.maxHeightM != null ? (
            <div className="mt-4 rounded-xl border border-[#0D1B2A]/10 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                Height limit
              </div>
              <div className="mt-2 flex items-end gap-3">
                <div className="flex h-16 w-8 items-end overflow-hidden rounded-md bg-[#E2E8F0]">
                  <div
                    className="w-full rounded-md bg-[#FF6A00]"
                    style={{
                      height: `${Math.max(12, Math.min(100, (result.summary.maxHeightM / 12) * 100))}%`,
                    }}
                  />
                </div>
                <div className="pb-1 text-[12px] leading-5 text-[#0D1B2A]/70">
                  <span className="font-semibold text-[#0D1B2A]">
                    {result.summary.maxHeightM} m
                  </span>{" "}
                  maximum height to the top of the roof.
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] leading-5 text-[#64748B]">
            Based on: {resolved.ruleSourceLabel}
          </p>
        </div>
      </div>

      {result.coverageFootprint ? (
        <div className="mt-4 rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3">
          <div className="text-[12px] font-semibold text-[#0D1B2A]">
            {resolved.ruleStatus === "verified"
              ? "Maximum verified coverage"
              : "Derived footprint from working assumption"}
            : {result.coverageFootprint.areaM2} m²
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#64748B]">
            {resolved.ruleStatus === "verified"
              ? null
              : "Coverage is using unverified planning-control assumptions. It is not an official property right or approval. "}
            {result.secondDwelling
              ? `Example split if an additional dwelling is relevant: approximately ${result.coverageFootprint.allocation.mainM2} m² main dwelling plus up to approximately ${result.coverageFootprint.allocation.additionalM2} m² additional dwelling. The total never exceeds ${result.coverageFootprint.areaM2} m².`
              : "This is allowed ground-floor area only, not a building design or an approved position."}{" "}
            This is an illustrative allocation, not an approved design.
          </p>
        </div>
      ) : null}

      {/* One Next Best Action */}
      {prefill?.nextBestAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FF6A00]/25 bg-[#FF6A00]/[0.05] px-4 py-3">
          <div>
            <div className="text-[12px] font-semibold text-[#0D1B2A]">
              {prefill.nextBestAction.title}
            </div>
            <div className="mt-1 text-[11px] leading-5 text-[#64748B]">
              {prefill.nextBestAction.detail}
            </div>
          </div>
          {onOpenTab ? (
            <button
              type="button"
              onClick={() => onOpenTab(prefill.nextBestAction!.actionTab)}
              className="shrink-0 rounded-full bg-[#FF6A00] px-4 py-1.5 text-[11px] font-semibold text-white"
            >
              {prefill.nextBestAction.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Collapsed technical detail / manual override surface */}
      <details className="mt-6 rounded-2xl border border-[#0D1B2A]/10 bg-white">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-[12px] font-semibold text-[#0D1B2A]">
          Review inputs and technical details
        </summary>
        <div className="border-t border-[#0D1B2A]/10 p-4">
          <p className="mb-3 rounded-xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-3 py-2 text-[11px] leading-5 text-[#64748B]">
            Fields are filled automatically from the planning rules resolved for this erf. Anything
            you change here is stored as your own assumption and always overrides the prefill.
          </p>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
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
                    The outline shown matches the erf I am investigating. Dimensions stay hidden
                    until this is confirmed.
                  </span>
                </label>
              </Step>

              {/* Step 2 — street edge */}
              <Step index={2} title="Street-facing boundaries">
                <div className="flex flex-wrap gap-2">
                  {edgeOptions.map((index) => {
                    const edge = result.edges[index];
                    const selected = confirmedStreetEdgeIndexes.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleStreetFrontage(index)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                          selected
                            ? "border-[#FF6A00] bg-[#FF6A00]/10 text-[#9a3412]"
                            : "border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:border-[#0D1B2A]/30",
                        )}
                      >
                        {selected ? "Street-facing · " : ""}Boundary {index + 1}
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
                <p className="mt-2 text-[11px] text-[#64748B]">
                  {resolved.fields.streetEdgeIndex.provenance}
                </p>
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Select every boundary that faces a street. You can also select none when the
                  map context does not support a street-facing boundary for this erf.
                </p>
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
                    const disabled = option.id === "document" && !documentRuleEvidence;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => patch({ ruleSource: option.id })}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left transition",
                          active
                            ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]"
                            : "border-[#0D1B2A]/12 bg-white hover:border-[#0D1B2A]/25",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="block text-[12px] font-semibold text-[#0D1B2A]">
                          {option.label}
                        </span>
                        <span className="block text-[11px] text-[#64748B]">
                          {disabled
                            ? "Unavailable: no property-matched zoning document has supplied rules."
                            : option.body}
                        </span>
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
        </div>
      </details>

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
            Still to confirm for this erf
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

      <button
        type="button"
        onClick={() => {
          clearStoredBuildEnvelopeInputs(parcelId, userId);
          setOverrides({});
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset my answers
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

function SummaryRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[11px] font-semibold text-[#64748B]">{label}</dt>
        <dd className="text-right text-[13px] font-semibold text-[#0D1B2A]">{value}</dd>
      </div>
      {note ? <p className="mt-0.5 text-[10px] leading-4 text-[#64748B]">{note}</p> : null}
    </div>
  );
}
