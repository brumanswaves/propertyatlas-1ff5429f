import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { useSharedInvestigationScope } from "@/lib/investigation/sharedInvestigationContext";
import {
  createErfAssetSignedUrl,
  confirmErfAssetIdentityForParcel,
  deleteErfAsset,
  listErfAssets,
  migrateLocalWorkspaceAttachmentsToVault,
  uploadErfAsset,
  type ErfAsset,
  type ErfAssetCategory,
  type UploadErfAssetInput,
  type VaultMigrationResult,
} from "./erfFileVault";

export interface VaultUploadState {
  progress: number;
  label: string;
}

export const ERF_FILE_VAULT_UPDATED_EVENT = "erfstoep:file-vault-updated";

export function dispatchErfFileVaultUpdated(parcelId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ERF_FILE_VAULT_UPDATED_EVENT, {
      detail: { parcelId },
    }),
  );
}

export function useErfFileVault(parcelId: string, categories?: ErfAssetCategory[]) {
  const shared = useSharedInvestigationScope(parcelId);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const categoryFilter = categories?.join("|") ?? "";
  const [assets, setAssets] = useState<ErfAsset[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<VaultUploadState | null>(null);
  const [migration, setMigration] = useState<VaultMigrationResult | null>(null);

  const refresh = useCallback(async () => {
    if (shared) { await shared.refresh(); return; }
    if (!userId) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listErfAssets(
        parcelId,
        categoryFilter ? (categoryFilter.split("|") as ErfAssetCategory[]) : undefined,
      );
      setAssets(next);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load files.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, parcelId, userId, shared]);

  useEffect(() => {
    if (!shared) void refresh();
  }, [refresh, shared]);

  useEffect(() => {
    if (shared) return;
    function refreshFromVaultEvent(event: Event) {
      const detail = (event as CustomEvent<{ parcelId?: string }>).detail;
      if (detail?.parcelId !== parcelId) return;
      void refresh();
    }

    window.addEventListener(ERF_FILE_VAULT_UPDATED_EVENT, refreshFromVaultEvent);
    return () => window.removeEventListener(ERF_FILE_VAULT_UPDATED_EVENT, refreshFromVaultEvent);
  }, [parcelId, refresh, shared]);

  const upload = useCallback(
    async (input: Omit<UploadErfAssetInput, "parcelId" | "onProgress">) => {
      if (shared) return shared.files.upload(input);
      if (!userId) throw new Error("Sign in to upload files to the Erf File Vault.");
      setError(null);
      setUploadState({ progress: 0, label: "Preparing upload" });
      try {
        const result = await uploadErfAsset({
          ...input,
          parcelId,
          onProgress: (progress, label) => setUploadState({ progress, label }),
        });
        if (!result.ok) return result;
        await refresh();
        dispatchErfFileVaultUpdated(parcelId);
        return result;
      } finally {
        setUploadState(null);
      }
    },
    [parcelId, refresh, userId, shared],
  );

  const remove = useCallback(
    async (asset: ErfAsset) => {
      if (shared) { await shared.files.remove(asset); return; }
      await deleteErfAsset(asset);
      await refresh();
      dispatchErfFileVaultUpdated(parcelId);
    },
    [parcelId, refresh, shared],
  );

  const open = useCallback(async (asset: ErfAsset) => {
    if (shared) { await shared.files.open(asset); return; }
    const url = await createErfAssetSignedUrl(asset);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [shared]);

  const confirmIdentity = useCallback(
    async (asset: ErfAsset) => {
      if (shared) { await shared.files.confirmIdentity(asset); return; }
      await confirmErfAssetIdentityForParcel(asset);
      await refresh();
      dispatchErfFileVaultUpdated(parcelId);
    },
    [parcelId, refresh, shared],
  );

  const migrateLocalAttachments = useCallback(async () => {
    if (shared) return null;
    if (!userId) return null;
    const result = await migrateLocalWorkspaceAttachmentsToVault(parcelId);
    setMigration(result);
    await refresh();
    dispatchErfFileVaultUpdated(parcelId);
    return result;
  }, [parcelId, refresh, userId, shared]);

  return {
    assets: shared ? shared.snapshot.assets.filter((asset) => !categories || categories.includes(asset.asset_category)) : assets,
    loading: shared ? false : loading,
    error,
    uploadState,
    migration,
    signedIn: Boolean(userId),
    refresh,
    upload,
    remove,
    open,
    confirmIdentity,
    migrateLocalAttachments,
    investigationOrderId: shared?.snapshot.orderId,
  };
}
