import { createContext, useContext } from "react";
import type { Json } from "@/integrations/supabase/types";
import type { OrderInvestigation } from "./sharedInvestigation";
import type { ErfAsset, UploadErfAssetInput, uploadErfAsset } from "@/lib/workbench/erfFileVault";

export interface SharedInvestigationScope {
  snapshot: OrderInvestigation;
  busy: boolean;
  save: (patch: Json) => Promise<void>;
  refresh: () => Promise<void>;
  files: {
    upload: (input: Omit<UploadErfAssetInput, "parcelId" | "onProgress">) => ReturnType<typeof uploadErfAsset>;
    remove: (asset: ErfAsset) => Promise<void>;
    confirmIdentity: (asset: ErfAsset) => Promise<void>;
    open: (asset: ErfAsset) => Promise<void>;
  };
}
export const SharedInvestigationContext = createContext<SharedInvestigationScope | null>(null);
export function useSharedInvestigationScope(parcelId?: string) {
  const scope = useContext(SharedInvestigationContext);
  if (scope && parcelId && scope.snapshot.parcelId !== parcelId) throw new Error("The editor does not belong to the selected customer investigation.");
  return scope;
}
