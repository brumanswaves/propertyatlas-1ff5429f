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

export function useErfFileVault(parcelId: string, categories?: ErfAssetCategory[]) {
  const { user } = useAuth();
  const categoryFilter = categories?.join("|") ?? "";
  const [assets, setAssets] = useState<ErfAsset[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<VaultUploadState | null>(null);
  const [migration, setMigration] = useState<VaultMigrationResult | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
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
  }, [categoryFilter, parcelId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (input: Omit<UploadErfAssetInput, "parcelId" | "onProgress">) => {
      if (!user) throw new Error("Sign in to upload files to the Erf File Vault.");
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
        return result;
      } finally {
        setUploadState(null);
      }
    },
    [parcelId, refresh, user],
  );

  const remove = useCallback(
    async (asset: ErfAsset) => {
      await deleteErfAsset(asset);
      await refresh();
    },
    [refresh],
  );

  const open = useCallback(async (asset: ErfAsset) => {
    const url = await createErfAssetSignedUrl(asset);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const migrateLocalAttachments = useCallback(async () => {
    if (!user) return null;
    const result = await migrateLocalWorkspaceAttachmentsToVault(parcelId);
    setMigration(result);
    await refresh();
    return result;
  }, [parcelId, refresh, user]);

  return {
    assets,
    loading,
    error,
    uploadState,
    migration,
    signedIn: Boolean(user),
    refresh,
    upload,
    remove,
    open,
    migrateLocalAttachments,
  };
}
