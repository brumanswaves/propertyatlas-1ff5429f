import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  erfWorkspaceStateKey,
  readErfWorkspaceState,
  writeErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import { patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import {
  buildSavedInvestigationUserDataPatch,
  mergeSavedInvestigationProjectionIntoWorkspace,
  readSavedInvestigationProjection,
  shouldHydrateSavedInvestigationProjection,
} from "@/lib/workbench/savedInvestigationProjection";

interface WorkspaceUpdatedDetail {
  parcelId?: unknown;
  userId?: unknown;
}

const WORKSPACE_UPDATED_EVENT = "erfstoep:workspace-updated";
const CLOUD_SYNC_DEBOUNCE_MS = 900;

/**
 * Keeps the browser workspace and the durable saved-property investigation
 * projection aligned for signed-in users.
 *
 * The existing workspace remains the only in-app state model. Supabase stores
 * the durable projection so zoning confirmation, Site Potential selection and
 * report progress can be restored after a refresh or on another browser.
 */
export function WorkspaceCloudSync() {
  const { user } = useAuth();
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    const userId = user?.id ?? null;
    if (!userId || typeof window === "undefined") return;
    let cancelled = false;

    const hydrateSavedInvestigations = async () => {
      const { data, error } = await supabase
        .from("saved_properties")
        .select("parcel_id, user_data")
        .eq("user_id", userId);
      if (cancelled || error || !data) return;

      for (const row of data) {
        const parcelId = typeof row.parcel_id === "string" ? row.parcel_id : null;
        if (!parcelId) continue;
        const projection = readSavedInvestigationProjection(row.user_data);
        if (!projection || projection.parcelId !== parcelId) continue;

        let hasStoredBrowserWorkspace = false;
        try {
          hasStoredBrowserWorkspace =
            window.localStorage.getItem(erfWorkspaceStateKey(parcelId, userId)) !== null;
        } catch {
          // If browser storage is unavailable there is nowhere safe to hydrate.
          continue;
        }

        const browserWorkspace = readErfWorkspaceState(parcelId, window.localStorage, userId);
        if (
          !shouldHydrateSavedInvestigationProjection({
            hasStoredBrowserWorkspace,
            browserWorkspace,
            projection,
          })
        ) {
          continue;
        }

        const hydrated = mergeSavedInvestigationProjectionIntoWorkspace(
          parcelId,
          browserWorkspace,
          projection,
        );
        writeErfWorkspaceState(parcelId, hydrated, window.localStorage, userId);
      }
    };

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
        // Cloud mirroring must never interrupt the property investigation.
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
    void hydrateSavedInvestigations();

    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [user?.id]);

  return null;
}

export default WorkspaceCloudSync;
