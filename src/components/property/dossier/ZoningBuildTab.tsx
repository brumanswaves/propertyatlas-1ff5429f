import { useCallback, useEffect, useMemo, useState } from "react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import {
  findMunicipalityPlanningRegistry,
  listZones,
} from "@/lib/planning/municipalityPlanningRegistry";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import {
  PLANNING_ZONE_UPDATED_EVENT,
  readStoredPlanningZone,
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
  const { assets } = useErfFileVault(parcel.id);
  const [manualZoneCode, setManualZoneCode] = useState<string | null>(null);

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string }> | undefined)?.detail;
      if (detail?.parcelId && detail.parcelId !== parcel.id) return;
      setManualZoneCode(readStoredPlanningZone(parcel.id));
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcel.id]);

  const selectZone = useCallback(
    (code: string | null) => {
      setManualZoneCode(writeStoredPlanningZone(parcel.id, code));
    },
    [parcel.id],
  );

  const registry = useMemo(
    () => findMunicipalityPlanningRegistry(parcel.municipality ?? null),
    [parcel.municipality],
  );

  const zoneOptions = useMemo(
    () =>
      registry ? listZones(registry).map((zone) => ({ code: zone.code, name: zone.name })) : [],
    [registry],
  );

  const signals = useMemo(() => derivePlanningEvidenceSignals(assets), [assets]);

  const documentZone = useMemo(() => {
    if (!signals.zoningCertificateUploaded) return null;
    return assets.find((asset) => asset.asset_category === "zoning_document") ?? null;
  }, [assets, signals.zoningCertificateUploaded]);

  const assessment = useMemo(
    () =>
      buildParcelPlanningAssessment({
        parcelId: parcel.id,
        municipality: parcel.municipality ?? null,
        locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
        erfAreaM2: canonicalAreaM2(parcel.rawProperties),
        manualZoneCode,
        // A zoning certificate only supports the zone the user selected; the
        // document is never parsed into a zone code here.
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
    [documentZone, manualZoneCode, parcel, signals],
  );

  return (
    <ZoningBuildPanel
      assessment={assessment}
      zoneOptions={zoneOptions}
      selectedZoneCode={manualZoneCode}
      onSelectZone={selectZone}
      onOpenTab={onOpenTab}
      onAskEasyErf={onAskEasyErf}
      compact={compact}
    />
  );
}

export default ZoningBuildTab;
