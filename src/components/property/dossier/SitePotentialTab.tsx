import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  TreePine,
  Upload,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  SITE_POTENTIAL_CREDIT_PACKS,
  SITE_POTENTIAL_CURRENCY,
  SITE_POTENTIAL_DISCLAIMER,
  SITE_POTENTIAL_PACK_SIZE,
  SITE_POTENTIAL_PRICE_CENTS,
} from "@/lib/sitePotential/config";
import { SITE_POTENTIAL_MAX_ATTEMPTS } from "@/lib/sitePotential/generationJobs";
import {
  buildSitePotentialRuntimeProgress,
  type SitePotentialRuntimeProgress,
} from "@/lib/sitePotential/generationProgress";
import { createSitePotentialPackStatusPoller } from "@/lib/sitePotential/packStatusPolling";
import {
  buildSelectedDesignDeletionPatch,
  useSitePotentialProject,
  type SitePotentialProjectPatch,
} from "@/lib/sitePotential/sitePotentialService";
import type { SitePotentialMode } from "@/lib/sitePotential/types";
import { buildSitePotentialParcelContext } from "@/lib/sitePotential/parcelContext";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import {
  createErfAssetSignedUrl,
  type ErfAsset,
  type ErfAssetCategory,
  type ErfAssetValidation,
} from "@/lib/workbench/erfFileVault";
import type { ErfWorkspaceState, SitePotentialSnapshot } from "@/lib/workbench/erfWorkspaceState";
import { toast } from "sonner";

export interface SitePotentialTabProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  onUpdateSite: (patch: Partial<SitePotentialSnapshot>) => void;
  onExploreReport?: () => void;
}

const STYLES = [
  "Coastal contemporary",
  "Modern",
  "Mediterranean",
  "Traditional",
  "Farmhouse",
  "Minimal",
  "Custom",
];

const ROOM_OPTIONS = ["2 bedrooms", "3 bedrooms", "4 bedrooms", "Study", "Guest suite"];
const FEATURE_OPTIONS = ["Pool", "Deck", "Garage", "Sea-facing patio", "Garden", "Flatlet"];

const MODE_OPTIONS: Array<{
  id: SitePotentialMode;
  label: string;
  body: string;
  icon: typeof TreePine;
}> = [
  {
    id: "vacant_land",
    label: "Vacant land",
    body: "Explore new-build concept directions from your brief and support files.",
    icon: TreePine,
  },
  {
    id: "renovation",
    label: "Existing house",
    body: "Upload permitted photos and explore renovation concepts.",
    icon: Home,
  },
  {
    id: "other_building",
    label: "Other building",
    body: "Store files and notes for a non-standard property state.",
    icon: ImageIcon,
  },
  {
    id: "unknown",
    label: "Not sure",
    body: "Keep this section open until the site condition is clearer.",
    icon: FileText,
  },
];

const VAULT_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "inspiration_image",
  "other",
  "generated_design",
];

const GENERATION_UI_ENABLED =
  import.meta.env.DEV ||
  import.meta.env.VITE_SITE_POTENTIAL_GENERATION_UI === "true" ||
  import.meta.env.VITE_SITE_POTENTIAL_BETA_UI === "true";
const BETA_UI_ENABLED = import.meta.env.VITE_SITE_POTENTIAL_BETA_UI === "true";

interface BetaCreditUiStatus {
  enabled: boolean;
  creditsRemaining: number;
  betaCreditsRemaining?: number;
  purchasedCredits?: number;
  freeEligible?: boolean;
  canGenerate?: boolean;
  nextEntitlementSource?: string | null;
  free?: {
    used24Hours: number;
    used7Days: number;
    used30Days: number;
    remaining24Hours: number;
    remaining7Days: number;
    remaining30Days: number;
    sameParcelEligible: boolean;
  };
  openRequestStatus?: string | null;
}

interface SitePotentialPackStatusItem {
  id: string;
  optionIndex: number;
  status: string;
  generatedAssetReady: boolean;
  attemptCount: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  nextAttemptAt?: string | null;
  workerHeartbeatAt?: string | null;
  workerActive?: boolean;
}

interface SitePotentialPackStatusPayload {
  designPackId: string;
  provider: string;
  status: string;
  requestedCount: number;
  completedCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  workerHeartbeatAt?: string | null;
  workerActive?: boolean;
  nextAttemptAt?: string | null;
  hasRetryableWork?: boolean;
  terminal?: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
  items: SitePotentialPackStatusItem[];
}

function formatPrice() {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: SITE_POTENTIAL_CURRENCY,
    maximumFractionDigits: 0,
  }).format(SITE_POTENTIAL_PRICE_CENTS / 100);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function assetTitle(asset: ErfAsset) {
  const conceptName = asset.metadata?.conceptName;
  if (typeof conceptName === "string" && conceptName.trim()) return conceptName;
  const title = asset.metadata?.title;
  return typeof title === "string" && title.trim() ? title : asset.original_file_name;
}

function assetRationale(asset: ErfAsset) {
  const value = asset.metadata?.conceptRationale;
  return typeof value === "string" && value.trim()
    ? value
    : "A site-grounded design direction created from the available erf context and brief.";
}

function validationMessage(result: Extract<ErfAssetValidation, { ok: false }>) {
  if (result.reason === "too_large") return "File is too large for the Erf File Vault.";
  if (result.reason === "empty_file") return "That file is empty.";
  return "File type is not supported for this upload.";
}

function assetDesignPackId(asset: ErfAsset) {
  const value = asset.metadata?.designPackId;
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizePackStatusPayload(payload: unknown): SitePotentialPackStatusPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const designPackId = typeof row.designPackId === "string" ? row.designPackId : null;
  if (!designPackId) return null;
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.map((item) => {
    const value = item as Record<string, unknown>;
    return {
      id: String(value.id ?? ""),
      optionIndex: Number(value.optionIndex ?? 0),
      status: String(value.status ?? "queued"),
      generatedAssetReady:
        value.generatedAssetReady === true ||
        (typeof value.generatedAssetId === "string" && value.generatedAssetId.length > 0),
      attemptCount: Number(value.attemptCount ?? 0),
      failureCode: typeof value.failureCode === "string" ? value.failureCode : null,
      failureMessage: typeof value.failureMessage === "string" ? value.failureMessage : null,
      nextAttemptAt: typeof value.nextAttemptAt === "string" ? value.nextAttemptAt : null,
      workerHeartbeatAt:
        typeof value.workerHeartbeatAt === "string" ? value.workerHeartbeatAt : null,
      workerActive: value.workerActive === true,
    };
  });
  return {
    designPackId,
    provider: typeof row.provider === "string" ? row.provider : "unknown",
    status: typeof row.status === "string" ? row.status : "queued",
    requestedCount: Number(row.requestedCount ?? SITE_POTENTIAL_PACK_SIZE),
    completedCount: Number(row.completedCount ?? 0),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    workerHeartbeatAt: typeof row.workerHeartbeatAt === "string" ? row.workerHeartbeatAt : null,
    workerActive: row.workerActive === true,
    nextAttemptAt: typeof row.nextAttemptAt === "string" ? row.nextAttemptAt : null,
    hasRetryableWork: row.hasRetryableWork === true,
    terminal: row.terminal === true,
    failureCode: typeof row.failureCode === "string" ? row.failureCode : null,
    failureMessage: typeof row.failureMessage === "string" ? row.failureMessage : null,
    items,
  };
}

function packProgressSignature(status: SitePotentialPackStatusPayload | null) {
  if (!status) return "none";
  return [
    status.designPackId,
    status.status,
    status.completedCount,
    status.items
      .map((item) => `${item.optionIndex}:${item.status}:${item.generatedAssetReady}`)
      .join("|"),
    status.workerHeartbeatAt ?? "",
  ].join(":");
}

function packHasRetryableSlots(status: SitePotentialPackStatusPayload | null) {
  return Boolean(
    status?.items.some(
      (item) =>
        !item.generatedAssetReady &&
        (item.status === "queued" ||
          item.status === "generating" ||
          (item.status === "failed" && item.attemptCount < SITE_POTENTIAL_MAX_ATTEMPTS)),
    ),
  );
}

function shouldPollPackStatus(status: SitePotentialPackStatusPayload | null) {
  if (!status) return false;
  if (status.completedCount >= status.requestedCount || status.status === "complete") return false;
  if (packHasRetryableSlots(status)) return true;
  if (status.status === "queued" || status.status === "generating") return true;
  return false;
}

function packStatusMessage(status: SitePotentialPackStatusPayload | null) {
  if (!status) return null;
  const completed = Math.min(status.completedCount, status.requestedCount);
  if (status.status === "complete" || completed >= status.requestedCount) {
    return `All ${status.requestedCount} concepts ready.`;
  }
  if (status.status === "queued" && completed === 0) {
    return `Your ${status.requestedCount} concepts are queued. They will appear here as each image is created.`;
  }
  if (status.status === "generating") {
    return completed > 0
      ? `${completed} of ${status.requestedCount} concepts complete.`
      : `Generating concept 1 of ${status.requestedCount}.`;
  }
  if (status.status === "partial_failed" && packHasRetryableSlots(status)) {
    return `Retrying failed concept - ${completed} of ${status.requestedCount} concepts complete.`;
  }
  if (status.status === "failed" && packHasRetryableSlots(status)) {
    return `Retrying failed concept - ${completed} of ${status.requestedCount} concepts complete.`;
  }
  if (status.status === "partial_failed") {
    return `Generation could not be completed - ${completed} of ${status.requestedCount} concepts are ready.`;
  }
  if (status.status === "failed") return "Generation could not be completed.";
  return `${completed} of ${status.requestedCount} concepts complete.`;
}

function packProgressState(status: SitePotentialPackStatusPayload | null) {
  if (!status) return null;
  if (status.status === "complete" || status.completedCount >= status.requestedCount) {
    return "concepts_ready";
  }
  if (packHasRetryableSlots(status)) return "generating";
  if (
    status.status === "failed" ||
    (status.status === "partial_failed" && !packHasRetryableSlots(status))
  ) {
    return "failed";
  }
  return "generating";
}

function projectPatchToSnapshot(patch: SitePotentialProjectPatch): Partial<SitePotentialSnapshot> {
  const selectedDesignAssetId =
    typeof patch.selected_design_asset_id === "string" ? patch.selected_design_asset_id : null;
  return {
    mode: patch.mode ?? undefined,
    skipped: patch.mode === "skipped" || patch.generation_status === "skipped",
    selectedDesignAssetId,
    preferredConceptId: selectedDesignAssetId,
    imageRightsConfirmed: Boolean(patch.rights_confirmed_at),
    rightsConfirmedAt: patch.rights_confirmed_at ?? undefined,
    progressState: patch.generation_status ?? undefined,
  };
}

function slotTone(status: SitePotentialRuntimeProgress["slots"][number]["status"]) {
  if (status === "Ready") return "border-[#16A34A]/25 bg-[#ECFDF5] text-[#166534]";
  if (status === "Generating" || status === "Saving") {
    return "border-[#FF6A00]/30 bg-[#FFF7ED] text-[#B24A00]";
  }
  if (status === "Retrying") return "border-[#F59E0B]/35 bg-[#FFFBEB] text-[#92400E]";
  if (status === "Failed") return "border-[#DC2626]/25 bg-[#FEF2F2] text-[#991B1B]";
  return "border-[#D9E6F2] bg-[#F7FBFF] text-[#0D1B2A]/68";
}

function SitePotentialGenerationProgressPanel({
  progress,
  onRefresh,
  onRetry,
  refreshing,
  retrying,
}: {
  progress: SitePotentialRuntimeProgress;
  onRefresh: () => void;
  onRetry: () => void;
  refreshing: boolean;
  retrying: boolean;
}) {
  const retryDisabled =
    retrying ||
    progress.completedCount >= progress.requestedCount ||
    !progress.slots.some((slot) => slot.status === "Retrying" || slot.status === "Waiting");

  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-4 rounded-[1.35rem] border border-[#FF6A00]/25 bg-white p-4 text-left shadow-[0_18px_44px_-34px_rgba(13,27,42,0.45)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Site Potential generation progress
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
            {progress.heading}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            {progress.detail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#F7FBFF] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Refresh status
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142941] disabled:cursor-not-allowed disabled:bg-[#0D1B2A]/20"
          >
            {retrying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Retry current pack
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-[#0D1B2A]">
          <span>Overall progress</span>
          <span>{progress.progressLabel}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#D9E6F2]">
          <div
            className="h-full rounded-full bg-[#FF6A00]"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {progress.slots.map((slot) => (
          <article
            key={slot.optionIndex}
            className={cn("rounded-2xl border p-3 text-xs", slotTone(slot.status))}
          >
            <div className="font-bold uppercase tracking-[0.14em]">Concept {slot.optionIndex}</div>
            <div className="mt-2 text-base font-semibold">{slot.status}</div>
            <p className="mt-1 leading-5 opacity-80">{slot.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-[#64748B] md:grid-cols-3">
        <div>{progress.startedLabel}</div>
        <div>{progress.lastCheckedLabel}</div>
        <div>{progress.estimate ?? "No countdown shown."}</div>
      </div>
      {progress.stalled && (
        <div className="mt-3 rounded-2xl border border-[#F59E0B]/35 bg-[#FFFBEB] px-3 py-2 text-xs leading-5 text-[#92400E]">
          The generator has not started yet. Easy Erf is checking the background worker.
        </div>
      )}
      {progress.sanitizedFailure && (
        <div className="mt-3 rounded-2xl border border-[#DC2626]/20 bg-[#FEF2F2] px-3 py-2 text-xs leading-5 text-[#991B1B]">
          {progress.sanitizedFailure}
        </div>
      )}
    </section>
  );
}

export function SitePotentialTab({
  parcel,
  workspaceState,
  onUpdateSite,
  onExploreReport,
}: SitePotentialTabProps) {
  const site = workspaceState.sitePotential;
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const topographyInputRef = useRef<HTMLInputElement | null>(null);
  const planInputRef = useRef<HTMLInputElement | null>(null);
  const inspirationInputRef = useRef<HTMLInputElement | null>(null);
  const supportDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const generationInFlightRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [migrationAttempted, setMigrationAttempted] = useState(false);
  const [betaStatus, setBetaStatus] = useState<BetaCreditUiStatus | null>(null);
  const [activeDesignPackId, setActiveDesignPackId] = useState<string | null>(null);
  const [packStatus, setPackStatus] = useState<SitePotentialPackStatusPayload | null>(null);
  const [lastPackStatusCheckedAt, setLastPackStatusCheckedAt] = useState<Date | null>(null);
  const [refreshingPackStatus, setRefreshingPackStatus] = useState(false);
  const [retryingPack, setRetryingPack] = useState(false);
  const lastPackProgressSignatureRef = useRef<string | null>(null);

  const vault = useErfFileVault(parcel.id, VAULT_CATEGORIES);
  const allGeneratedDesigns = vault.assets.filter(
    (asset) => asset.asset_category === "generated_design",
  );
  const generatedDesigns = allGeneratedDesigns.filter(
    (asset) => !activeDesignPackId || assetDesignPackId(asset) === activeDesignPackId,
  );
  const projectState = useSitePotentialProject(parcel.id, allGeneratedDesigns);
  const project = projectState.project;
  const refreshVault = vault.refresh;
  const refreshSiteProject = projectState.refresh;
  const refreshVaultRef = useRef(refreshVault);
  const refreshSiteProjectRef = useRef(refreshSiteProject);
  const immediatePackStatusKeyRef = useRef<string | null>(null);

  const sitePhotos = vault.assets.filter(
    (asset) =>
      asset.asset_category === "site_photo" || asset.asset_category === "existing_house_photo",
  );
  const existingHousePhotos = sitePhotos.filter(
    (asset) => asset.asset_category === "existing_house_photo",
  );
  const supportingFiles = vault.assets.filter(
    (asset) =>
      asset.asset_category === "topography" ||
      asset.asset_category === "architectural_plan" ||
      asset.asset_category === "inspiration_image" ||
      asset.asset_category === "other",
  );
  const selectedDesign = projectState.selectedDesign;
  const mode = project?.mode ?? site.mode ?? "unknown";
  const rightsConfirmed = Boolean(project?.rights_confirmed_at ?? site.rightsConfirmedAt);
  const needsRenovationPhoto = mode === "renovation" && existingHousePhotos.length === 0;
  const needsRights = mode === "renovation" && sitePhotos.length > 0 && !rightsConfirmed;
  const readyToGenerate =
    Boolean(project?.id) &&
    (mode === "vacant_land" || mode === "renovation") &&
    !needsRenovationPhoto &&
    !needsRights;
  const packCompletedCount = packStatus?.completedCount ?? generatedDesigns.length;
  const packRequestedCount = packStatus?.requestedCount ?? SITE_POTENTIAL_PACK_SIZE;
  const activePackProjectState = packProgressState(packStatus);
  const packProcessing = shouldPollPackStatus(packStatus);
  const runtimeProgress = buildSitePotentialRuntimeProgress(
    packStatus,
    new Date(),
    lastPackStatusCheckedAt,
  );
  const conceptsReady = packStatus
    ? packCompletedCount >= packRequestedCount ||
      packStatus.status === "complete" ||
      project?.generation_status === "design_selected"
    : generatedDesigns.length >= SITE_POTENTIAL_PACK_SIZE ||
      project?.generation_status === "concepts_ready" ||
      project?.generation_status === "design_selected";
  const activePackMessage = packStatusMessage(packStatus);
  const betaCreditsRemaining =
    betaStatus?.betaCreditsRemaining ?? betaStatus?.creditsRemaining ?? 0;
  const purchasedCreditsRemaining = betaStatus?.purchasedCredits ?? 0;
  const freeAllowance = betaStatus?.free;
  const generationEntitled =
    BETA_UI_ENABLED && Boolean(betaStatus?.enabled && betaStatus?.canGenerate);

  const identityLine = useMemo(() => {
    const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
    const area = parcel.suburbOrArea ?? parcel.town ?? parcel.municipality ?? null;
    return area ? `${erf} - ${area}` : erf;
  }, [parcel]);

  const refreshBetaStatus = useCallback(async () => {
    if (!BETA_UI_ENABLED) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBetaStatus({ enabled: true, creditsRemaining: 0, openRequestStatus: null });
      return;
    }
    const params = new URLSearchParams({ parcelId: parcel.id });
    const response = await fetch(`/api/site-potential/beta-status?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.success) {
      setBetaStatus({
        enabled: Boolean(payload.enabled),
        creditsRemaining: Number(payload.creditsRemaining ?? 0),
        betaCreditsRemaining: Number(payload.betaCreditsRemaining ?? payload.creditsRemaining ?? 0),
        purchasedCredits: Number(payload.purchasedCredits ?? 0),
        freeEligible: Boolean(payload.freeEligible),
        canGenerate: Boolean(payload.canGenerate),
        nextEntitlementSource: payload.nextEntitlementSource ?? null,
        free: payload.free ?? undefined,
        openRequestStatus: payload.openRequestStatus ?? null,
      });
    }
  }, [parcel.id]);

  useEffect(() => {
    refreshVaultRef.current = refreshVault;
  }, [refreshVault]);

  useEffect(() => {
    refreshSiteProjectRef.current = refreshSiteProject;
  }, [refreshSiteProject]);

  const applyPackStatus = useCallback((next: SitePotentialPackStatusPayload) => {
    setActiveDesignPackId(next.designPackId);
    const signature = packProgressSignature(next);
    if (
      lastPackProgressSignatureRef.current &&
      lastPackProgressSignatureRef.current !== signature
    ) {
      void refreshVaultRef.current();
      void refreshSiteProjectRef.current();
    }
    lastPackProgressSignatureRef.current = signature;
    setPackStatus(next);
    setLastPackStatusCheckedAt(new Date());
  }, []);

  const refreshPackStatus = useCallback(
    async (designPackId?: string | null, signal?: AbortSignal) => {
      if (!BETA_UI_ENABLED || !project?.id) return null;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const params = new URLSearchParams({
        parcelId: parcel.id,
        siteProjectId: project.id,
      });
      if (designPackId) params.set("designPackId", designPackId);
      const response = await fetch(`/api/site-potential/pack-status?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (response.status === 404) return null;
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not read Site Potential pack status.");
      }
      const next = normalizePackStatusPayload(payload);
      if (!next) return null;
      applyPackStatus(next);
      return next;
    },
    [applyPackStatus, parcel.id, project?.id],
  );

  const retryCurrentPack = useCallback(async () => {
    if (!packStatus?.designPackId || !project?.id || retryingPack) return;
    setRetryingPack(true);
    setGenerationError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Sign in to retry Site Potential generation.");
        return;
      }
      const response = await fetch("/api/site-potential/retry-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parcelId: parcel.id,
          siteProjectId: project.id,
          designPackId: packStatus.designPackId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not retry Site Potential generation.");
      }
      const next = normalizePackStatusPayload(payload);
      if (next) applyPackStatus(next);
      toast.success(
        payload.retried
          ? "Retry queued for this concept pack. No additional credit was used."
          : "This concept pack does not need a retry.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not retry Site Potential.";
      setGenerationError(message);
      toast.error(message);
    } finally {
      setRetryingPack(false);
    }
  }, [applyPackStatus, packStatus, parcel.id, project?.id, retryingPack]);

  const refreshCurrentPackStatus = useCallback(async () => {
    if (!project?.id || refreshingPackStatus) return;
    setRefreshingPackStatus(true);
    try {
      await refreshPackStatus(activeDesignPackId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh pack status.";
      setGenerationError(message);
      toast.error(message);
    } finally {
      setRefreshingPackStatus(false);
    }
  }, [activeDesignPackId, project?.id, refreshPackStatus, refreshingPackStatus]);

  useEffect(() => {
    if (!vault.signedIn || migrationAttempted) return;
    setMigrationAttempted(true);
    void vault.migrateLocalAttachments().then((result) => {
      if (!result) return;
      if (result.uploaded > 0) {
        toast.success(`${result.uploaded} local file(s) moved to the Erf File Vault.`);
      }
      if (result.failed > 0) toast.error("Some local files could not be moved to the vault.");
    });
  }, [migrationAttempted, vault]);

  useEffect(() => {
    void refreshBetaStatus();
  }, [refreshBetaStatus]);

  useEffect(() => {
    setActiveDesignPackId(null);
    setPackStatus(null);
    setLastPackStatusCheckedAt(null);
    lastPackProgressSignatureRef.current = null;
    immediatePackStatusKeyRef.current = null;
  }, [parcel.id]);

  useEffect(() => {
    if (!BETA_UI_ENABLED || !project?.id) return;
    const requestKey = `${parcel.id}:${project.id}:${activeDesignPackId ?? "latest"}`;
    if (immediatePackStatusKeyRef.current === requestKey) return;
    immediatePackStatusKeyRef.current = requestKey;
    const controller = new AbortController();
    void refreshPackStatus(activeDesignPackId, controller.signal)
      .then((next) => {
        if (next?.designPackId && !activeDesignPackId) {
          immediatePackStatusKeyRef.current = `${parcel.id}:${project.id}:${next.designPackId}`;
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Site Potential pack status refresh failed", error);
        }
      });
    return () => controller.abort();
  }, [activeDesignPackId, parcel.id, project?.id, refreshPackStatus]);

  useEffect(() => {
    if (
      !BETA_UI_ENABLED ||
      !activeDesignPackId ||
      !project?.id ||
      !shouldPollPackStatus(packStatus)
    ) {
      return;
    }
    const poller = createSitePotentialPackStatusPoller({
      intervalMs: 5000,
      readStatus: (signal) => refreshPackStatus(activeDesignPackId, signal),
      shouldContinue: shouldPollPackStatus,
      onError: (error) => console.warn("Site Potential pack status poll failed", error),
    });
    poller.start(false);
    return () => poller.stop();
  }, [activeDesignPackId, packStatus, project?.id, refreshPackStatus]);

  useEffect(() => {
    onUpdateSite({
      projectId: project?.id ?? null,
      photoCount: sitePhotos.length,
      planCount: supportingFiles.length,
      conceptCount: packCompletedCount,
      selectedDesignAssetId: project?.selected_design_asset_id ?? null,
      preferredConceptId: project?.selected_design_asset_id ?? null,
      mode: project?.mode ?? site.mode,
      skipped: project?.generation_status === "skipped" || project?.mode === "skipped",
      imageRightsConfirmed: rightsConfirmed,
      rightsConfirmedAt: project?.rights_confirmed_at ?? null,
      progressState:
        activePackProjectState ??
        project?.generation_status ??
        (packCompletedCount >= SITE_POTENTIAL_PACK_SIZE ? "concepts_ready" : site.progressState),
    });
  }, [
    activePackProjectState,
    onUpdateSite,
    packCompletedCount,
    project,
    rightsConfirmed,
    site.mode,
    site.progressState,
    sitePhotos.length,
    supportingFiles.length,
  ]);

  async function saveProject(patch: SitePotentialProjectPatch) {
    setSaving(true);
    try {
      const next = await projectState.save(patch);
      onUpdateSite(projectPatchToSnapshot(patch));
      return next;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Site Potential.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function selectMode(nextMode: SitePotentialMode) {
    const generation_status = nextMode === "skipped" ? "skipped" : "inputs_added";
    await saveProject({
      mode: nextMode,
      generation_status,
      skipped_at: nextMode === "skipped" ? new Date().toISOString() : null,
    });
  }

  async function uploadFiles(files: FileList | null | undefined, category: ErfAssetCategory) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to save files permanently to this erf.");
      return;
    }
    const sourceLabel =
      category === "existing_house_photo"
        ? "User uploaded permitted property photograph"
        : category === "site_photo"
          ? "User uploaded site photograph"
          : category === "topography"
            ? "User uploaded topographical survey"
            : category === "architectural_plan"
              ? "User uploaded plan"
              : category === "inspiration_image"
                ? "User uploaded inspiration image"
                : "User uploaded supporting document";
    for (const file of list) {
      const result = await vault.upload({
        file,
        fileName: file.name,
        category,
        assetType: category,
        sourceLabel,
        metadata: {
          siteProjectId: project?.id ?? null,
          mode,
          rightsConfirmedAt: rightsConfirmed ? project?.rights_confirmed_at : null,
        },
      });
      if (!result.ok) toast.error(`${file.name}: ${validationMessage(result)}`);
    }
    await saveProject({
      generation_status: "inputs_added",
      mode:
        mode === "unknown"
          ? category === "existing_house_photo"
            ? "renovation"
            : "vacant_land"
          : mode,
    });
  }

  async function grantDevEntitlement() {
    const parcelContext = buildSitePotentialParcelContext(parcel);
    const current = await saveProject({
      mode,
      generation_status: "ready_to_generate",
      metadata: {
        ...(project?.metadata ?? {}),
        parcelContext,
      },
    });
    if (!current) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sign in to create a test entitlement.");
      return null;
    }
    const response = await fetch("/api/site-potential/dev-entitlement", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ parcelId: parcel.id, siteProjectId: current.id }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      toast.error(payload?.error || "Development entitlement is not available.");
      return null;
    }
    toast.success("Development entitlement ready for this concept pack.");
    return payload.designPack as { id: string };
  }

  async function generateWithEntitlement() {
    const parcelContext = buildSitePotentialParcelContext(parcel);
    const current = await saveProject({
      mode,
      generation_status: "ready_to_generate",
      metadata: {
        ...(project?.metadata ?? {}),
        parcelContext,
      },
    });
    if (!current) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sign in to generate Site Potential concepts.");
      return;
    }
    setGenerating(true);
    await saveProject({ generation_status: "generating" });
    try {
      const response = await fetch("/api/site-potential/beta-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parcelId: parcel.id,
          siteProjectId: current.id,
          requestId: crypto.randomUUID(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Site Potential entitlement could not be redeemed.");
      }
      setBetaStatus((previous) => ({
        ...(previous ?? { enabled: true, creditsRemaining: 0 }),
        creditsRemaining: Number(payload.betaCreditsRemaining ?? payload.creditsRemaining ?? 0),
        betaCreditsRemaining: Number(payload.betaCreditsRemaining ?? payload.creditsRemaining ?? 0),
        purchasedCredits: Number(
          payload.purchasedCreditsRemaining ?? previous?.purchasedCredits ?? 0,
        ),
      }));
      const nextPackStatus = normalizePackStatusPayload({
        ...payload,
        provider: payload.paymentProvider ?? "beta_credit",
      });
      if (nextPackStatus) applyPackStatus(nextPackStatus);
      toast.success(
        payload.durableJobQueued
          ? "Three independent property concepts queued."
          : "Concept pack is already ready.",
      );
      await vault.refresh();
      await projectState.refresh();
      await refreshBetaStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Site Potential generation failed.";
      setGenerationError(message);
      await saveProject({ generation_status: "failed" });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateConcepts() {
    if (generationInFlightRef.current || generating || packProcessing) {
      return;
    }
    setGenerationError(null);
    if (!GENERATION_UI_ENABLED) {
      toast.error("AI concept generation is not available until secure entitlement is configured.");
      return;
    }
    if (!readyToGenerate) {
      toast.error("Complete the required Site Potential inputs first.");
      return;
    }
    generationInFlightRef.current = true;
    try {
      if (BETA_UI_ENABLED) {
        if (!generationEntitled) {
          toast.error("Free allowance used and no purchased Site Potential credits are available.");
          return;
        }
        await generateWithEntitlement();
        return;
      }
      const currentPack = await grantDevEntitlement();
      if (!currentPack?.id || !project?.id) return;
      setActiveDesignPackId(currentPack.id);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      setGenerating(true);
      await saveProject({ generation_status: "generating" });
      const response = await fetch("/api/site-potential/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parcelId: parcel.id,
          siteProjectId: project.id,
          designPackId: currentPack.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Generation failed.");
      }
      toast.success(
        payload.durableJobQueued
          ? "Concept generation queued."
          : `${payload.assets?.length ?? SITE_POTENTIAL_PACK_SIZE} concepts saved to the Erf File Vault.`,
      );
      await vault.refresh();
      await projectState.refresh();
      await refreshPackStatus(currentPack.id).catch(() => null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setGenerationError(message);
      await saveProject({ generation_status: "failed" });
      toast.error(message);
    } finally {
      setGenerating(false);
      generationInFlightRef.current = false;
    }
  }

  async function selectDesign(asset: ErfAsset | null) {
    await saveProject({
      selected_design_asset_id: asset?.id ?? null,
      generation_status: asset
        ? "design_selected"
        : packCompletedCount >= SITE_POTENTIAL_PACK_SIZE
          ? "concepts_ready"
          : "not_started",
    });
  }

  async function removeGeneratedDesign(asset: ErfAsset) {
    const deletionPatch = buildSelectedDesignDeletionPatch(project, asset, allGeneratedDesigns);
    try {
      await vault.remove(asset);
      if (deletionPatch) await saveProject(deletionPatch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove generated concept.");
    }
  }

  function generationButtonLabel() {
    if (generating || packProcessing || project?.generation_status === "generating") {
      return packStatus?.status === "queued" ? "3 concepts queued" : "Generating 3 concepts";
    }
    if (BETA_UI_ENABLED) {
      if (!generationEntitled) return "Free allowance used";
      if (conceptsReady) return "Generate another 3 concepts";
      if (betaStatus?.nextEntitlementSource === "free_allowance") return "Generate 3 free concepts";
      return "Use 1 credit for 3 concepts";
    }
    return conceptsReady ? "Generate another 3 concepts" : "Generate 3 concepts";
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
              Site Potential
            </span>
            <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">
              What is currently on this erf, and what could it become?
            </h2>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">
              {identityLine}. Upload permitted photos, plans, topography and inspiration into the
              permanent Erf File Vault. Concepts are visual starting points, not architectural plans
              or municipal approvals.
            </p>
          </div>
          <div className="min-w-[250px] rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-[12px] text-[#0D1B2A]/72">
            <div className="font-semibold text-[#0D1B2A]">Three site-grounded concepts</div>
            <div className="mt-1">1 property / day · 3 / week · 6 / month free</div>
            {BETA_UI_ENABLED && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#0D1B2A]/8 pt-2 text-[11px]">
                <div>
                  <div className="font-semibold text-[#0D1B2A]">Free this month</div>
                  <div>{freeAllowance ? freeAllowance.remaining30Days : "–"} packs left</div>
                </div>
                <div>
                  <div className="font-semibold text-[#0D1B2A]">Purchased credits</div>
                  <div>{purchasedCreditsRemaining + betaCreditsRemaining} available</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {!vault.signedIn && (
        <Notice tone="amber">
          Sign in to save Site Potential files permanently to the cloud Erf File Vault.
        </Notice>
      )}
      {vault.migration && (vault.migration.uploaded > 0 || vault.migration.failed > 0) && (
        <Notice tone={vault.migration.failed ? "amber" : "green"}>
          Local file migration: {vault.migration.uploaded} uploaded, {vault.migration.skipped}{" "}
          already in cloud, {vault.migration.failed} failed.
        </Notice>
      )}
      {projectState.error && <Notice tone="amber">{projectState.error}</Notice>}
      {vault.error && <Notice tone="amber">{vault.error}</Notice>}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Step 1 - Choose the site state
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void selectMode(option.id)}
                className={cn(
                  "flex min-h-[116px] flex-col items-start rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]"
                    : "border-[#0D1B2A]/10 bg-white hover:border-[#0D1B2A]/25",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full",
                    active ? "bg-[#FF6A00] text-white" : "bg-[#0D1B2A]/5 text-[#0D1B2A]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 text-[14px] font-semibold text-[#0D1B2A]">
                  {option.label}
                </span>
                <span className="mt-1 text-[12px] text-[#64748B]">{option.body}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void selectMode("skipped")}
          className="mt-4 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
        >
          Skip Site Potential for this erf
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <UploadPanel
          title={mode === "renovation" ? "Permitted property photographs" : "Site photographs"}
          body={
            mode === "renovation"
              ? "Renovation concepts require at least one user-uploaded photo that you own or have permission to use."
              : "Vacant-land concepts can use site photos for context. They are not treated as verified parcel positioning."
          }
          count={sitePhotos.length}
          inputRef={photoInputRef}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          buttonLabel="Upload photos"
          onClick={() => photoInputRef.current?.click()}
          onFiles={(files) =>
            void uploadFiles(files, mode === "renovation" ? "existing_house_photo" : "site_photo")
          }
        />
        <UploadPanel
          title="Topographical survey"
          body="Upload a topographical survey only when the file is actually a survey or contour/site-level document."
          count={vault.assets.filter((asset) => asset.asset_category === "topography").length}
          inputRef={topographyInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload topography"
          onClick={() => topographyInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "topography")}
        />
        <UploadPanel
          title="Architectural plans"
          body="Upload architectural plans separately so Easy Erf does not mistake them for topographical surveys."
          count={
            vault.assets.filter((asset) => asset.asset_category === "architectural_plan").length
          }
          inputRef={planInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload plans"
          onClick={() => planInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "architectural_plan")}
        />
        <UploadPanel
          title="Inspiration images"
          body="Upload visual references as inspiration only. They are not treated as official site evidence."
          count={
            vault.assets.filter((asset) => asset.asset_category === "inspiration_image").length
          }
          inputRef={inspirationInputRef}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          buttonLabel="Upload inspiration"
          onClick={() => inspirationInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "inspiration_image")}
        />
        <UploadPanel
          title="Supporting documents"
          body="Upload other supporting files without classifying them as topography, plans, or design inspiration."
          count={vault.assets.filter((asset) => asset.asset_category === "other").length}
          inputRef={supportDocumentInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,application/pdf,image/png,image/jpeg,image/tiff,image/webp"
          buttonLabel="Upload document"
          onClick={() => supportDocumentInputRef.current?.click()}
          onFiles={(files) => void uploadFiles(files, "other")}
        />
      </section>

      {mode === "renovation" && (
        <label className="flex items-start gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 text-[13px] text-[#0D1B2A]">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(event) =>
              void saveProject({
                rights_confirmed_at: event.target.checked ? new Date().toISOString() : null,
                generation_status: event.target.checked ? "ready_to_generate" : "inputs_added",
              })
            }
            className="mt-0.5 h-4 w-4 accent-[#FF6A00]"
          />
          <span>
            I own these images or have permission to use them for AI concept visualisation.
            {needsRights && <strong className="ml-2 text-[#B24A00]">Required</strong>}
          </span>
        </label>
      )}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Step 2 - Brief and assumptions
        </h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextField
            label="Design brief"
            value={project?.design_brief ?? ""}
            onChange={(value) =>
              void saveProject({ design_brief: value, generation_status: "inputs_added" })
            }
            placeholder="Example: compact coastal family home with wind-protected courtyard"
          />
          <SelectField
            label="Style"
            value={project?.selected_style ?? ""}
            options={STYLES}
            onChange={(value) => void saveProject({ selected_style: value })}
          />
          <SelectField
            label="Renovation level"
            value={project?.renovation_level ?? ""}
            options={["cosmetic", "moderate", "major"]}
            onChange={(value) =>
              void saveProject({
                renovation_level: value as "cosmetic" | "moderate" | "major",
              })
            }
          />
          <TextField
            label="Custom instructions"
            value={project?.custom_instructions ?? ""}
            onChange={(value) => void saveProject({ custom_instructions: value })}
            placeholder="Materials, colours, rooms, landscaping, parking, views..."
          />
        </div>
        <ChipEditor
          title="Requested rooms"
          values={project?.requested_rooms ?? []}
          options={ROOM_OPTIONS}
          onChange={(values) => void saveProject({ requested_rooms: values })}
        />
        <ChipEditor
          title="Requested features"
          values={project?.requested_features ?? []}
          options={FEATURE_OPTIONS}
          onChange={(values) => void saveProject({ requested_features: values })}
        />
      </section>

      <section className="rounded-[1.75rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF6A00]" />
              <h3 className="text-[16px] font-semibold tracking-tight text-[#0D1B2A]">
                Generate three independent Site Potential concepts
              </h3>
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#4A5A6A]">
              Easy Erf combines the official erf record, satellite site context, uploaded photos,
              topography, plans, inspiration and your brief to produce three deliberately different
              design directions. Each concept is generated independently and can be selected only
              for the Easy Erf Report.
            </p>
            <p className="mt-2 text-[11.5px] text-[#64748B]">{SITE_POTENTIAL_DISCLAIMER}</p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="text-[26px] font-bold text-[#0D1B2A]">
              {BETA_UI_ENABLED
                ? betaStatus?.nextEntitlementSource === "free_allowance"
                  ? "Free pack"
                  : "1 credit"
                : formatPrice()}
            </div>
            <button
              type="button"
              disabled={
                !GENERATION_UI_ENABLED ||
                !readyToGenerate ||
                generating ||
                packProcessing ||
                saving ||
                (BETA_UI_ENABLED && !generationEntitled)
              }
              onClick={() => void generateConcepts()}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold",
                !GENERATION_UI_ENABLED ||
                  !readyToGenerate ||
                  generating ||
                  packProcessing ||
                  (BETA_UI_ENABLED && !generationEntitled)
                  ? "cursor-not-allowed bg-[#0D1B2A]/10 text-[#0D1B2A]/40"
                  : "bg-[#FF6A00] text-white hover:bg-[#ff7a1a]",
              )}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generationButtonLabel()}
            </button>
            <span className="text-[11px] text-[#64748B]">
              {needsRenovationPhoto
                ? "Needs a permitted property photo"
                : needsRights
                  ? "Needs image-rights confirmation"
                  : BETA_UI_ENABLED && !betaStatus?.enabled
                    ? "Site Potential generation is disabled in this environment"
                    : BETA_UI_ENABLED && !generationEntitled
                      ? "Free allowance used. Purchase credits to create another 3-concept pack."
                      : !GENERATION_UI_ENABLED
                        ? "Concept generation is unavailable until secure entitlement is configured"
                        : !project?.id
                          ? "Choose a site state first"
                          : activePackMessage
                            ? activePackMessage
                            : betaStatus?.nextEntitlementSource === "free_allowance"
                              ? "This pack will use your free allowance"
                              : "This pack will use one Site Potential credit"}
            </span>
          </div>
        </div>
        {runtimeProgress && (
          <SitePotentialGenerationProgressPanel
            progress={runtimeProgress}
            onRefresh={() => void refreshCurrentPackStatus()}
            onRetry={() => void retryCurrentPack()}
            refreshing={refreshingPackStatus}
            retrying={retryingPack}
          />
        )}
        {generationError && <Notice tone="amber">{generationError}</Notice>}
      </section>

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Generated concepts
          </h3>
          <span className="text-xs text-[#64748B]">
            {packCompletedCount} of {packRequestedCount}
          </span>
        </div>
        {packStatus && (
          <Notice
            tone={
              packStatus.status === "complete" || packCompletedCount >= packRequestedCount
                ? "green"
                : "amber"
            }
          >
            {activePackMessage}
          </Notice>
        )}
        {generatedDesigns.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {generatedDesigns.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={asset.id === project?.selected_design_asset_id}
                onOpen={() => void vault.open(asset)}
                onRemove={() => void removeGeneratedDesign(asset)}
                onSelect={() => void selectDesign(asset)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm text-[#0D1B2A]/60">
  {packStatus
    ? "Your concepts are being created. Images will appear here as each one is completed, and this page will update automatically."
    : "No concepts generated yet. Complete the brief and generate a three-concept pack."}
</p>
        )}
      </section>
      {/* Credit purchases are intentionally hidden for the no-payment MVP. */}

      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Erf File Vault files for Site Potential
        </h3>
        <div className="mt-4 grid gap-3">
          {[...sitePhotos, ...supportingFiles].map((asset) => (
            <FileRow
              key={asset.id}
              asset={asset}
              onOpen={() => void vault.open(asset)}
              onRemove={() => void vault.remove(asset)}
            />
          ))}
          {!sitePhotos.length && !supportingFiles.length && (
            <p className="rounded-2xl border border-dashed border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm text-[#0D1B2A]/60">
              No Site Potential files uploaded yet.
            </p>
          )}
        </div>
      </section>

      {onExploreReport && (
        <button
          type="button"
          onClick={onExploreReport}
          className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#142941]"
        >
          View in Easy Erf Report <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3 rounded-2xl border p-4 text-[12.5px]",
        tone === "green"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      {tone === "green" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}

function UploadPanel({
  title,
  body,
  count,
  inputRef,
  accept,
  buttonLabel,
  onClick,
  onFiles,
}: {
  title: string;
  body: string;
  count: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  buttonLabel: string;
  onClick: () => void;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-[#64748B]">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#0D1B2A]/70">
          {count} file{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff7a1a]"
        >
          <Upload className="h-3.5 w-3.5" /> {buttonLabel}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </article>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="block text-[12px] text-[#64748B]">
      <span className="mb-1 block font-semibold text-[#0D1B2A]">{label}</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(draft.trim())}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[12px] text-[#64748B]">
      <span className="mb-1 block font-semibold text-[#0D1B2A]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
      >
        <option value="">Not selected</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipEditor({
  title,
  values,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(active ? values.filter((item) => item !== option) : [...values, option])
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                active
                  ? "border-[#FF6A00] bg-[#FF6A00] text-white"
                  : "border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:border-[#0D1B2A]/30",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FileRow({
  asset,
  onOpen,
  onRemove,
}: {
  asset: ErfAsset;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="break-words text-sm font-semibold text-[#0D1B2A]">
          {asset.original_file_name}
        </div>
        <div className="mt-1 text-xs text-[#64748B]">
          {asset.asset_category} - {formatFileSize(asset.size_bytes)} - uploaded{" "}
          {formatDate(asset.created_at)}
        </div>
        <div className="mt-1 text-xs text-[#64748B]">Status: {asset.status}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fffaf2]"
        >
          <Download className="h-3.5 w-3.5" /> Open
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#C75A31]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#7A2D12] hover:bg-[#fff1e9]"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onOpen,
  onRemove,
  onSelect,
}: {
  asset: ErfAsset;
  selected: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onSelect: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let active = true;
    setImageUrl(null);
    setImageError(false);
    void createErfAssetSignedUrl(asset)
      .then((url) => {
        if (active) setImageUrl(url);
      })
      .catch(() => {
        if (active) setImageError(true);
      });
    return () => {
      active = false;
    };
  }, [asset]);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-[#FBF6EC] shadow-sm",
        selected ? "border-[#FF6A00] ring-2 ring-[#FF6A00]/15" : "border-[#EADFC9]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-[3/2] w-full overflow-hidden bg-[#0D1B2A]/5 text-left"
        aria-label={`Open ${assetTitle(asset)}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={assetTitle(asset)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]"
            onError={() => setImageError(true)}
          />
        ) : imageError ? (
          <div className="grid h-full place-items-center p-5 text-center text-xs font-semibold text-[#0D1B2A]/55">
            Preview unavailable. Open the stored concept directly.
          </div>
        ) : (
          <div className="grid h-full place-items-center text-[#0D1B2A]/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A] shadow-sm backdrop-blur">
          View larger
        </span>
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#0D1B2A]">{assetTitle(asset)}</div>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">{assetRationale(asset)}</p>
          </div>
          {selected && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6A00] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <CheckCircle2 className="h-3 w-3" /> Report
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={selected}
            onClick={onSelect}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              selected
                ? "cursor-not-allowed bg-[#0D1B2A]/8 text-[#0D1B2A]/40"
                : "bg-[#0D1B2A] text-white hover:bg-[#142941]",
            )}
          >
            {selected ? "Selected for report" : "Select for Easy Erf Report"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-[#C75A31]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#7A2D12] hover:bg-[#fff1e9]"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
