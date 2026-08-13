import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import {
  findMunicipalityPlanningRegistry,
  findZone,
  listZones,
} from "@/lib/planning/municipalityPlanningRegistry";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { isUsableSubjectZoningDocument } from "@/lib/planning/zoningEvidence";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import { useAuth } from "@/lib/auth/useAuth";
import {
  PLANNING_ZONE_UPDATED_EVENT,
  confirmStoredPlanningZone,
  readStoredPlanningZoneState,
  writeStoredPlanningZone,
} from "@/lib/planning/storedPlanningZone";
import { ZoningBuildPanel } from "./ZoningBuildPanel";

/**
 * Zoning & Build workbench tab.
 *
 * The manual zone selection is a working assumption stored per parcel in the
 * browser. It is never presented as a confirmed municipal zoning.
 */

export interface ZoningBuildTabProps {
  parcel: NormalizedOfficialParcel;
  onOpenTab?: (tab: string) => void;
  onAskEasyErf?: (question: string) => void;
  compact?: boolean;
}

export function ZoningBuildTab({ parcel, onOpenTab, onAskEasyErf, compact }: ZoningBuildTabProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { assets } = useErfFileVault(parcel.id);
  const [manualZoneCode, setManualZoneCode] = useState<string | null>(null);
  const [userConfirmedZoneCode, setUserConfirmedZoneCode] = useState<string | null>(null);

  useLayoutEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string; userId?: string | null }> | undefined)
        ?.detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      if ((detail?.userId ?? null) !== userId) return;
      const planningState = readStoredPlanningZoneState(parcel.id, userId);
      setManualZoneCode(planningState.zoneCode);
      setUserConfirmedZoneCode(planningState.userConfirmedZoneCode);
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcel.id, userId]);

  const selectZone = useCallback(
    (code: string | null) => {
      const next = writeStoredPlanningZone(parcel.id, code, userId);
      setManualZoneCode(next.zoneCode);
      setUserConfirmedZoneCode(next.userConfirmedZoneCode);
    },
    [parcel.id, userId],
  );

  const confirmZone = useCallback(() => {
    const next = confirmStoredPlanningZone(parcel.id, userId);
    setManualZoneCode(next.zoneCode);
    setUserConfirmedZoneCode(next.userConfirmedZoneCode);
  }, [parcel.id, userId]);

  const registry = useMemo(
    () => findMunicipalityPlanningRegistry(parcel.municipality ?? null),
    [parcel.municipality],
  );

  const zoneOptions = useMemo(
    () =>
      registry ? listZones(registry).map((zone) => ({ code: zone.code, name: zone.name })) : [],
    [registry],
  );
  const selectedZone = useMemo(
    () => (registry ? findZone(registry, manualZoneCode) : null),
    [manualZoneCode, registry],
  );

  const documentZone = useMemo(
    () =>
      selectedZone
        ? (assets.find((asset) => isUsableSubjectZoningDocument(asset, selectedZone)) ?? null)
        : null,
    [assets, selectedZone],
  );
  const signals = useMemo(
    () =>
      derivePlanningEvidenceSignals(assets, {
        zoningCertificateUploaded: Boolean(documentZone),
      }),
    [assets, documentZone],
  );

  const assessment = useMemo(
    () =>
      buildParcelPlanningAssessment({
        parcelId: parcel.id,
        municipality: parcel.municipality ?? null,
        locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
        erfAreaM2: canonicalAreaM2(parcel.rawProperties),
        manualZoneCode,
        userConfirmedZoneCode,
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
      }),
    [documentZone, manualZoneCode, parcel, signals, userConfirmedZoneCode],
  );

  return (
    <ZoningBuildPanel
      assessment={assessment}
      zoneOptions={zoneOptions}
      selectedZoneCode={manualZoneCode}
      onSelectZone={selectZone}
      onConfirmZone={confirmZone}
      onOpenTab={onOpenTab}
      onAskEasyErf={onAskEasyErf}
      compact={compact}
    />
  );
}

export default ZoningBuildTab;
