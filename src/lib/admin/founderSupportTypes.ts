import type { SavedInvestigationProjectionV1 } from "@/lib/workbench/savedInvestigationProjection";

export interface FounderSupportUserSummary {
  id: string;
  email: string | null;
  fullName: string | null;
  accountType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  savedPropertyCount: number;
  reportOrderCount: number;
}

export interface FounderSupportSavedProperty {
  parcelId: string;
  title: string;
  erfNumber: string | null;
  portion: string | null;
  municipality: string | null;
  province: string | null;
  researchStatus: string | null;
  status: string | null;
  createdAt: string | null;
  investigation: SavedInvestigationProjectionV1 | null;
}

export interface FounderSupportAssetSummary {
  id: string;
  parcelId: string;
  category: string;
  type: string;
  sourceLabel: string | null;
  fileName: string;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FounderSupportSitePotentialSummary {
  id: string;
  parcelId: string;
  mode: string;
  generationStatus: string;
  selectedDesignAssetId: string | null;
  updatedAt: string;
}

export interface FounderSupportDesignPackSummary {
  id: string;
  parcelId: string;
  siteProjectId: string;
  entitlementStatus: string;
  status: string;
  requestedCount: number;
  completedCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FounderSupportEntitlements {
  purchasedCredits: {
    balance: number;
    lifetimePurchased: number;
    lifetimeConsumed: number;
  } | null;
  activeBetaCredits: number;
}

export interface FounderSupportReportOrderSummary {
  id: string;
  parcelId: string;
  reportType: string;
  providerId: string | null;
  status: string;
  priceCents: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FounderSupportProviderEventSummary {
  id: string;
  provider: string;
  action: string;
  resourceId: string | null;
  status: string;
  errorCode: string | null;
  latencyMs: number | null;
  at: string;
}

export interface FounderSupportUserDetail {
  user: FounderSupportUserSummary;
  savedProperties: FounderSupportSavedProperty[];
  assets: FounderSupportAssetSummary[];
  sitePotentialProjects: FounderSupportSitePotentialSummary[];
  designPacks: FounderSupportDesignPackSummary[];
  entitlements: FounderSupportEntitlements;
  reportOrders: FounderSupportReportOrderSummary[];
  providerEvents: FounderSupportProviderEventSummary[];
}

export type FounderSupportSearchResponse =
  | { success: true; users: FounderSupportUserSummary[] }
  | { success: false; error: string };

export type FounderSupportUserResponse =
  | { success: true; detail: FounderSupportUserDetail }
  | { success: false; error: string };
