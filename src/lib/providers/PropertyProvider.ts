import type {
  NormalizedProperty,
  NormalizedOwnership,
  NormalizedValuation,
  NormalizedTransfer,
  NormalizedGeometry,
  ProviderMeta,
  ProviderHealth,
} from "./types";

export interface SearchInput {
  query: string;
  limit?: number;
}

export interface PropertyProvider {
  readonly meta: ProviderMeta;

  searchProperties(input: SearchInput): Promise<NormalizedProperty[]>;
  getProperty(id: string): Promise<NormalizedProperty | null>;
  getGeometry(id: string): Promise<NormalizedGeometry | null>;
  getOwnership(id: string): Promise<NormalizedOwnership | null>;
  getValuation(id: string): Promise<NormalizedValuation | null>;
  getTransfers(id: string): Promise<NormalizedTransfer[]>;
  getReports(id: string): Promise<string[]>;

  health(): Promise<ProviderHealth>;
}
