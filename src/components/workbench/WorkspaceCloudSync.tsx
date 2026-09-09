import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  erfWorkspaceStateKey,
  readErfWorkspaceState,
  writeErfWorkspaceState,
  type ErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import {
  listErfAssets,
  type ErfAssetCategory,
} from "@/lib/workbench/erfFileVault";
import { patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import {
  buildSavedInvestigationUserDataPatch,
  mergeSavedInvestigationProjectionIntoWorkspace,
  readSavedInvestigationProjection,
  shouldHydrateSavedInvestigationProjection,
  savedInvestigationMatchesWorkspace,
  FLUSH_INVESTIGATION_EVENT,
  type FlushInvestigationDetail,
} from "@/lib/workbench/savedInvestigationProjection";
import { readSitePotentialProject } from "@/lib/sitePotential/sitePotentialService";
import { buildCanonicalSitePotentialSnapshot } from "@/lib/sitePotential/sitePotentialSnapshotSync";
import { PLANNING_ZONE_UPDATED_EVENT } from "@/lib/planning/storedPlanningZone";
import { toast } from "sonner";
import { BUILD_ENVELOPE_INPUTS_UPDATED_EVENT, parseStoredBuildEnvelopeInputs, readStoredBuildEnvelopeInputs, writeStoredBuildEnvelopeInputs } from "@/lib/sitePotential/buildEnvelopeStore";

interface WorkspaceUpdatedDetail {
  parcelId?: unknown;
  userId?: unknown;
}

const WORKSPACE_UPDATED_EVENT = "erfstoep:workspace-updated";
const CLOUD_SYNC_DEBOUNCE_MS = 900;
const SITE_POTENTIAL_RECHECK_MS = 15_000;
const SITE_POTENTIAL_MAX_RECHECKS = 40;
const SITE_POTENTIAL_ASSET_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "inspiration_image",
  "other",
  "generated_design",
];

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
  const sitePotentialTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sitePotentialAttemptsRef = useRef(new Map<string, number>());

  useEffect(() => {
    const timers = timersRef.current;
    const sitePotentialTimers = sitePotentialTimersRef.current;
    const sitePotentialAttempts = sitePotentialAttemptsRef.current;
    const userId = user?.id ?? null;
    if (!userId || typeof window === "undefined") return;
    let cancelled = false;
    const loadedUserData = new Map<string, Record<string, unknown>>();
    const conflicted = new Set<string>();
    const restoring = new Set<string>();
    const saves = new Map<string, Promise<void>>();

    const reconcileSitePotentialParcel = async (parcelId: string) => {
      const currentWorkspace = readErfWorkspaceState(parcelId, window.localStorage, userId);
      try {
        const project = await readSitePotentialProject(parcelId);
        if (cancelled || !project) return currentWorkspace;
        const assets = await listErfAssets(parcelId, SITE_POTENTIAL_ASSET_CATEGORIES);
        if (cancelled) return currentWorkspace;
        const nextSitePotential = buildCanonicalSitePotentialSnapshot(
          currentWorkspace.sitePotential,
          project,
          assets,
        );
        if (!nextSitePotential) return currentWorkspace;

        return writeErfWorkspaceState(
          parcelId,
          {
            ...currentWorkspace,
            sitePotential: nextSitePotential,
          },
          window.localStorage,
          userId,
        );
      } catch {
        // Site Potential reconciliation is best-effort. Existing workspace and
        // cloud sync remain usable when the backend is temporarily unavailable.
        return currentWorkspace;
      }
    };

    const clearSitePotentialRecheck = (parcelId: string) => {
      const timer = sitePotentialTimers.get(parcelId);
      if (timer) clearTimeout(timer);
      sitePotentialTimers.delete(parcelId);
      sitePotentialAttempts.delete(parcelId);
    };

    const scheduleSitePotentialRecheck = (
      parcelId: string,
      workspace: ErfWorkspaceState,
    ) => {
      if (workspace.sitePotential.progressState !== "generating") {
        clearSitePotentialRecheck(parcelId);
        return;
      }
      if (sitePotentialTimers.has(parcelId)) return;
      const attempt = sitePotentialAttempts.get(parcelId) ?? 0;
      if (attempt >= SITE_POTENTIAL_MAX_RECHECKS) return;

      sitePotentialTimers.set(
        parcelId,
        setTimeout(() => {
          sitePotentialTimers.delete(parcelId);
          sitePotentialAttempts.set(parcelId, attempt + 1);
          void reconcileSitePotentialParcel(parcelId).then((nextWorkspace) => {
            if (cancelled) return;
            scheduleSitePotentialRecheck(parcelId, nextWorkspace);
          });
        }, SITE_POTENTIAL_RECHECK_MS),
      );
    };

    const hydrateSavedInvestigations = async () => {
      const { data, error } = await supabase
        .from("saved_properties")
        .select("parcel_id, user_data")
        .eq("user_id", userId);
      if (cancelled || error || !data) return;

      for (const row of data) {
        const parcelId = typeof row.parcel_id === "string" ? row.parcel_id : null;
        if (!parcelId) continue;
        if (row.user_data && typeof row.user_data === "object" && !Array.isArray(row.user_data)) {
          loadedUserData.set(parcelId, row.user_data);
        }
        const projection = readSavedInvestigationProjection(row.user_data);
        const userData = loadedUserData.get(parcelId);

        let hasStoredBrowserWorkspace = false;
        try {
          hasStoredBrowserWorkspace =
            window.localStorage.getItem(erfWorkspaceStateKey(parcelId, userId)) !== null;
        } catch {
          // If browser storage is unavailable there is nowhere safe to hydrate.
          continue;
        }

        const hasUsableProjection = Boolean(projection && projection.parcelId === parcelId);
        if (!hasUsableProjection && !hasStoredBrowserWorkspace) {
          // Preserve the pre-existing behavior for rows without a readable
          // durable projection. Do not manufacture a new workspace from only
          // one backend subsystem and risk replacing unrelated investigation state.
          continue;
        }

        let browserWorkspace = readErfWorkspaceState(parcelId, window.localStorage, userId);
        const cloudInputs = userData && Object.hasOwn(userData, "buildEnvelopeInputs")
          ? parseStoredBuildEnvelopeInputs(userData.buildEnvelopeInputs) ?? {} : null;
        const browserInputs = readStoredBuildEnvelopeInputs(parcelId, userId);
        const inputsDiffer = cloudInputs && browserInputs && JSON.stringify(cloudInputs) !== JSON.stringify(browserInputs);
        const shouldHydrate = projection && projection.parcelId === parcelId &&
          shouldHydrateSavedInvestigationProjection({ hasStoredBrowserWorkspace, browserWorkspace, projection });
        if (projection && projection.parcelId === parcelId && !shouldHydrate &&
            (!savedInvestigationMatchesWorkspace(parcelId, browserWorkspace, projection) || inputsDiffer)) {
          // A newer browser timestamp is not a known cloud baseline. Keep both
          // versions and require an explicit choice instead of silently rebasing.
          conflicted.add(parcelId);
          toast.error("This browser has changes that differ from the saved investigation. Cloud saving is paused.", {
            action: { label: "Load saved version", onClick: () => {
              if (cancelled) return;
              restoring.add(parcelId);
              writeErfWorkspaceState(parcelId, mergeSavedInvestigationProjectionIntoWorkspace(
                parcelId, readErfWorkspaceState(parcelId, window.localStorage, userId), projection), window.localStorage, userId);
              if (cloudInputs) writeStoredBuildEnvelopeInputs(parcelId, cloudInputs, userId);
              window.dispatchEvent(new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, { detail: { parcelId, userId, zoneCode: projection.planning.zoneCode } }));
              restoring.delete(parcelId);
              conflicted.delete(parcelId);
            } },
          });
          continue;
        }
        if (cloudInputs) {
          restoring.add(parcelId);
          writeStoredBuildEnvelopeInputs(parcelId, cloudInputs, userId);
          restoring.delete(parcelId);
        }
        if (
          projection &&
          projection.parcelId === parcelId &&
          shouldHydrate
        ) {
          browserWorkspace = mergeSavedInvestigationProjectionIntoWorkspace(
            parcelId,
            browserWorkspace,
            projection,
          );
          restoring.add(parcelId);
          writeErfWorkspaceState(parcelId, browserWorkspace, window.localStorage, userId);
          window.dispatchEvent(
            new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, {
              detail: { parcelId, userId, zoneCode: browserWorkspace.planning.zoneCode },
            }),
          );
          restoring.delete(parcelId);
        }

        const reconciledWorkspace = await reconcileSitePotentialParcel(parcelId);
        if (cancelled) return;
        scheduleSitePotentialRecheck(parcelId, reconciledWorkspace);
      }
    };

    const syncParcel = async (parcelId: string) => {
      if (cancelled || conflicted.has(parcelId)) throw new Error("Reload the investigation before saving.");
      const { data, error } = await supabase
        .from("saved_properties")
        .select("id, user_data")
        .eq("user_id", userId)
        .eq("parcel_id", parcelId)
        .maybeSingle();

      // Unsaved properties intentionally remain browser-only until the user
      // chooses to save them. RLS remains the database authorization boundary.
      if (cancelled || error) throw new Error("The saved investigation could not be checked.");
      if (!data) return;
      if (!loadedUserData.has(parcelId)) {
        if (readSavedInvestigationProjection(data.user_data)) {
          conflicted.add(parcelId);
          throw new Error("This saved investigation must be reloaded before cloud changes can be saved.");
        }
        loadedUserData.set(parcelId, data.user_data && typeof data.user_data === "object" && !Array.isArray(data.user_data) ? data.user_data : {});
      }

      const workspace = await reconcileSitePotentialParcel(parcelId);
      if (cancelled) throw new Error("The active investigation changed.");
      scheduleSitePotentialRecheck(parcelId, workspace);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled || sessionData.session?.user.id !== userId) throw new Error("The active account changed. Nothing was saved.");
        const savedUserData = await patchSavedPropertyUserData(
          parcelId,
          { ...buildSavedInvestigationUserDataPatch(parcelId, workspace),
            buildEnvelopeInputs: readStoredBuildEnvelopeInputs(parcelId, userId) },
          supabase,
          loadedUserData.get(parcelId),
        );
        if (!cancelled) loadedUserData.set(parcelId, savedUserData);
      } catch (failure) {
        if (cancelled) throw failure;
        conflicted.add(parcelId);
        toast.error(failure instanceof Error ? failure.message : "Cloud changes were not saved. Reload the investigation before retrying.");
        throw failure;
      }
    };
    const queueSync = (parcelId: string) => {
      const next = (saves.get(parcelId) ?? Promise.resolve()).catch(() => {}).then(() => syncParcel(parcelId));
      saves.set(parcelId, next);
      return next;
    };

    const onWorkspaceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceUpdatedDetail>).detail;
      const parcelId = typeof detail?.parcelId === "string" ? detail.parcelId : null;
      const eventUserId = typeof detail?.userId === "string" ? detail.userId : null;
      if (!parcelId || eventUserId !== userId) return;
      if (restoring.has(parcelId)) return;

      const workspace = readErfWorkspaceState(parcelId, window.localStorage, userId);
      scheduleSitePotentialRecheck(parcelId, workspace);

      const current = timers.get(parcelId);
      if (current) clearTimeout(current);
      timers.set(
        parcelId,
        setTimeout(() => {
          timers.delete(parcelId);
          void hydration.then(() => queueSync(parcelId)).catch(() => {});
        }, CLOUD_SYNC_DEBOUNCE_MS),
      );
    };

    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    window.addEventListener(BUILD_ENVELOPE_INPUTS_UPDATED_EVENT, onWorkspaceUpdated);
    const hydration = hydrateSavedInvestigations();
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<FlushInvestigationDetail>).detail;
      if (!detail || detail.userId !== userId || cancelled) return;
      detail.handled = true;
      const timer = timers.get(detail.parcelId);
      if (timer) clearTimeout(timer);
      timers.delete(detail.parcelId);
      void hydration.then(() => {
        if (!loadedUserData.has(detail.parcelId) && detail.newlySavedUserData) loadedUserData.set(detail.parcelId, detail.newlySavedUserData);
        return queueSync(detail.parcelId);
      }).then(detail.resolve, detail.reject);
    };
    window.addEventListener(FLUSH_INVESTIGATION_EVENT, onFlush);

    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
      window.removeEventListener(BUILD_ENVELOPE_INPUTS_UPDATED_EVENT, onWorkspaceUpdated);
      window.removeEventListener(FLUSH_INVESTIGATION_EVENT, onFlush);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      sitePotentialTimers.forEach((timer) => clearTimeout(timer));
      sitePotentialTimers.clear();
      sitePotentialAttempts.clear();
    };
  }, [user?.id]);

  return null;
}

export default WorkspaceCloudSync;
