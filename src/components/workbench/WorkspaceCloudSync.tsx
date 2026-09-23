import { useLayoutEffect } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  erfWorkspaceStateKey,
  readErfWorkspaceState,
  writeErfWorkspaceState,
  type ErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import { listErfAssets, type ErfAssetCategory } from "@/lib/workbench/erfFileVault";
import {
  patchSavedPropertyUserData,
  SavedPropertyConflictError,
} from "@/lib/workbench/savedPropertyUserData";
import {
  investigationSyncDecision,
  preserveInvestigationConflict,
  readInvestigationSyncBaseline,
  writeInvestigationSyncBaseline,
} from "@/lib/workbench/investigationSyncBaseline";
import {
  buildSavedInvestigationUserDataPatch,
  mergeSavedInvestigationProjectionIntoWorkspace,
  readSavedInvestigationProjection,
  FLUSH_INVESTIGATION_EVENT,
  type FlushInvestigationDetail,
} from "@/lib/workbench/savedInvestigationProjection";
import { readSitePotentialProject } from "@/lib/sitePotential/sitePotentialService";
import { buildCanonicalSitePotentialSnapshot } from "@/lib/sitePotential/sitePotentialSnapshotSync";
import { PLANNING_ZONE_UPDATED_EVENT } from "@/lib/planning/storedPlanningZone";
import { setInvestigationSaveNotice } from "./InvestigationSaveNotice";
import {
  BUILD_ENVELOPE_INPUTS_UPDATED_EVENT,
  parseStoredBuildEnvelopeInputs,
  readStoredBuildEnvelopeInputs,
  writeStoredBuildEnvelopeInputs,
} from "@/lib/sitePotential/buildEnvelopeStore";

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
export function WorkspaceCloudSync({
  userId,
  parcelId,
}: {
  userId: string | null;
  parcelId: string | null;
}) {
  const { user, loading } = useAuth();
  const accountId = user?.id ?? null;
  useLayoutEffect(() => {
    if (loading || !userId || !parcelId || accountId !== userId || typeof window === "undefined")
      return;
    if (parcelId.endsWith(":unknown") || parcelId.startsWith("official:point:")) return;
    const request = new AbortController();
    const cancelledError = () =>
      new Error(
        "The selected investigation changed before save confirmation. Your draft is retained; an already dispatched save may still finish.",
      );
    const assertCurrent = () => {
      if (request.signal.aborted) throw cancelledError();
    };
    const scope = { userId, signal: request.signal, assertCurrent };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let recheck: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let restoring = false;
    let conflicted = false;
    let loadingSaved = false;
    let loadedUserData: Record<string, unknown> | undefined;
    let loadFailure: unknown;
    let saves = Promise.resolve();
    const pendingFlushes = new Set<FlushInvestigationDetail>();
    const currentWorkspace = () => readErfWorkspaceState(parcelId, window.localStorage, userId);
    const notice = (failure: unknown, allowRestore = false) => {
      if (request.signal.aborted) return;
      setInvestigationSaveNotice(parcelId, userId, {
        message:
          failure instanceof Error
            ? failure.message
            : "The saved investigation could not be read. Your browser draft is retained.",
        ...(allowRestore ? { loadSaved: loadSavedVersion } : {}),
      });
    };
    const readSaved = async () => {
      assertCurrent();
      const { data, error } = await supabase
        .from("saved_properties")
        .select("id, user_id, parcel_id, user_data")
        .eq("user_id", userId)
        .eq("parcel_id", parcelId)
        .abortSignal(request.signal);
      assertCurrent();
      if (error || !Array.isArray(data))
        throw new Error(
          "The saved investigation could not be read. Your browser draft is retained.",
        );
      if (
        data.length > 1 ||
        data.some((row) => row.user_id !== userId || row.parcel_id !== parcelId)
      ) {
        throw new Error(
          "The saved investigation identity is ambiguous or mismatched. Your draft is unchanged.",
        );
      }
      const row = data[0];
      if (!row) return null;
      if (
        row.user_data !== null &&
        (typeof row.user_data !== "object" || Array.isArray(row.user_data))
      ) {
        throw new Error("The saved investigation is unreadable. Your draft is unchanged.");
      }
      const userData = (row.user_data ?? {}) as Record<string, unknown>;
      const projection = readSavedInvestigationProjection(userData);
      if (
        (projection && projection.parcelId !== parcelId) ||
        (userData.easyErfInvestigation != null && !projection)
      ) {
        throw new Error(
          "The saved investigation belongs to another property or is unreadable. Your draft is unchanged.",
        );
      }
      return { userData, projection };
    };
    // Suppress synchronous workspace events from read-only restoration, including
    // Site Potential reconciliation. Reading must never schedule a cloud write.
    const restore = (apply: () => void) => {
      assertCurrent();
      restoring = true;
      try {
        apply();
      } finally {
        restoring = false;
      }
    };
    async function loadSavedVersion() {
      if (loadingSaved) return;
      loadingSaved = true;
      try {
        assertCurrent();
        // Settle existing saves before an explicit restore changes their baseline.
        await saves.catch(() => {});
        assertCurrent();
        const saved = await readSaved();
        assertCurrent();
        if (!saved || (!saved.projection && !Object.hasOwn(saved.userData, "buildEnvelopeInputs")))
          throw new Error("No readable saved investigation was found. Your draft is unchanged.");
        const workspace = currentWorkspace();
        const inputs = parseStoredBuildEnvelopeInputs(saved.userData.buildEnvelopeInputs) ?? {};
        const remote = { easyErfInvestigation: saved.projection, buildEnvelopeInputs: inputs };
        preserveInvestigationConflict(
          window.localStorage,
          parcelId!,
          userId!,
          { workspace, buildEnvelopeInputs: readStoredBuildEnvelopeInputs(parcelId!, userId) },
          remote,
        );
        restore(() => {
          if (saved.projection)
            writeErfWorkspaceState(
              parcelId!,
              mergeSavedInvestigationProjectionIntoWorkspace(
                parcelId!,
                workspace,
                saved.projection,
              ),
              window.localStorage,
              userId,
            );
          writeStoredBuildEnvelopeInputs(parcelId!, inputs, userId);
          window.dispatchEvent(
            new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, { detail: { parcelId, userId } }),
          );
        });
        loadedUserData = saved.userData;
        writeInvestigationSyncBaseline(window.localStorage, parcelId!, userId!, remote);
        conflicted = false;
        loadFailure = undefined;
        setInvestigationSaveNotice(parcelId!, userId!, null);
      } catch (failure) {
        notice(failure, true);
      } finally {
        loadingSaved = false;
      }
    }
    const reconcile = async () => {
      assertCurrent();
      try {
        const project = await readSitePotentialProject(parcelId, scope);
        assertCurrent();
        if (!project) return currentWorkspace();
        const assets = await listErfAssets(parcelId, SITE_POTENTIAL_ASSET_CATEGORIES, scope);
        assertCurrent();
        const workspace = currentWorkspace();
        const snapshot = buildCanonicalSitePotentialSnapshot(
          workspace.sitePotential,
          project,
          assets,
        );
        if (!snapshot) return workspace;
        let next = workspace;
        restore(() => {
          next = writeErfWorkspaceState(
            parcelId,
            { ...workspace, sitePotential: snapshot },
            window.localStorage,
            userId,
          );
        });
        return next;
      } catch (failure) {
        assertCurrent();
        // Optional reconciliation failure does not authorize a different parcel.
        return currentWorkspace();
      }
    };
    const scheduleRecheck = (workspace: ErfWorkspaceState) => {
      assertCurrent();
      if (workspace.sitePotential.progressState !== "generating") {
        clearTimeout(recheck);
        recheck = undefined;
        attempts = 0;
        return;
      }
      if (recheck || attempts >= SITE_POTENTIAL_MAX_RECHECKS) return;
      recheck = setTimeout(() => {
        recheck = undefined;
        attempts++;
        void reconcile()
          .then(scheduleRecheck)
          .catch(() => {});
      }, SITE_POTENTIAL_RECHECK_MS);
    };
    const hydrate = async () => {
      const saved = await readSaved();
      assertCurrent();
      if (!saved) return; // Missing rows do not create work or erase drafts.
      const { userData, projection } = saved;
      loadedUserData = userData;
      const hasBrowser =
        window.localStorage.getItem(erfWorkspaceStateKey(parcelId, userId)) !== null;
      if (!projection && !hasBrowser) return;
      let workspace = currentWorkspace();
      const cloudInputs = Object.hasOwn(userData, "buildEnvelopeInputs")
        ? (parseStoredBuildEnvelopeInputs(userData.buildEnvelopeInputs) ?? {})
        : null;
      const local = {
        ...buildSavedInvestigationUserDataPatch(parcelId, workspace),
        buildEnvelopeInputs: readStoredBuildEnvelopeInputs(parcelId, userId),
      };
      const remote = { easyErfInvestigation: projection, buildEnvelopeInputs: cloudInputs };
      const decision = investigationSyncDecision(
        local,
        remote,
        readInvestigationSyncBaseline(window.localStorage, parcelId, userId),
        hasBrowser,
      );
      if (
        (projection || (cloudInputs && Object.keys(cloudInputs).length > 0)) &&
        decision === "conflict"
      ) {
        conflicted = true;
        notice(
          new Error(
            "This property's browser draft differs from its saved investigation. Neither version has been overwritten.",
          ),
          true,
        );
        return;
      }
      if (decision === "hydrate") {
        restore(() => {
          if (cloudInputs) writeStoredBuildEnvelopeInputs(parcelId, cloudInputs, userId);
          if (projection) {
            workspace = mergeSavedInvestigationProjectionIntoWorkspace(
              parcelId,
              workspace,
              projection,
            );
            writeErfWorkspaceState(parcelId, workspace, window.localStorage, userId);
            window.dispatchEvent(
              new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, {
                detail: { parcelId, userId, zoneCode: workspace.planning.zoneCode },
              }),
            );
          }
        });
        writeInvestigationSyncBaseline(window.localStorage, parcelId, userId, remote);
      }
      const reconciled = await reconcile();
      assertCurrent();
      scheduleRecheck(reconciled);
    };
    const hydration = hydrate().catch((failure) => {
      loadFailure = failure;
      notice(failure, true);
    });
    const sync = async () => {
      assertCurrent();
      if (loadFailure) throw loadFailure;
      if (conflicted || loadingSaved)
        throw new Error("Review the saved investigation before saving. Your draft is retained.");
      const saved = await readSaved();
      assertCurrent();
      if (!saved) throw new Error("This property is not saved. Your browser draft is retained.");
      if (!loadedUserData) {
        if (saved.projection) {
          conflicted = true;
          throw new Error("Reload the saved investigation before saving cloud changes.");
        }
        loadedUserData = saved.userData;
      }
      const workspace = await reconcile();
      assertCurrent();
      scheduleRecheck(workspace);
      const { data } = await supabase.auth.getSession();
      assertCurrent();
      if (data.session?.user.id !== userId || !data.session.access_token)
        throw new Error("The active account changed. No new save was dispatched.");
      const savedUserData = await patchSavedPropertyUserData(
        parcelId,
        {
          ...buildSavedInvestigationUserDataPatch(parcelId, workspace),
          buildEnvelopeInputs: readStoredBuildEnvelopeInputs(parcelId, userId),
        },
        supabase,
        loadedUserData,
        { accessToken: data.session.access_token, signal: request.signal, assertCurrent },
      );
      assertCurrent();
      loadedUserData = savedUserData;
      writeInvestigationSyncBaseline(window.localStorage, parcelId, userId, {
        easyErfInvestigation: savedUserData.easyErfInvestigation,
        buildEnvelopeInputs: savedUserData.buildEnvelopeInputs ?? null,
      });
      setInvestigationSaveNotice(parcelId, userId, null);
    };
    const queueSync = () => {
      assertCurrent();
      saves = saves
        .catch(() => {})
        .then(sync)
        .catch((failure) => {
          if (failure instanceof SavedPropertyConflictError) conflicted = true;
          notice(failure, failure instanceof SavedPropertyConflictError);
          throw failure;
        });
      return saves;
    };
    const onWorkspaceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceUpdatedDetail>).detail;
      if (
        request.signal.aborted ||
        detail?.userId !== userId ||
        detail.parcelId !== parcelId ||
        restoring
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void hydration.then(queueSync).catch(() => {});
      }, CLOUD_SYNC_DEBOUNCE_MS);
    };
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<FlushInvestigationDetail>).detail;
      if (request.signal.aborted || detail?.userId !== userId || detail.parcelId !== parcelId)
        return;
      detail.handled = true;
      pendingFlushes.add(detail);
      clearTimeout(timer);
      void hydration
        .then(() => {
          assertCurrent();
          if (!loadedUserData && detail.newlySavedUserData)
            loadedUserData = detail.newlySavedUserData;
          return queueSync();
        })
        .then(() => {
          assertCurrent();
          detail.resolve();
        })
        .catch(detail.reject)
        .finally(() => pendingFlushes.delete(detail));
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    window.addEventListener(BUILD_ENVELOPE_INPUTS_UPDATED_EVENT, onWorkspaceUpdated);
    window.addEventListener(FLUSH_INVESTIGATION_EVENT, onFlush);
    return () => {
      // A dispatched request may already have committed. Cancellation only
      // prevents further work and stale local acknowledgement/baseline writes.
      request.abort();
      clearTimeout(timer);
      clearTimeout(recheck);
      pendingFlushes.forEach((detail) => detail.reject(cancelledError()));
      pendingFlushes.clear();
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
      window.removeEventListener(BUILD_ENVELOPE_INPUTS_UPDATED_EVENT, onWorkspaceUpdated);
      window.removeEventListener(FLUSH_INVESTIGATION_EVENT, onFlush);
      setInvestigationSaveNotice(parcelId, userId, null);
    };
  }, [accountId, loading, userId, parcelId]);
  return null;
}

export default WorkspaceCloudSync;
