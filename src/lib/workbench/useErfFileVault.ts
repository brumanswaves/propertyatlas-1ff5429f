import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import {
  createErfAssetSignedUrl,
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const categoryFilter = categories?.join("|") ?? "";
  const [assets, setAssets] = useState<ErfAsset[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<VaultUploadState | null>(null);
  const [migration, setMigration] = useState<VaultMigrationResult | null>(null);

  const refresh = useCallback(async () => {
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
  }, [categoryFilter, parcelId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function refreshFromVaultEvent(event: Event) {
      const detail = (event as CustomEvent<{ parcelId?: string }>).detail;
      if (detail?.parcelId !== parcelId) return;
      void refresh();
    }

    window.addEventListener(ERF_FILE_VAULT_UPDATED_EVENT, refreshFromVaultEvent);
    return () => window.removeEventListener(ERF_FILE_VAULT_UPDATED_EVENT, refreshFromVaultEvent);
  }, [parcelId, refresh]);

  const upload = useCallback(
    async (input: Omit<UploadErfAssetInput, "parcelId" | "onProgress">) => {
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
    [parcelId, refresh, userId],
  );

  const remove = useCallback(
    async (asset: ErfAsset) => {
      await deleteErfAsset(asset);
      await refresh();
      dispatchErfFileVaultUpdated(parcelId);
    },
    [parcelId, refresh],
  );

  const open = useCallback(async (asset: ErfAsset) => {
    const url = await createErfAssetSignedUrl(asset);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const migrateLocalAttachments = useCallback(async () => {
    if (!userId) return null;
    const result = await migrateLocalWorkspaceAttachmentsToVault(parcelId);
    setMigration(result);
    await refresh();
    dispatchErfFileVaultUpdated(parcelId);
    return result;
  }, [parcelId, refresh, userId]);

  return {
    assets,
    loading,
    error,
    uploadState,
    migration,
    signedIn: Boolean(userId),
    refresh,
    upload,
    remove,
    open,
    migrateLocalAttachments,
  };
}
