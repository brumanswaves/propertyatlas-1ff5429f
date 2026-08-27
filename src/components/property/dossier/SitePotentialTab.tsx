import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, FileWarning } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import {
  findMunicipalityPlanningRegistry,
  findZone,
} from "@/lib/planning/municipalityPlanningRegistry";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { readStoredPlanningZone } from "@/lib/planning/storedPlanningZone";
import { isUsableSubjectZoningDocument } from "@/lib/planning/zoningEvidence";
import { readStoredBuildEnvelopeInputs } from "@/lib/sitePotential/buildEnvelopeStore";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { VacantLandBuildEnvelope } from "@/components/property/sitePotential/VacantLandBuildEnvelope";
import { StreetSideBuildEnvelope } from "@/components/property/sitePotential/StreetSideBuildEnvelope";
import { useAuth } from "@/lib/auth/useAuth";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfWorkspaceState, SitePotentialSnapshot } from "@/lib/workbench/erfWorkspaceState";

export interface SitePotentialTabProps {
  parcel: NormalizedOfficialParcel;
  /** Official parcel exterior ring, used for the deterministic build envelope. */
  parcelRing?: Array<[number, number]> | null;
  recordedAreaM2?: number | null;
  workspaceState: ErfWorkspaceState;
  onUpdateSite: (patch: Partial<SitePotentialSnapshot>) => void;
  onExploreReport?: () => void;
  /** Lets the build-envelope next-best-action jump straight to another workbench tab. */
  onOpenTab?: (tab: string) => void;
  guidedReturn?: {
    onBack: () => void;
    onContinue: () => void;
  };
}

export function SitePotentialTab({
  parcel,
  parcelRing = null,
  recordedAreaM2 = null,
  workspaceState,
  onUpdateSite,
  onExploreReport,
  onOpenTab,
  guidedReturn,
}: SitePotentialTabProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const vault = useErfFileVault(parcel.id);
  const [envelopeResult, setEnvelopeResult] = useState<BuildEnvelopeResult | null>(null);
  const [acceptedEnvelope, setAcceptedEnvelope] = useState(false);

  const manualZoneCode = useMemo(
    () => workspaceState.planning.zoneCode ?? readStoredPlanningZone(parcel.id, userId),
    [parcel.id, userId, workspaceState.planning.zoneCode],
  );

  const planningAssessment = useMemo(() => {
    const registry = findMunicipalityPlanningRegistry(parcel.municipality ?? null);
    const selectedZone = registry ? findZone(registry, manualZoneCode) : null;
    const documentZone = selectedZone
      ? (vault.assets.find((asset) => isUsableSubjectZoningDocument(asset, selectedZone)) ?? null)
      : null;
    const signals = derivePlanningEvidenceSignals(vault.assets, {
      zoningCertificateUploaded: Boolean(documentZone),
    });

    return buildParcelPlanningAssessment({
      parcelId: parcel.id,
      municipality: parcel.municipality ?? null,
      locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
      erfAreaM2: canonicalAreaM2(parcel.rawProperties),
      manualZoneCode,
      userConfirmedZoneCode: workspaceState.planning.userConfirmedZoneCode,
      documentZoneCode: documentZone && manualZoneCode ? manualZoneCode : null,
      documentZoneAssetId: documentZone?.id ?? null,
      observedZoneLabel:
        typeof parcel.rawProperties?.ZONING_DES === "string"
          ? parcel.rawProperties.ZONING_DES
          : typeof parcel.rawProperties?.ZONING === "string"
            ? parcel.rawProperties.ZONING
            : null,
      hasParcelPolygon: Boolean(parcel.rawProperties),
      hasStreetEdgeReference: false,
      evidence: signals,
    });
  }, [manualZoneCode, parcel, vault.assets, workspaceState.planning.userConfirmedZoneCode]);

  const documentRuleEvidence =
    planningAssessment.detection.method === "document_supported" ||
    planningAssessment.detection.method === "official_polygon";

  const handleEnvelopeResult = useCallback(
    (result: BuildEnvelopeResult) => {
      setEnvelopeResult(result);
      const stored = readStoredBuildEnvelopeInputs(parcel.id, userId);
      setAcceptedEnvelope(
        Boolean(
          stored?.boundaryConfirmed &&
            stored.streetFrontageConfirmedByUser &&
            (result.envelopePolygon || result.coverageFootprint),
        ),
      );
    },
    [parcel.id, userId],
  );

  const identityLine = useMemo(() => {
    const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
    const area = parcel.suburbOrArea ?? parcel.town ?? parcel.municipality ?? null;
    return area ? `${erf} - ${area}` : erf;
  }, [parcel]);

  function skipSitePotential() {
    onUpdateSite({
      mode: "skipped",
      skipped: true,
      progressState: "skipped",
    });
    guidedReturn?.onContinue();
  }

  return (
    <div className="space-y-5">
      {guidedReturn ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Guided Investigation / Site Potential
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            Confirm the buildable part of the erf
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            Confirm the parcel boundary and street-facing boundary. Easy Erf then shows the
            buildable envelope on the map and the same limits from the street side.
          </p>
        </section>
      ) : null}

      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
              Site Potential
            </span>
            <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">
              Where could a building potentially fit?
            </h2>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">
              {identityLine}. Site Potential uses parcel geometry and recorded planning controls.
              There are no AI house concepts, generated renders, or facade images in this workflow.
            </p>
          </div>
          <div className="min-w-[240px] rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-[12px] text-[#0D1B2A]/72">
            <div className="flex items-center gap-2 font-semibold text-[#0D1B2A]">
              {acceptedEnvelope ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <FileWarning className="h-4 w-4 text-[#FF6A00]" />
              )}
              {acceptedEnvelope ? "Build envelope accepted" : "Confirm the site inputs"}
            </div>
            <div className="mt-1 text-[11px] leading-5 text-[#64748B]">
              The envelope remains indicative until the underlying zoning, title conditions,
              servitudes and approvals are property-specific and supported.
            </div>
          </div>
        </div>
      </header>

      <VacantLandBuildEnvelope
        parcelId={parcel.id}
        parcelLabel={parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "this erf"}
        ring={parcelRing}
        recordedAreaM2={recordedAreaM2}
        zoneLabel={planningAssessment.zone?.name ?? null}
        assessment={planningAssessment}
        documentRuleEvidence={documentRuleEvidence}
        lpiCode={parcel.lpi ?? null}
        onOpenTab={onOpenTab}
        onResultChange={handleEnvelopeResult}
      />

      <StreetSideBuildEnvelope result={envelopeResult} />

      {guidedReturn ? (
        <section className="flex flex-col gap-3 rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={guidedReturn.onBack}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
          >
            Back to investigation
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={skipSitePotential}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
            >
              Skip Site Potential
            </button>
            <button
              type="button"
              onClick={guidedReturn.onContinue}
              disabled={!acceptedEnvelope}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Continue to report
            </button>
          </div>
        </section>
      ) : onExploreReport ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onExploreReport}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0D1B2A] px-5 py-2 text-xs font-semibold text-white"
          >
            Review report
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default SitePotentialTab;
