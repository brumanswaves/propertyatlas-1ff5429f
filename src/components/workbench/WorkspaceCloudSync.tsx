import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { readErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";

interface WorkspaceUpdatedDetail {
  parcelId?: unknown;
  userId?: unknown;
}

const WORKSPACE_UPDATED_EVENT = "erfstoep:workspace-updated";
const CLOUD_SYNC_DEBOUNCE_MS = 900;

/**
 * Mirrors the browser workspace into the existing saved-property user_data row.
 *
 * This is a dashboard projection only. The canonical workspace/evidence engines
 * remain unchanged and no second progress engine or database table is created.
 */
export function WorkspaceCloudSync() {
  const { user } = useAuth();
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    const userId = user?.id ?? null;
    if (!userId || typeof window === "undefined") return;

    const syncParcel = async (parcelId: string) => {
      const { data, error } = await supabase
        .from("saved_properties")
        .select("id")
        .eq("user_id", userId)
        .eq("parcel_id", parcelId)
        .maybeSingle();

      // Unsaved properties intentionally remain browser-only until the user
      // chooses to save them. RLS remains the database authorization boundary.
      if (error || !data) return;

      const workspace = readErfWorkspaceState(parcelId, undefined, userId);
      try {
        await patchSavedPropertyUserData(
          parcelId,
          buildSavedInvestigationUserDataPatch(parcelId, workspace),
        );
      } catch {
        // Dashboard mirroring must never interrupt the property investigation.
        // A later workspace update will retry naturally.
      }
    };

    const onWorkspaceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceUpdatedDetail>).detail;
      const parcelId = typeof detail?.parcelId === "string" ? detail.parcelId : null;
      const eventUserId = typeof detail?.userId === "string" ? detail.userId : null;
      if (!parcelId || (eventUserId && eventUserId !== userId)) return;

      const current = timers.get(parcelId);
      if (current) clearTimeout(current);
      timers.set(
        parcelId,
        setTimeout(() => {
          timers.delete(parcelId);
          void syncParcel(parcelId);
        }, CLOUD_SYNC_DEBOUNCE_MS),
      );
    };

    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    return () => {
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [user?.id]);

  return null;
}

export default WorkspaceCloudSync;
