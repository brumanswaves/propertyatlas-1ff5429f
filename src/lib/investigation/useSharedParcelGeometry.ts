import { useEffect, useMemo, useState } from "react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { isValidParcelRing } from "@/lib/sitePotential/parcelRing";
import { recoverSharedParcelGeometry, type RecoveredParcelGeometry } from "./sharedParcelGeometry";

export function useSharedParcelGeometry(
  parcel: NormalizedOfficialParcel,
  ring: unknown,
  binding: string | null,
) {
  const saved = isValidParcelRing(ring);
  const lifetime = useMemo(() => ({ binding, parcelId: parcel.id }), [binding, parcel.id]);
  const [result, setResult] = useState<{
    lifetime: typeof lifetime;
    candidate: RecoveredParcelGeometry | null;
  } | null>(null);
  useEffect(() => {
    if (!binding || saved) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setResult({ lifetime, candidate: null });
    }, 10000);
    void recoverSharedParcelGeometry(parcel, controller.signal).then(
      (candidate) => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setResult({ lifetime, candidate });
      },
      () => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setResult({ lifetime, candidate: null });
      },
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [binding, saved, lifetime, parcel]);
  const current = result?.lifetime === lifetime ? result : null;
  return {
    candidate: saved ? null : (current?.candidate ?? null),
    loading: Boolean(binding && !saved && !current),
  };
}
