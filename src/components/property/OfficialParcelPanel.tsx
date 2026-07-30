import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AREA_UNAVAILABLE_LABEL, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  X,
  ShieldCheck,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Share2,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Copy,
  Upload,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { type OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { ErfResearchDossier } from "./ErfResearchDossier";
import {
  buildOfficialParcelId,
  type NormalizedOfficialParcel,
} from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import { resolveParcelArea } from "@/lib/evidence/parcelArea";
import { extractExteriorRing } from "@/lib/sitePotential/parcelRing";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  CSG_VIEWER_URL,
  GOVZA_DEEDS_GUIDANCE_URL,
  KOUGA_PUBLIC_MAP_URL,
} from "@/lib/external-urls";
import { buildSgDocumentUrl, type SgDocumentResult } from "@/lib/research/sgDocument";
import {
  readErfWorkspaceState,
  readStrategyScenarios,
  updateErfWorkspaceState,
  type ErfWorkspaceIdentityStatus,
  type ErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import { InvestigationHome } from "./investigation/InvestigationHome";
import type { DossierView } from "./dossier/reportViews";
import { SitePotentialTab } from "./dossier/SitePotentialTab";
import { ZoningBuildTab } from "./dossier/ZoningBuildTab";
import { LocalPropertyTeam } from "./dossier/LocalPropertyTeam";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { extractErfAsset } from "@/lib/workbench/erfAssetExtraction";
import {
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";

import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import {
  marketAddressToPropertyIdentityOverride,
  selectedMarketAddress,
} from "@/features/marketEvidence/addressIntelligence";
import { toast } from "sonner";

interface Props {
  selection: OfficialFeatureSelection;
  onClose: () => void;
}

function normalizeCsg(p: Record<string, unknown>) {
  return {
    provider: "Chief Surveyor-General",
    erfNumber: (p.PARCEL_NO ?? p.TAG_VALUE) as string | number | undefined,
    portion: p.PORTION as string | number | undefined,
    lpi: p.ID as string | undefined,
    parcelKey: p.PRCL_KEY as string | undefined,
    province: p.PROVINCE as string | undefined,
    majorRegion: p.MAJ_REGION as string | undefined,
    minorRegion: p.MIN_REGION as string | undefined,
    geometryArea: (p.GEOM_AREA ?? p.SHAPE_Area) as number | undefined,
    longitude: p.TAG_X as number | undefined,
    latitude: p.TAG_Y as number | undefined,
  };
}

function normalizeKouga(p: Record<string, unknown>) {
  return {
    provider: "Kouga Municipality GIS",
    zoningType: p.ZONING_TYP,
    zoningCode: p.ZONING,
    zoningDescription: p.ZONING_DES,
    shapeArea: p.Shape__Area,
    shapeLength: p.Shape__Length,
  };
}

type Tab =
  | "investigation"
  | "research"
  | "zoning-build"
  | "site-potential"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report"
  | "local-services";
/**
 * Primary navigation stays short so an ordinary user does not have to
 * understand the whole toolset before starting. Nothing is removed: the
 * secondary items below remain directly routable.
 */
const WORKBENCH_NAV: { id: Tab; label: string }[] = [
  { id: "investigation", label: "Investigation" },
  { id: "research", label: "Property & Sources" },
  { id: "zoning-build", label: "Zoning & Build" },
  { id: "site-potential", label: "Site Potential" },
  { id: "listings", label: "Market" },
  { id: "reports", label: "Documents" },
  { id: "calculators", label: "Strategy" },
  { id: "stoep-report", label: "Report" },
];

const WORKBENCH_NAV_MORE: { id: Tab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "local-services", label: "Local Services" },
];

const WORKBENCH_SECTIONS: Record<Tab, { title: string; subtitle: string; guidance: string }> = {
  investigation: {
    title: "Investigation",
    subtitle:
      "What Easy Erf found for this erf, what is still unconfirmed, and the best next step.",
    guidance: "Every statement here comes from evidence saved for this erf.",
  },
  research: {
    title: "Official Sources",
    subtitle: "Check public records and source links tied to this erf.",
    guidance:
      "Start with official and municipal records. Keep ownership, valuation and zoning marked needs evidence until a verified source supports them.",
  },
  "zoning-build": {
    title: "Zoning & Build",
    subtitle: "See the published planning rules for this erf, and what still has to be confirmed.",
    guidance:
      "Published zone rules are general municipal rules, not confirmed rights for this erf. Title conditions, servitudes, departures and approved plans can all change what may actually be built.",
  },
  "site-potential": {
    title: "Site Potential",
    subtitle: "Explore renovation and new-build possibilities for this erf.",
    guidance:
      "Concepts are visual starting points, not architectural plans or municipal approvals. This section is optional and can be skipped without blocking the Easy Erf Report.",
  },
  listings: {
    title: "Market Evidence",
    subtitle: "Build listing, comp, and local market evidence for this erf.",
    guidance:
      "Use listings as evidence to save and compare. Portal results may be nearby or unrelated, so verify each comp before it informs your view.",
  },
  reports: {
    title: "Paid Reports",
    subtitle: "Upload Lightstone, WinDeed, SG, zoning, title deed, or other source documents.",
    guidance:
      "Paid reports are optional confidence upgrades. Upload or attach evidence when you have it; the basic workflow still works without a purchase.",
  },
  calculators: {
    title: "Strategy Lab",
    subtitle: "Run the numbers before deciding whether to buy, hold, flip, or build.",
    guidance:
      "Treat calculator outputs as estimates from your assumptions, not verified valuations or investment advice.",
  },
  notes: {
    title: "Notes",
    subtitle: "Capture your research, questions, and decision notes.",
    guidance:
      "Keep open questions, evidence links and decision notes together so the erf stays reviewable later.",
  },
  "stoep-report": {
    title: "Easy Erf Report",
    subtitle:
      "Assemble the final report from saved identity, sources, market evidence and strategy assumptions.",
    guidance:
      "This report shell uses what you have saved so far and labels missing data honestly. It does not fabricate ownership, valuation, zoning or sales history.",
  },
  "local-services": {
    title: "Local Services",
    subtitle: "Keep track of professionals and service providers for follow-up.",
    guidance:
      "Use this as a post-report planning step. Easy Erf does not recommend or verify providers in this MVP.",
  },
};

interface WorkbenchNextStepModel {
  title: string;
  body: string;
  cta: string;
  tab: Tab;
  anchorId?: string;
  markStarted?: boolean;
}

function buildWorkbenchPageNextStep(
  tab: Tab,
  opts: { paidReportCount: number; workspaceState: ErfWorkspaceState },
): WorkbenchNextStepModel {
  switch (tab) {
    case "investigation":
      return {
        title: "Verify official sources",
        body: "Before you rely on this erf file, confirm the official parcel identity and source links.",
        cta: "Go to Sources",
        tab: "research",
      };
    case "research":
      return {
        title: "Add market evidence",
        body: "Once the official identity is clear, add comparable listings, notes, and local market context.",
        cta: "Go to Market",
        tab: "listings",
        markStarted: true,
      };
    case "listings":
      return opts.paidReportCount > 0
        ? {
            title: "Run the strategy",
            body: "Use your saved market context to test acquisition, build, flip, or hold scenarios.",
            cta: "Go to Strategy",
            tab: "calculators",
            markStarted: true,
          }
        : {
            title: "Add report documents",
            body: "Report documents can add valuation, ownership, transfer, and deeds-level context to the erf file.",
            cta: "Go to Paid Reports",
            tab: "reports",
            markStarted: true,
          };
    case "reports":
      return {
        title: "Run the strategy",
        body: "Use the official parcel context and saved documents to test acquisition, build, flip, or hold scenarios.",
        cta: "Go to Strategy",
        tab: "calculators",
        markStarted: true,
      };
    case "calculators":
      return {
        title: "Explore Site Potential",
        body: "After the numbers, choose whether to generate a visual concept pack or explicitly skip this optional step.",
        cta: "Go to Site Potential",
        tab: "site-potential",
        markStarted: true,
      };
    case "notes":
      return {
        title: "Explore Site Potential",
        body: "Use Site Potential before the report, or skip it when it is not relevant to this erf.",
        cta: "Go to Site Potential",
        tab: "site-potential",
        markStarted: true,
      };
    case "zoning-build":
      return {
        title: "Attach planning evidence",
        body: "Zoning, title conditions and approved plans decide what may actually be built here. Attach what you have.",
        cta: "Go to Paid Reports",
        tab: "reports",
        markStarted: true,
      };
    case "site-potential":
      return {
        title: "Build the Easy Erf Report",
        body: "Select a preferred concept or skip Site Potential, then assemble the final report.",
        cta: "Go to Easy Erf Report",
        tab: "stoep-report",
        markStarted: true,
      };
    case "stoep-report":
      return opts.workspaceState.identityStatus === "none"
        ? {
            title: "Review missing identity evidence",
            body: "The report is stronger when the official parcel identity has been checked first.",
            cta: "Go to Sources",
            tab: "research",
          }
        : {
            title: "Plan local follow-up",
            body: "After reviewing the report, keep notes for professionals, council, conveyancing, or build-cost checks.",
            cta: "Go to Local Services",
            tab: "local-services",
          };
    case "local-services":
      return {
        title: "Review source documents",
        body: "Check uploaded files and missing evidence before using the final report.",
        cta: "Review uploaded files",
        tab: "stoep-report",
        anchorId: "uploaded-files-and-source-documents",
      };
  }
}

const ASK_STOEP_PROMPTS: { label: string; tab: Tab }[] = [
  { label: "What is risky?", tab: "research" },
  { label: "What should I verify?", tab: "research" },
  { label: "Run the numbers", tab: "calculators" },
];

/**
 * Selecting a parcel always opens the Investigation, unless the URL asks for a
 * specific tool explicitly.
 */
function readInitialTab(): Tab {
  if (typeof window === "undefined") return "investigation";
  const value = new URLSearchParams(window.location.search).get("tab");
  if (value === "calc" || value === "calculators") return "calculators";
  if (value === "site" || value === "site-potential") return "site-potential";
  if (value === "zoning" || value === "zoning-build") return "zoning-build";
  if (value === "research" || value === "sources") return "research";
  if (value === "listings" || value === "market") return "listings";
  if (value === "reports" || value === "documents") return "reports";
  if (value === "notes") return "notes";
  if (value === "local-services") return "local-services";
  if (value === "stoep-report" || value === "report") return "stoep-report";
  return "investigation";
}

function panelIdentityConfidence(parcel: NormalizedOfficialParcel): string {
  if (parcel.lpi || parcel.parcelKey) return "Medium confidence";
  if (parcel.erfNumber && (parcel.municipality || parcel.province)) return "Needs source check";
  return "Needs evidence";
}

function panelNextBestStep(parcel: NormalizedOfficialParcel): string {
  if (parcel.lpi || parcel.parcelKey) return "Confirm Official Identity";
  if (parcel.erfNumber) return "Check official CSG / SG sources";
  return "Save the erf and gather evidence";
}

type IdentityCheckStatus = "needs_verification" | "checked" | "looks_correct" | "uncertain";

const IDENTITY_STATUS_LABELS: Record<IdentityCheckStatus, string> = {
  needs_verification: "Needs verification",
  checked: "Checked by user",
  looks_correct: "Looks correct, user checked",
  uncertain: "Uncertain",
};

function identityStatusKey(parcelId: string) {
  return `erfstoep.identityCheck.${parcelId}`;
}

function readIdentityStatus(parcelId: string): IdentityCheckStatus {
  if (typeof window === "undefined") return "needs_verification";
  const value = window.localStorage.getItem(identityStatusKey(parcelId));
  return value === "checked" || value === "looks_correct" || value === "uncertain"
    ? value
    : "needs_verification";
}

function identityStatusToWorkspace(status: IdentityCheckStatus): ErfWorkspaceIdentityStatus {
  return status === "needs_verification" ? "none" : status;
}

function workspaceStatusToIdentity(status: ErfWorkspaceIdentityStatus): IdentityCheckStatus {
  return status === "none" ? "needs_verification" : status;
}

function formatMapCoordinate(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "Not available";
}

/** Single rendering rule for erf area: never show a fabricated 0 m². */
function formatAreaM2(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return formatAreaM2WithUnit(Number.isFinite(numeric) ? numeric : null) ?? AREA_UNAVAILABLE_LABEL;
}

function googleMapsCoordinateUrl(coordinates?: { lng: number; lat: number } | null): string | null {
  if (!coordinates) return null;
  if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) return null;
  return `https://www.google.com/maps/@${coordinates.lat},${coordinates.lng},19z`;
}

function publicFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available yet";
  return String(value);
}

function buildWorkbenchIdentityLine(
  parcel: NormalizedOfficialParcel,
  workingAddress?: UserAddress | null,
) {
  const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "Selected erf";
  const workingLocation = [workingAddress?.streetName, workingAddress?.suburb, workingAddress?.town]
    .filter(Boolean)
    .join(", ");
  if (workingLocation) return `${erf} • ${workingLocation}`;

  const fallback = [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province].filter(
    Boolean,
  );
  return [erf, ...fallback].join(" • ");
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAttachmentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function SgDiagramEvidenceSection({
  parcelId,
  sgDoc,
  onOpenSource,
  onAttachmentCountChange,
}: {
  parcelId: string;
  sgDoc: SgDocumentResult;
  onOpenSource: (sourceId: string) => void;
  onAttachmentCountChange?: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vault = useErfFileVault(parcelId, ["sg_diagram"]);
  const attachments = vault.assets;
  const [readingAssetId, setReadingAssetId] = useState<string | null>(null);

  useEffect(() => {
    onAttachmentCountChange?.(attachments.length);
  }, [attachments.length, onAttachmentCountChange]);

  /**
   * Sends one SG diagram to the server-side reader so the diagram becomes
   * searchable evidence instead of a stored-but-opaque file. Never blocks the
   * upload itself: the file is already safe in the vault by this point.
   */
  async function readDiagram(asset: ErfAsset, retry = false) {
    setReadingAssetId(asset.id);
    try {
      const outcome = await extractErfAsset(asset.id, { expectedParcelId: parcelId, retry });
      if (outcome.success) {
        if (outcome.claimCount > 0) {
          toast.success(`Read ${outcome.claimCount} values from ${asset.original_file_name}.`);
        } else {
          toast.warning(`No readable diagram text was found in ${asset.original_file_name}.`);
        }
      } else {
        toast.error(outcome.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reading this diagram failed.");
    } finally {
      setReadingAssetId(null);
      await vault.refresh();
    }
  }

  async function uploadFiles(files: FileList | null | undefined) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (!vault.signedIn) {
      toast.error("Sign in to save SG files permanently to the Erf File Vault.");
      return;
    }
    let savedCount = 0;
    const uploaded: ErfAsset[] = [];
    for (const file of list) {
      const result = await vault
        .upload({
          file,
          fileName: file.name,
          category: "sg_diagram",
          assetType: "sg_diagram",
          sourceLabel: "User uploaded SG diagram",
          metadata: { source: "sources-tab" },
        })
        .catch((error: Error) => {
          toast.error(error.message);
          return null;
        });
      if (!result) continue;
      if (!result.ok) {
        if (result.reason === "too_large") {
          toast.error(`${file.name} is too large for the Erf File Vault.`);
        } else {
          toast.error(`${file.name} is not supported. Upload PDF, PNG, JPG, JPEG, TIF, or TIFF.`);
        }
        continue;
      }
      savedCount += 1;
      if (result.asset) uploaded.push(result.asset);
    }
    if (!savedCount) return;
    onAttachmentCountChange?.(attachments.length + savedCount);
    onOpenSource("sg-diagram-evidence");
    toast.success(
      savedCount === 1
        ? "SG diagram file saved to the Erf File Vault. Reading it now."
        : `${savedCount} SG diagram files saved to the Erf File Vault. Reading them now.`,
    );
    // Extraction runs after the upload has already succeeded, so a reader
    // failure can never lose the user's file.
    for (const asset of uploaded) {
      await readDiagram(asset);
    }
  }

  async function removeAttachment(attachment: ErfAsset) {
    await vault.remove(attachment);
    onAttachmentCountChange?.(Math.max(0, attachments.length - 1));
    toast.success("SG diagram attachment removed");
  }

  return (
    <article className="rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            SG Diagram / Official Parcel Diagram
          </div>
          <h4 className="mt-2 text-lg font-semibold tracking-tight text-[#0D1B2A]">
            Attach the official parcel diagram
          </h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
            The SG diagram is the official parcel diagram / plot map. Open the official SG document
            list, download the diagram, then upload it here so it stays with this erf file.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/58">
            Automatic SG import is not enabled yet. For now, download the official diagram and
            upload it here.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold",
            attachments.length ? "bg-emerald-600 text-white" : "bg-[#0D1B2A]/8 text-[#0D1B2A]/64",
          )}
        >
          {attachments.length
            ? `${attachments.length} file${attachments.length === 1 ? "" : "s"} in cloud vault`
            : "Not attached"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sgDoc.shown ? (
          <a
            href={sgDoc.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpenSource("sg-document-list")}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
          >
            Open SG document list
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/10 bg-[#0D1B2A]/5 px-4 py-2 text-xs font-semibold text-[#0D1B2A]/58">
            SG document list not available for this erf yet
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7d1f]"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload SG files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff"
          className="hidden"
          onChange={(event) => {
            void uploadFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {!sgDoc.shown && (
        <p className="mt-3 rounded-xl bg-[#0D1B2A]/5 px-3 py-2 text-[11px] leading-5 text-[#0D1B2A]/58">
          Missing buildable SG document fields: {sgDoc.reason}
        </p>
      )}

      <p className="mt-3 rounded-xl border border-dashed border-[#FF6A00]/28 bg-[#fff8ec] px-3 py-2 text-xs leading-5 text-[#0D1B2A]/66">
        Stored in the private cloud Erf File Vault for this signed-in user and parcel. Signed URLs
        expire safely; reopen the file if a preview link expires.
      </p>

      {vault.error && (
        <p className="mt-3 rounded-xl border border-[#C75A31]/25 bg-[#fff1e9] px-3 py-2 text-xs text-[#7A2D12]">
          {vault.error}
        </p>
      )}

      {vault.uploadState && (
        <p className="mt-3 rounded-xl border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-xs text-[#0D1B2A]/66">
          Upload progress: {vault.uploadState.progress}% - {vault.uploadState.label}
        </p>
      )}

      {vault.loading ? (
        <p className="mt-4 text-sm text-[#0D1B2A]/58">Checking cloud SG diagram attachment...</p>
      ) : attachments.length ? (
        <div className="mt-4 grid gap-3">
          {attachments.map((attachment) => (
            <SgAttachmentCard
              key={attachment.id}
              attachment={attachment}
              reading={readingAssetId === attachment.id}
              onOpen={() => void vault.open(attachment)}
              onRead={(retry) => void readDiagram(attachment, retry)}
              onRemove={() => void removeAttachment(attachment)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#0D1B2A]/58">
          No SG diagram attached yet. You can upload one even if the SG document list is not
          buildable for this erf.
        </p>
      )}
    </article>
  );
}

function SgAttachmentCard({
  attachment,
  reading,
  onOpen,
  onRead,
  onRemove,
}: {
  attachment: ErfAsset;
  reading: boolean;
  onOpen: () => void;
  onRead: (retry: boolean) => void;
  onRemove: () => void;
}) {
  const status = erfAssetExtractionStatus(attachment);
  const identity = erfAssetIdentityMatchStatus(attachment);
  const readable = isExtractableErfAsset(attachment);
  // A diagram that was never read, failed, or produced nothing must always be
  // retryable — a silently reference-only diagram is not acceptable evidence.
  const needsRetry =
    status === "failed" ||
    status === "partial" ||
    status === "unsupported" ||
    status === "not_started" ||
    identity === "unverified";
  const statusLabel = reading
    ? "Extracting diagram..."
    : erfAssetExtractionLabel(attachment, "diagram");

  return (
    <div className="rounded-[1.25rem] border border-emerald-500/24 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#0D1B2A]">
            {attachment.original_file_name}
          </div>
          <dl className="mt-2 grid gap-1 text-xs text-[#0D1B2A]/68 sm:grid-cols-2">
            <div>Type: {attachment.mime_type}</div>
            <div>Size: {formatFileSize(attachment.size_bytes)}</div>
            <div>Uploaded: {formatAttachmentDate(attachment.created_at)}</div>
            <div>Source: {attachment.source_label}</div>
          </dl>
          <div
            className={cn(
              "mt-2 inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold",
              identity === "mismatch"
                ? "bg-[#fff1e9] text-[#7A2D12]"
                : status === "ready"
                  ? "bg-emerald-600 text-white"
                  : "bg-[#0D1B2A]/8 text-[#0D1B2A]/68",
            )}
          >
            {statusLabel}
          </div>
          {identity === "mismatch" && (
            <p className="mt-2 text-xs font-medium leading-5 text-[#7A2D12]">
              This diagram describes a different property, so its contents are not used as evidence
              for this erf.
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
            SG evidence saved in the cloud Erf File Vault. This records evidence, not legal
            verification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readable && identity !== "mismatch" && (
            <button
              type="button"
              disabled={reading}
              onClick={() => onRead(needsRetry)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-700/20 bg-white px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reading ? "Extracting diagram..." : needsRetry ? "Retry extraction" : "Read diagram"}
            </button>
          )}

          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
          >
            Open signed file
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#C75A31]/25 bg-white px-4 py-2 text-xs font-semibold text-[#7A2D12] transition hover:bg-[#fff1e9]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove attachment
          </button>
        </div>
      </div>
    </div>
  );
}

function OfficialIdentityChecklist({
  parcel,
  sourceUrl,
  sgDoc,
  isCsg,
  status,
  workspaceState,
  onStatusChange,
  onOpenSource,
  onReviewSource,
  onSgAttachmentCountChange,
}: {
  parcel: NormalizedOfficialParcel;
  sourceUrl: string;
  sgDoc: SgDocumentResult;
  isCsg: boolean;
  status: IdentityCheckStatus;
  workspaceState: ErfWorkspaceState;
  onStatusChange: (status: IdentityCheckStatus) => void;
  onOpenSource: (sourceId: string) => void;
  onReviewSource: (sourceId: string) => void;
  onSgAttachmentCountChange: (count: number) => void;
}) {
  const coordinates = parcel.coordinates
    ? `${parcel.coordinates.lat.toFixed(6)}, ${parcel.coordinates.lng.toFixed(6)}`
    : "Not available yet";
  const parcelArea = parcel.knownFields.find((field) =>
    /^(geometry area|shape area|parcel area|erf size|area)$/i.test(field.label),
  )?.value;
  const hasParcelArea = parcelArea !== undefined && parcelArea !== null && parcelArea !== "";
  const boundaryStatus = parcel.layer
    ? "Boundary shown on map from selected public parcel layer"
    : parcel.coordinates
      ? "Selected point only"
      : "Not available yet";
  const sourceQuality = isCsg
    ? parcel.lpi || parcel.parcelKey
      ? "Official CSG parcel feature"
      : "Official CSG portal context"
    : "Municipal GIS layer context";
  const identifierText = [
    `Normalized parcel id: ${parcel.id}`,
    `Erf number: ${parcel.erfNumber ?? "Not available yet"}`,
    `Portion: ${parcel.portion ?? "Not available yet"}`,
    `Township / area: ${parcel.suburbOrArea ?? parcel.town ?? "Not available yet"}`,
    `Municipality: ${parcel.municipality ?? "Not available yet"}`,
    `Province: ${parcel.province ?? "Not available yet"}`,
    `LPI: ${parcel.lpi ?? "Not available yet"}`,
    `Parcel key: ${parcel.parcelKey ?? "Not available yet"}`,
    `Coordinates: ${coordinates}`,
    hasParcelArea ? `Parcel size / area: ${formatAreaM2(parcelArea)}` : null,
    `Boundary status: ${boundaryStatus}`,
  ].join("\n");

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
    } catch {
      toast.message("Copy failed. Select the text manually.");
    }
  }

  async function copyIdentifiers() {
    await copyText(identifierText, "Parcel identifiers copied");
  }

  type VerificationSource = {
    id: string;
    name: string;
    why: string;
    href?: string;
    actionLabel?: string;
    helper?: string;
    unavailableReason?: string;
    copyHelpers?: Array<{ label: string; value: string | null | undefined; success: string }>;
  };

  const verificationSources: VerificationSource[] = [
    {
      id: isCsg ? "csg-property-viewer" : "kouga-public-map",
      name: isCsg ? "CSG Property Viewer" : "Kouga Public Map",
      why: isCsg
        ? "Official CSG portal for checking parcel identity. It opens the viewer, not a guaranteed per-erf deep link."
        : "Municipal public map context for checking Kouga GIS layers tied to this selected feature.",
      href: sourceUrl,
      actionLabel: "Open source",
      helper: isCsg
        ? "CSG may open at the national viewer. Use the copied identifiers or coordinates to find this erf."
        : "Use the selected erf context and map layers after opening the municipal viewer.",
      copyHelpers: isCsg
        ? [
            { label: "Copy LPI", value: parcel.lpi, success: "LPI copied" },
            { label: "Copy parcel key", value: parcel.parcelKey, success: "Parcel key copied" },
            {
              label: "Copy coordinates",
              value: parcel.coordinates
                ? `${parcel.coordinates.lat.toFixed(6)}, ${parcel.coordinates.lng.toFixed(6)}`
                : null,
              success: "Coordinates copied",
            },
            {
              label: "Copy CSG search details",
              value: identifierText,
              success: "CSG search details copied",
            },
          ]
        : undefined,
    },
    {
      id: "deeds-registry-guidance",
      name: "Deeds registry guidance",
      why: "Official government guidance for deeds registry information. This is guidance, not free ownership verification.",
      href: GOVZA_DEEDS_GUIDANCE_URL,
      actionLabel: "Open guidance",
      helper:
        "Use this to understand the official deeds process. Easy Erf does not claim legally verified ownership.",
    },
  ];

  const sourceStatus = (source: VerificationSource) => {
    if (!source.href) return "Unavailable";
    if (workspaceState.reviewedSourceIds.includes(source.id)) return "Reviewed";
    if (workspaceState.openedSourceIds.includes(source.id)) return "Opened";
    return "Not opened";
  };

  const fieldGroups = [
    {
      title: "Parcel identity",
      fields: [
        ["Erf number", publicFieldValue(parcel.erfNumber)],
        ["Portion", publicFieldValue(parcel.portion)],
        ["Township / area", publicFieldValue(parcel.suburbOrArea ?? parcel.town)],
        ["Municipality", publicFieldValue(parcel.municipality)],
        ["Province", publicFieldValue(parcel.province)],
      ],
    },
    {
      title: "Official identifiers",
      fields: [
        ["LPI", publicFieldValue(parcel.lpi)],
        ["Parcel key", publicFieldValue(parcel.parcelKey)],
        [
          "Registration division",
          publicFieldValue(sgDoc.fieldsUsed.regDivision ?? sgDoc.fieldsUsed.minorRegion),
        ],
        ["SG/CSG office", sgDoc.shown ? "SGCTN / CSG document list" : "Not available yet"],
      ],
    },
    {
      title: "Map context",
      fields: [
        ["Coordinates", coordinates],
        ...(hasParcelArea ? [["Parcel size / area", formatAreaM2(parcelArea)]] : []),
        ["Source layer", publicFieldValue(parcel.layer)],
        ["Source quality", sourceQuality],
        ["Boundary status", boundaryStatus],
      ],
    },
  ];

  return (
    <section
      id="official-identity-check"
      className="mb-5 rounded-[1.75rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-5 text-[#0D1B2A] shadow-[0_20px_55px_-42px_rgba(13,27,42,0.48)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            Easy Erf Steps / Step 1
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Official parcel identity check
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            Compare these public parcel fields against the official source. Marking this step only
            records your research progress; it is not legal, surveying or ownership verification.
          </p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0D1B2A] ring-1 ring-[#0D1B2A]/10">
          {IDENTITY_STATUS_LABELS[status]}
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {fieldGroups.map((group) => (
          <section
            key={group.title}
            className="rounded-[1.35rem] border border-[#0D1B2A]/8 bg-white/88 p-4"
          >
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
              {group.title}
            </h4>
            <dl className="mt-3 grid gap-2">
              {group.fields.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#0D1B2A]/8 bg-[#fbf8f1]/70 p-3"
                >
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-[#0D1B2A]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {verificationSources.map((source, index) => {
          const statusLabel = sourceStatus(source);
          const reviewed = statusLabel === "Reviewed";
          const opened = statusLabel === "Opened";
          const unavailable = statusLabel === "Unavailable";

          return (
            <Fragment key={source.id}>
              {index === 1 && (
                <SgDiagramEvidenceSection
                  parcelId={parcel.id}
                  sgDoc={sgDoc}
                  onOpenSource={onOpenSource}
                  onAttachmentCountChange={onSgAttachmentCountChange}
                />
              )}
              <article
                className={cn(
                  "rounded-[1.35rem] border p-4 transition",
                  reviewed
                    ? "border-emerald-500/28 bg-emerald-50"
                    : opened
                      ? "border-[#FF6A00]/24 bg-[#fff8ec]"
                      : unavailable
                        ? "border-[#0D1B2A]/8 bg-white/58"
                        : "border-[#0D1B2A]/10 bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[#0D1B2A]">{source.name}</h4>
                    <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/64">{source.why}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                      reviewed
                        ? "bg-emerald-600 text-white"
                        : opened
                          ? "bg-[#FF6A00] text-white"
                          : unavailable
                            ? "bg-[#0D1B2A]/8 text-[#0D1B2A]/52"
                            : "bg-[#0D1B2A]/8 text-[#0D1B2A]/66",
                    )}
                  >
                    {reviewed && <CheckCircle2 className="h-3 w-3" />}
                    {statusLabel}
                  </span>
                </div>
                {source.helper && (
                  <p className="mt-3 rounded-xl bg-white/72 px-3 py-2 text-[11px] leading-5 text-[#0D1B2A]/62">
                    {source.helper}
                  </p>
                )}
                {source.copyHelpers && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {source.copyHelpers.map((helper) => (
                      <button
                        key={helper.label}
                        type="button"
                        disabled={!helper.value}
                        onClick={() => helper.value && copyText(helper.value, helper.success)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy className="h-3 w-3" />
                        {helper.label}
                      </button>
                    ))}
                  </div>
                )}
                {source.unavailableReason && (
                  <p className="mt-3 rounded-xl bg-[#0D1B2A]/5 px-3 py-2 text-[11px] leading-5 text-[#0D1B2A]/58">
                    {source.unavailableReason}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {source.href ? (
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onOpenSource(source.id)}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
                    >
                      {source.actionLabel ?? "Open source"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/10 bg-white/70 px-4 py-2 text-xs font-semibold text-[#0D1B2A]/52">
                      Source unavailable
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!source.href}
                    onClick={() => onReviewSource(source.id)}
                    className={cn(
                      "inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                      reviewed
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]",
                    )}
                  >
                    {reviewed ? "Reviewed" : "Mark reviewed"}
                  </button>
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyIdentifiers}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
        >
          Copy parcel identifiers
        </button>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onStatusChange("checked")}
          className={cn(
            "rounded-2xl border p-4 text-left text-sm font-semibold transition",
            status === "checked"
              ? "border-[#FF6A00]/35 bg-[#fff8ec] text-[#0D1B2A]"
              : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]",
          )}
        >
          {status === "checked" ? "Selected: I checked this source" : "I checked this source"}
          <span className="mt-1 block text-xs font-medium leading-5 text-[#0D1B2A]/62">
            Identity evidence started.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("looks_correct")}
          className={cn(
            "rounded-2xl border p-4 text-left text-sm font-semibold transition",
            status === "looks_correct"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-emerald-500/20 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
          )}
        >
          {status === "looks_correct"
            ? "Selected: Identity looks correct"
            : "Identity looks correct"}
          <span
            className={cn(
              "mt-1 block text-xs font-medium leading-5",
              status === "looks_correct" ? "text-white/78" : "text-emerald-900/70",
            )}
          >
            User checked, not legally verified.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("uncertain")}
          className={cn(
            "rounded-2xl border p-4 text-left text-sm font-semibold transition",
            status === "uncertain"
              ? "border-[#C75A31] bg-[#C75A31] text-white"
              : "border-[#C75A31]/20 bg-[#fff1e9] text-[#7A2D12] hover:bg-[#ffe7d8]",
          )}
        >
          {status === "uncertain" ? "Selected: Identity uncertain" : "Identity uncertain"}
          <span
            className={cn(
              "mt-1 block text-xs font-medium leading-5",
              status === "uncertain" ? "text-white/78" : "text-[#7A2D12]/72",
            )}
          >
            Keep verification as the next step.
          </span>
        </button>
      </div>
    </section>
  );
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
const MINI_MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

function SelectedErfMiniMap({
  coordinates,
  title,
  onBackToMap,
}: {
  coordinates?: { lng: number; lat: number } | null;
  title: string;
  onBackToMap: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState<string | null>(null);
  const coordinateLng = coordinates?.lng;
  const coordinateLat = coordinates?.lat;
  const hasCoordinates =
    Number.isFinite(coordinateLng) &&
    Number.isFinite(coordinateLat) &&
    coordinateLng !== undefined &&
    coordinateLat !== undefined &&
    coordinateLng >= -180 &&
    coordinateLng <= 180 &&
    coordinateLat >= -90 &&
    coordinateLat <= 90;

  useEffect(() => {
    setMapLoaded(false);
    setMapFailed(null);

    if (
      !hasCoordinates ||
      !MAPBOX_TOKEN ||
      coordinateLng === undefined ||
      coordinateLat === undefined ||
      !mapContainerRef.current
    ) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const markerEl = document.createElement("div");
    markerEl.className =
      "h-5 w-5 rounded-full border-2 border-white bg-[#FF6A00] shadow-[0_0_0_8px_rgba(255,106,0,0.22),0_14px_30px_-12px_rgba(13,27,42,0.75)]";
    markerEl.setAttribute("aria-label", `Approximate selected erf marker for ${title}`);

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setMapFailed("The interactive map took too long to load.");
    }, 9000);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MINI_MAP_STYLE,
      center: [coordinateLng, coordinateLat],
      zoom: 17.25,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = map;
    markerRef.current = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
      .setLngLat([coordinateLng, coordinateLat])
      .addTo(map);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    const handleLoad = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setMapLoaded(true);
      setMapFailed(null);
      map.resize();
      map.easeTo({
        center: [coordinateLng, coordinateLat],
        zoom: 17.25,
        duration: 0,
      });
    };

    const handleError = () => {
      setMapFailed("The interactive map style could not load.");
    };

    map.once("load", handleLoad);
    map.on("error", handleError);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      markerRef.current?.remove();
      markerRef.current = null;
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
    };
  }, [coordinateLat, coordinateLng, hasCoordinates, title]);

  if (!hasCoordinates || !MAPBOX_TOKEN) {
    const reason = !hasCoordinates
      ? "No selected-erf coordinate is available for this public feature."
      : "The Mapbox token is missing, so the interactive Workbench map cannot render.";
    const titleText = !hasCoordinates ? "Map context unavailable" : "Interactive map unavailable";
    return (
      <div className="grid min-h-[13rem] place-items-center rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-5 text-center">
        <div className="max-w-xs">
          <div className="text-sm font-semibold text-[#0D1B2A]">{titleText}</div>
          <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{reason}</p>
          {hasCoordinates && coordinateLat !== undefined && coordinateLng !== undefined && (
            <p className="mt-3 font-mono text-xs text-[#0D1B2A]/70">
              {coordinateLat.toFixed(6)}, {coordinateLng.toFixed(6)}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-5 text-[#0D1B2A]/58">
            Approximate map context from selected parcel click. No parcel boundary or GIS precision
            is fabricated here.
          </p>
          <button
            type="button"
            onClick={onBackToMap}
            className="mt-4 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D1B2A]/90"
          >
            Back to full map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 min-h-[13rem] overflow-hidden rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        aria-label={`Interactive selected-erf map for ${title}`}
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-[#0D1B2A]/86 px-3 py-2 text-[10px] font-medium leading-4 text-white/86 backdrop-blur">
        Pan and zoom to view the erf in area context. Approximate selected-erf context from selected
        parcel point.
      </div>
      {!mapLoaded && !mapFailed && (
        <div className="absolute inset-0 grid place-items-center bg-[#fbf8f1]/82 text-center backdrop-blur-sm">
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-xs font-semibold text-[#0D1B2A]">
            Loading interactive selected-erf map...
          </div>
        </div>
      )}
      {mapFailed && (
        <div className="absolute inset-0 grid place-items-center bg-white/94 p-5 text-center backdrop-blur">
          <div className="max-w-xs">
            <div className="text-sm font-semibold text-[#0D1B2A]">
              Interactive map could not render
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{mapFailed}</p>
            {coordinateLat !== undefined && coordinateLng !== undefined && (
              <p className="mt-3 font-mono text-xs text-[#0D1B2A]/70">
                {coordinateLat.toFixed(6)}, {coordinateLng.toFixed(6)}
              </p>
            )}
            <p className="mt-3 text-[11px] leading-5 text-[#0D1B2A]/58">
              Approximate map context from selected parcel click. No parcel boundary or GIS
              precision is fabricated here.
            </p>
            <button
              type="button"
              onClick={onBackToMap}
              className="mt-4 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D1B2A]/90"
            >
              Back to full map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkbenchNextStep({
  step,
  onAction,
}: {
  step: WorkbenchNextStepModel;
  onAction: () => void;
}) {
  return (
    <section className="mt-6 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#06152A] p-5 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.85)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            Next best step
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-white/68">{step.body}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-18px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F]"
        >
          {step.cta}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

type Geo = {
  streetNumber?: string;
  streetName?: string;
  nearestRoad?: string;
  suburb?: string;
  place?: string;
};

async function reverseGeocode(lng: number, lat: number): Promise<Geo | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,neighborhood,locality,place&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json.features?.[0];
    if (!feat) return null;
    const ctx: Array<{ id: string; text: string }> = feat.context ?? [];
    const suburb = ctx.find(
      (c) => c.id.startsWith("neighborhood") || c.id.startsWith("locality"),
    )?.text;
    const place = ctx.find((c) => c.id.startsWith("place"))?.text;
    const isAddress = feat.place_type?.includes("address");
    const streetNumber = isAddress && feat.address ? String(feat.address) : undefined;
    const streetName = isAddress ? (feat.text as string | undefined) : undefined;
    const nearestRoad = isAddress && !streetNumber ? (feat.text as string | undefined) : undefined;
    return { streetNumber, streetName, nearestRoad, suburb, place };
  } catch {
    return null;
  }
}

type AddressSource =
  | "Official Address"
  | "User Entered"
  | "Approximate Address"
  | "Nearest Road Only"
  | "Erf Only";

interface UserAddress {
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  town?: string;
  province?: string;
  notes?: string;
}

interface ResolvedLocation {
  displayTitle: string;
  displaySubtitle: string;
  approximateAddress?: string;
  nearestRoad?: string;
  streetNumber?: string;
  streetName?: string;
  addressConfidence: AddressSource;
  addressSource: AddressSource;
  researchQuery: string;
}

function resolveOfficialParcelLocation(opts: {
  erfNumber?: string | number;
  portion?: string | number;
  minorRegion?: string;
  majorRegion?: string;
  province?: string;
  latitude: number;
  longitude: number;
  geo: Geo | null;
  user?: UserAddress | null;
}): ResolvedLocation {
  const { erfNumber, minorRegion, majorRegion, province, geo, user } = opts;
  const erfLabel = erfNumber != null ? `Erf ${erfNumber}` : "Erf";

  // 1. User-entered (when meaningful)
  if (user && (user.streetNumber || user.streetName)) {
    const street = [user.streetNumber, user.streetName].filter(Boolean).join(" ");
    return {
      displayTitle: street ? `${erfLabel} - ${street}` : erfLabel,
      displaySubtitle: [user.suburb ?? minorRegion, user.town ?? majorRegion, "Working address"]
        .filter(Boolean)
        .join(" · "),
      approximateAddress: street,
      streetNumber: user.streetNumber,
      streetName: user.streetName,
      addressConfidence: "User Entered",
      addressSource: "User Entered",
      researchQuery: [
        street,
        erfLabel,
        user.suburb ?? minorRegion,
        user.town ?? majorRegion,
        user.province ?? province,
        "South Africa",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  // 2. Mapbox helper context only — never promote a guessed full address into the title.
  //    The official identity is the erf. Treat any street name as "nearest road" hint only.

  // 3. Mapbox returned only a road name — never promote to title
  const road = geo?.nearestRoad ?? geo?.streetName;
  const regionSubtitle = [minorRegion, majorRegion, province ?? "Eastern Cape"]
    .filter(Boolean)
    .join(" · ");
  if (road) {
    return {
      displayTitle: erfLabel,
      displaySubtitle: regionSubtitle,
      nearestRoad: road,
      addressConfidence: "Nearest Road Only",
      addressSource: "Nearest Road Only",
      researchQuery: [
        erfLabel,
        minorRegion,
        majorRegion,
        province ?? "Eastern Cape",
        road,
        "South Africa",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  // 4. Coordinates + region only — erf-first identity
  return {
    displayTitle: erfLabel,
    displaySubtitle: regionSubtitle,
    addressConfidence: "Erf Only",
    addressSource: "Erf Only",
    researchQuery: [erfLabel, minorRegion, majorRegion, province ?? "Eastern Cape", "South Africa"]
      .filter(Boolean)
      .join(" "),
  };
}

function userAddrKey(parcelId: string) {
  return `pa.userAddress.${parcelId}`;
}
function readUserAddress(parcelId: string): UserAddress | null {
  try {
    const v = window.localStorage.getItem(userAddrKey(parcelId));
    return v ? (JSON.parse(v) as UserAddress) : null;
  } catch {
    return null;
  }
}
export function OfficialParcelPanel({ selection, onClose }: Props) {
  const { user } = useAuth();
  const isCsg = selection.layer === "csg-parcels";
  const csg = useMemo(
    () => (isCsg ? normalizeCsg(selection.properties) : null),
    [selection.properties, isCsg],
  );
  const kouga = useMemo(
    () => (!isCsg ? normalizeKouga(selection.properties) : null),
    [selection.properties, isCsg],
  );
  const [tab, setTab] = useState<Tab>(() => readInitialTab());
  const [geo, setGeo] = useState<Geo | null>(null);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dossierContentRef = useRef<HTMLDivElement | null>(null);

  const [lng, lat] = selection.lngLat;
  const objectId =
    selection.properties.OBJECTID ?? selection.properties.ObjectID ?? selection.properties.objectid;
  const parcelId = buildOfficialParcelId({
    source: isCsg ? "csg" : "kouga",
    layer: selection.layer,
    objectId: objectId as string | number | null | undefined,
    lpi: csg?.lpi,
    parcelKey: csg?.parcelKey,
    erfNumber: csg?.erfNumber,
    portion: csg?.portion ?? 0,
    municipality: "Kouga Local Municipality",
    province: csg?.province ?? "Eastern Cape",
    lng: csg?.longitude ?? lng,
    lat: csg?.latitude ?? lat,
  });
  const {
    loading: marketAddressLoading,
    propertyIdentity,
    marketAddressIntelligence,
  } = useSavedMarketEvidence(parcelId);
  const [fetchedAt, setFetchedAt] = useState(() => new Date().toLocaleString());
  const [identityStatus, setIdentityStatus] = useState<IdentityCheckStatus>("needs_verification");
  const [workspaceState, setWorkspaceState] = useState<ErfWorkspaceState>(() =>
    readErfWorkspaceState(parcelId),
  );
  const [paidReportCount, setPaidReportCount] = useState(0);
  const paidReportVault = useErfFileVault(parcelId, ["paid_report"]);
  const [shareCopied, setShareCopied] = useState(false);
  const [workflowFeedback, setWorkflowFeedback] = useState<string | null>(null);

  const [userAddr, setUserAddr] = useState<UserAddress | null>(null);
  const savedMarketAddress = selectedMarketAddress(marketAddressIntelligence);
  const savedAddressOverride = savedMarketAddress
    ? marketAddressToPropertyIdentityOverride(savedMarketAddress)
    : propertyIdentity;
  const canonicalUserAddress: UserAddress | null = useMemo(
    () =>
      savedAddressOverride?.address
        ? {
            streetName: savedAddressOverride.address,
            suburb: savedAddressOverride.marketSuburb ?? undefined,
            notes: savedAddressOverride.note ?? undefined,
          }
        : userAddr,
    [savedAddressOverride, userAddr],
  );
  useEffect(() => {
    setTab(readInitialTab());
    scrollRef.current?.scrollTo({ top: 0 });
  }, [parcelId]);
  useEffect(() => {
    setFetchedAt(new Date().toLocaleString());
  }, [parcelId]);
  useEffect(() => {
    const workspace = readErfWorkspaceState(parcelId);
    const legacyIdentityStatus = readIdentityStatus(parcelId);
    const savedScenarioCount = readStrategyScenarios(parcelId).length;
    const mergedIdentityStatus =
      workspace.identityStatus === "none" && legacyIdentityStatus !== "needs_verification"
        ? identityStatusToWorkspace(legacyIdentityStatus)
        : workspace.identityStatus;
    const nextWorkspace =
      mergedIdentityStatus === workspace.identityStatus &&
      savedScenarioCount === workspace.strategyScenarioCount
        ? workspace
        : updateErfWorkspaceState(parcelId, {
            identityStatus: mergedIdentityStatus,
            strategyScenarioCount: savedScenarioCount,
          });
    setWorkspaceState(nextWorkspace);
    setIdentityStatus(workspaceStatusToIdentity(nextWorkspace.identityStatus));
    setShareCopied(false);
    setWorkflowFeedback(null);
  }, [parcelId]);
  useEffect(() => {
    function refresh(event: Event) {
      const detail = (event as CustomEvent<{ parcelId?: string }>).detail;
      if (detail?.parcelId && detail.parcelId !== parcelId) return;
      setWorkspaceState(readErfWorkspaceState(parcelId));
    }
    window.addEventListener("erfstoep:workspace-updated", refresh);
    return () => window.removeEventListener("erfstoep:workspace-updated", refresh);
  }, [parcelId]);
  useEffect(() => {
    setPaidReportCount(paidReportVault.assets.length);
  }, [paidReportVault.assets.length]);
  useEffect(() => {
    const a = readUserAddress(parcelId);
    setUserAddr(a);
  }, [parcelId]);

  useEffect(() => {
    let cancelled = false;
    setGeo(null);
    reverseGeocode(csg?.longitude ?? lng, csg?.latitude ?? lat).then((g) => {
      if (!cancelled) setGeo(g);
    });
    return () => {
      cancelled = true;
    };
  }, [parcelId, lng, lat, csg?.longitude, csg?.latitude]);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, parcelId]);

  const resolved = useMemo(
    () =>
      resolveOfficialParcelLocation({
        erfNumber: csg?.erfNumber,
        portion: csg?.portion,
        minorRegion: csg?.minorRegion,
        majorRegion: csg?.majorRegion,
        province: csg?.province ?? "Eastern Cape",
        latitude: csg?.latitude ?? lat,
        longitude: csg?.longitude ?? lng,
        geo,
        user: canonicalUserAddress,
      }),
    [csg, canonicalUserAddress, geo, lat, lng],
  );

  const sourceUrl = isCsg ? CSG_VIEWER_URL : KOUGA_PUBLIC_MAP_URL;
  const sgDoc = useMemo(
    () =>
      buildSgDocumentUrl({
        lpi: csg?.lpi,
        parcelKey: csg?.parcelKey,
        erfNumber: csg?.erfNumber,
        portion: csg?.portion,
        province: csg?.province,
        majorRegion: csg?.majorRegion,
        minorRegion: csg?.minorRegion,
      }),
    [
      csg?.erfNumber,
      csg?.lpi,
      csg?.majorRegion,
      csg?.minorRegion,
      csg?.parcelKey,
      csg?.portion,
      csg?.province,
    ],
  );
  const parcelRing = useMemo(
    () => extractExteriorRing(selection.geometry ?? null),
    [selection.geometry],
  );
  const recordedAreaM2 = useMemo(() => {
    const resolved = resolveParcelArea(selection.properties ?? {});
    return resolved?.areaM2 ?? null;
  }, [selection.properties]);
  const normalizedParcel: NormalizedOfficialParcel = useMemo(() => {

    const coords = { lng: csg?.longitude ?? lng, lat: csg?.latitude ?? lat };
    const knownFields: NormalizedOfficialParcel["knownFields"] = [];
    const pushKnown = (label: string, value: unknown, source: string) => {
      if (value === null || value === undefined || value === "") return;
      knownFields.push({ label, value: String(value), source });
    };

    if (csg) {
      pushKnown("Erf number", csg.erfNumber, "Chief Surveyor-General");
      pushKnown("Portion", csg.portion, "Chief Surveyor-General");
      pushKnown("LPI / ID", csg.lpi, "Chief Surveyor-General");
      pushKnown("Parcel key", csg.parcelKey, "Chief Surveyor-General");
      pushKnown("Province", csg.province, "Chief Surveyor-General");
      pushKnown("Major region", csg.majorRegion, "Chief Surveyor-General");
      pushKnown("Minor region", csg.minorRegion, "Chief Surveyor-General");
      pushKnown("Geometry area", csg.geometryArea, "Chief Surveyor-General");
    }

    if (kouga) {
      pushKnown("Zoning code", kouga.zoningCode, "Kouga Municipality GIS");
      pushKnown("Zoning type", kouga.zoningType, "Kouga Municipality GIS");
      pushKnown("Zoning description", kouga.zoningDescription, "Kouga Municipality GIS");
      pushKnown("Shape area", kouga.shapeArea, "Kouga Municipality GIS");
    }

    if (canonicalUserAddress?.streetName) {
      pushKnown("Working address", canonicalUserAddress.streetName, "User supplied market address");
    }
    if (canonicalUserAddress?.notes) {
      pushKnown("Working address note", canonicalUserAddress.notes, "User supplied market address");
    }

    pushKnown("Longitude", coords.lng.toFixed(6), "Map click");
    pushKnown("Latitude", coords.lat.toFixed(6), "Map click");

    return {
      id: parcelId,
      source: isCsg ? "csg" : "kouga",
      sourceLabel: isCsg ? "Chief Surveyor-General" : "Kouga Municipality GIS",
      layer: selection.layer,
      erfNumber: csg?.erfNumber ?? null,
      portion: csg?.portion ?? null,
      lpi: csg?.lpi ?? null,
      parcelKey: csg?.parcelKey ?? null,
      objectId: objectId as string | number | null | undefined,
      municipality: "Kouga Local Municipality",
      province: csg?.province ?? canonicalUserAddress?.province ?? "Eastern Cape",
      suburbOrArea:
        canonicalUserAddress?.suburb ?? csg?.minorRegion ?? resolved.displaySubtitle ?? null,
      town: canonicalUserAddress?.town ?? csg?.majorRegion ?? null,
      coordinates: coords,
      knownFields,
      missingFields: [
        "Ownership",
        "Valuation",
        "Transfers",
        "Rates and taxes",
        "Paid provider reports",
      ],
      rawProperties: selection.properties,
    };
  }, [
    csg,
    kouga,
    lat,
    lng,
    objectId,
    parcelId,
    resolved.displaySubtitle,
    selection.layer,
    selection.properties,
    isCsg,
    canonicalUserAddress,
  ]);
  const selectedErfGoogleMapsUrl = googleMapsCoordinateUrl(normalizedParcel.coordinates);

  async function toggleSave() {
    if (!user) {
      toast.message("Sign in to save properties");
      return;
    }
    if (saved) {
      await supabase
        .from("saved_properties")
        .delete()
        .eq("user_id", user.id)
        .eq("parcel_id", parcelId);
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      const userData = {
        normalizedParcelId: parcelId,
        provider: csg ? "Chief Surveyor-General" : "Kouga Municipality GIS",
        sourceLayer: selection.layer,
        displayTitle: resolved.displayTitle,
        displaySubtitle: resolved.displaySubtitle,
        approximateAddress: resolved.approximateAddress ?? null,
        streetNumber: resolved.streetNumber ?? null,
        streetName: resolved.streetName ?? null,
        nearestRoad: resolved.nearestRoad ?? null,
        erfNumber: csg?.erfNumber ?? null,
        portion: csg?.portion ?? null,
        lpi: csg?.lpi ?? null,
        parcelKey: csg?.parcelKey ?? null,
        municipality: "Kouga Local Municipality",
        province: csg?.province ?? null,
        town: csg?.majorRegion ?? null,
        majorRegion: csg?.majorRegion ?? null,
        minorRegion: csg?.minorRegion ?? null,
        geometryArea: csg?.geometryArea ?? null,
        zoningCode: (kouga?.zoningCode as string | number | null) ?? null,
        zoningType: (kouga?.zoningType as string | number | null) ?? null,
        lng: csg?.longitude ?? lng,
        lat: csg?.latitude ?? lat,
        longitude: csg?.longitude ?? lng,
        latitude: csg?.latitude ?? lat,
        addressSource: resolved.addressSource,
        addressConfidence: resolved.addressConfidence,
        researchQuery: resolved.researchQuery,
        userEntered: userAddr ?? null,
        fetchedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("saved_properties").insert({
        user_id: user.id,
        parcel_id: parcelId,
        external_links: [
          {
            label: isCsg ? "CSG Viewer" : "Kouga Mapping Portal",
            url: sourceUrl,
            category: "official",
          },
        ],
        user_data: userData as unknown as Record<string, unknown> as never,
      });
      if (error) toast.error(error.message);
      else {
        setSaved(true);
        toast.success("Saved to your properties");
      }
    }
  }

  function setWorkspacePatch(patch: Partial<ErfWorkspaceState>) {
    const next = updateErfWorkspaceState(parcelId, patch);
    setWorkspaceState(next);
    return next;
  }

  function addWorkspaceSourceId(key: "openedSourceIds" | "reviewedSourceIds", sourceId: string) {
    const current = workspaceState[key];
    const nextIds = Array.from(new Set([...current, sourceId]));
    return setWorkspacePatch({
      [key]: nextIds,
      dirty: true,
    } as Partial<ErfWorkspaceState>);
  }

  function markSourceOpened(sourceId: string) {
    addWorkspaceSourceId("openedSourceIds", sourceId);
    setWorkflowFeedback("Opened. Mark reviewed after checking the details.");
  }

  function markSourceReviewed(sourceId: string) {
    const openedSourceIds = Array.from(new Set([...workspaceState.openedSourceIds, sourceId]));
    const reviewedSourceIds = Array.from(new Set([...workspaceState.reviewedSourceIds, sourceId]));
    setWorkspacePatch({ openedSourceIds, reviewedSourceIds, dirty: true });
    setWorkflowFeedback("Reviewed by user. This records progress, not legal verification.");
    toast.success("Source marked reviewed");
  }

  function updateSgAttachmentCount(count: number) {
    if (workspaceState.sgDiagramAttachmentCount === count) return;
    setWorkspacePatch({
      sgDiagramAttachmentCount: count,
      openedSourceIds: Array.from(
        new Set([...workspaceState.openedSourceIds, "sg-diagram-evidence"]),
      ),
      dirty: true,
    });
  }

  /** Records that the user chose to skip a guided evidence task. */
  function skipGuidedTask(taskId: string) {
    const skippedTaskIds = Array.from(
      new Set([...workspaceState.investigation.skippedTaskIds, taskId]),
    );
    setWorkspacePatch({
      investigation: { ...workspaceState.investigation, skippedTaskIds },
      dirty: true,
    });
    setWorkflowFeedback("Task skipped. Easy Erf will suggest the next best evidence action.");
  }

  function selectWorkbenchTab(
    nextTab: Tab,
    options?: { markStarted?: boolean; anchorId?: string },
  ) {
    if (options?.markStarted) {
      if (nextTab === "listings") {
        setWorkspacePatch({ marketEvidenceStarted: true, dirty: true });
        setWorkflowFeedback(
          "Market step started. Save a listing, comp, address or note to move toward Strategy.",
        );
      }
      if (nextTab === "calculators") {
        setWorkspacePatch({ calculatorStarted: true, dirty: true });
        setWorkflowFeedback(
          "Strategy Lab started. Calculator outputs are estimates from your assumptions.",
        );
      }
      if (nextTab === "reports") {
        setWorkspacePatch({ reportStarted: true, dirty: true });
        setWorkflowFeedback(
          "Paid Reports opened. These are optional confidence upgrades, not required to continue.",
        );
      }
      if (nextTab === "stoep-report") {
        setWorkspacePatch({ reportStarted: true, dirty: true });
        setWorkflowFeedback(
          "Easy Erf Report opened. It assembles saved evidence and assumptions without fake data.",
        );
      }
    }
    setTab(nextTab);
    requestAnimationFrame(() => {
      if (options?.anchorId) {
        const target = document.getElementById(options.anchorId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }

  function updateIdentityStatus(nextStatus: IdentityCheckStatus) {
    setIdentityStatus(nextStatus);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(identityStatusKey(parcelId), nextStatus);
    }
    setWorkspacePatch({
      identityStatus: identityStatusToWorkspace(nextStatus),
      dirty: true,
    });
    const message =
      nextStatus === "checked"
        ? "Official identity evidence started. Next: mark a source reviewed or confirm the identity."
        : nextStatus === "looks_correct"
          ? "Identity marked as looking correct. Next: build market evidence."
          : "Identity marked uncertain. Resolve identity before using market or strategy tools.";
    setWorkflowFeedback(message);
    toast.success(message);
  }

  function saveErfFile() {
    setWorkspacePatch({ saved: true, dirty: false });
    toast.success("Erf file saved locally");
  }

  async function shareErfFile() {
    const shareText = [
      resolved.displayTitle,
      `Parcel ID: ${parcelId}`,
      normalizedParcel.erfNumber ? `Erf: ${normalizedParcel.erfNumber}` : null,
      normalizedParcel.portion != null ? `Portion: ${normalizedParcel.portion}` : null,
      normalizedParcel.coordinates
        ? `Coordinates: ${normalizedParcel.coordinates.lat.toFixed(6)}, ${normalizedParcel.coordinates.lng.toFixed(6)}`
        : null,
      typeof window !== "undefined" ? window.location.href : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(shareText);
      setShareCopied(true);
      toast.success("Erf file link copied");
    } catch {
      setShareCopied(true);
      toast.message("Copy failed. Parcel ID is visible in this Workbench.");
    }
  }

  function handleBackToMap() {
    if (
      workspaceState.dirty &&
      typeof window !== "undefined" &&
      !window.confirm("You made changes to this erf file. Leave without saving?")
    ) {
      return;
    }
    onClose();
  }

  const activeSection = WORKBENCH_SECTIONS[tab];
  const isInvestigation = tab === "investigation";
  const workbenchIdentityLine = buildWorkbenchIdentityLine(normalizedParcel, canonicalUserAddress);
  const pageNextStep = buildWorkbenchPageNextStep(tab, { paidReportCount, workspaceState });
  const fileArea = normalizedParcel.suburbOrArea ?? normalizedParcel.town ?? "Area not confirmed";
  const fileRegion = [normalizedParcel.municipality, normalizedParcel.province]
    .filter(Boolean)
    .join(" / ");

  return (
    <aside className="pointer-events-auto fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-[#f8fafc]/96 shadow-[0_28px_90px_rgba(13,27,42,0.28)] backdrop-blur-xl">
      <nav className="hidden absolute inset-y-0 left-0 z-40 w-64 overflow-y-auto overscroll-contain border-r border-white/10 bg-[#0D1B2A] p-4 text-white md:flex md:flex-col [scrollbar-width:thin]">
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFB86B]">
            Easy Erf
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight">Workbench rail</div>
        </div>
        <div className="mb-4 rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_20px_44px_-28px_rgba(0,0,0,0.7)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            Erf File
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold tracking-tight">
            {normalizedParcel.erfNumber
              ? `Erf ${normalizedParcel.erfNumber}`
              : resolved.displayTitle}
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-white/62">{fileArea}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/48">
            {fileRegion || "Municipality / province not confirmed"}
          </p>
          <div
            className={cn(
              "mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
              workspaceState.saved
                ? "bg-emerald-400/16 text-emerald-100 ring-1 ring-emerald-300/20"
                : "bg-[#FFB86B]/16 text-[#FFE0BA] ring-1 ring-[#FFB86B]/20",
            )}
          >
            {workspaceState.saved
              ? workspaceState.dirty
                ? "Saved / unsaved changes"
                : "Saved"
              : "Unsaved"}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={saveErfFile}
              className="rounded-full bg-[#FF6A00] px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#FF7D1F]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={shareErfFile}
              className="rounded-full border border-white/14 bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/16"
            >
              {shareCopied ? "Copied" : "Share"}
            </button>
            <button
              type="button"
              onClick={() => selectWorkbenchTab("reports", { markStarted: true })}
              className="rounded-full border border-white/14 bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/16"
            >
              Paid
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleBackToMap}
          className="mb-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
        >
          <X className="h-4 w-4" />
          Back to full map
        </button>
        <div className="space-y-1">
          {WORKBENCH_NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectWorkbenchTab(item.id)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                  active
                    ? "bg-[linear-gradient(135deg,#FF6A00_0%,#B64A09_45%,#0D1B2A_100%)] text-white shadow-[0_16px_36px_-18px_rgba(255,106,0,0.85)] ring-1 ring-[#FFB86B]/35"
                    : "text-white/72 hover:bg-white/10 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
          <div className="mt-2 border-t border-white/10 pt-2">
            {WORKBENCH_NAV_MORE.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectWorkbenchTab(item.id)}
                  className={cn(
                    "flex min-h-10 w-full items-center rounded-2xl px-4 py-2.5 text-left text-xs font-semibold transition",
                    active
                      ? "bg-white/14 text-white"
                      : "text-white/58 hover:bg-white/8 hover:text-white",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-auto rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            Paid reports
          </div>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Optional confidence upgrades. Buy a report or upload a PDF you already purchased; the
            free workflow still works.
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => selectWorkbenchTab("reports", { markStarted: true })}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF7D1F]"
            >
              Buy a report
            </button>
            <button
              type="button"
              onClick={() => selectWorkbenchTab("reports", { markStarted: true })}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/16"
            >
              Upload report PDF
            </button>
          </div>
        </div>
      </nav>

      <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#0D1B2A]/10 bg-[#fbf8f1]/95 px-4 pb-3 pt-4 shadow-sm backdrop-blur max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)] md:ml-64 md:px-7">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6A00]">
            Erf Workbench
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Official Public Data
            </span>
            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-foreground">
              {isCsg ? "CSG" : "Kouga"}
            </span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {resolved.displayTitle}
          </h2>
          {resolved.displaySubtitle && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {resolved.displaySubtitle}
            </div>
          )}
          <div className="mt-2 inline-flex rounded-full bg-[#0D1B2A]/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0D1B2A] md:hidden">
            {workspaceState.saved
              ? workspaceState.dirty
                ? "Saved / unsaved changes"
                : "Saved"
              : "Unsaved"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleSave}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-stone-900 shadow-sm hover:bg-amber-100 md:min-h-0 md:border-0 md:bg-transparent md:p-2 md:text-foreground md:shadow-none md:hover:bg-muted"
            title={saved ? "Saved" : "Save property"}
            aria-label={saved ? "Saved erf" : "Save erf"}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-emerald-700 md:text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            <span className="md:hidden">{saved ? "Saved" : "Save erf"}</span>
          </button>
          <button className="hidden rounded-full p-2 hover:bg-muted md:inline-flex" title="Share">
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleBackToMap}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#142941] md:px-4"
            aria-label="Back to map"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Back to full map</span>
            <span className="sm:hidden">Back to map</span>
          </button>
        </div>
        <nav
          className="mobile-workbench-nav -mx-1 flex w-full gap-2 overflow-x-auto pb-1 md:hidden"
          aria-label="Mobile Workbench navigation"
        >
          {[...WORKBENCH_NAV, ...WORKBENCH_NAV_MORE].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectWorkbenchTab(item.id)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                  active
                    ? "border-[#FF8A33]/70 bg-[linear-gradient(135deg,#FF6A00_0%,#B64A09_55%,#0D1B2A_100%)] text-white shadow-[0_12px_28px_-20px_rgba(255,106,0,0.9)]"
                    : "border-[#0D1B2A]/12 bg-white/82 text-[#0D1B2A] hover:bg-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-thin relative h-[calc(100dvh-5.25rem)] min-h-0 overflow-y-auto overscroll-contain pb-8 md:ml-64"
      >
        {!isInvestigation && (
          <>
            <section className="mx-4 mt-4 rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white/88 px-4 py-3 shadow-[0_16px_44px_-36px_rgba(13,27,42,0.45)] md:mx-7 md:mt-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
                Current erf file
              </div>
              <p className="mt-1 text-sm font-semibold tracking-tight text-[#0D1B2A] md:text-base">
                {workbenchIdentityLine}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/58">
                Working address is stored separately from the official parcel identity.
              </p>
            </section>

            <section className="mx-4 mt-3 rounded-[1.35rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3 shadow-[0_18px_42px_-36px_rgba(13,27,42,0.35)] md:mx-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                    Enhance this erf file
                  </div>
                  <p className="mt-1 max-w-4xl text-sm leading-6 text-[#0D1B2A]/72">
                    Add Lightstone or WinDeed report documents when you have them to keep valuation,
                    ownership, transfer, and deeds-level context in one place. Public sources still
                    power the first read.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectWorkbenchTab("reports", { markStarted: true })}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
                >
                  Add report documents
                </button>
              </div>
            </section>
          </>
        )}

        {!isInvestigation && (
          <section className="mx-4 mt-4 rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white/92 p-5 shadow-[0_18px_48px_-36px_rgba(13,27,42,0.42)] backdrop-blur md:mx-7 md:mt-7 md:p-6">
            <div className="inline-flex items-center rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-[#0D1B2A]/10">
              Workbench / {activeSection.title}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A] md:text-3xl">
              {activeSection.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66 md:text-base md:leading-7">
              {activeSection.subtitle}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#0D1B2A]/62">
              {activeSection.guidance}
            </p>
          </section>
        )}

        {isInvestigation ? (
          <section className="mx-4 mt-4 md:mx-7 md:mt-7">
            <InvestigationHome
              parcel={normalizedParcel}
              workspaceState={workspaceState}
              onSelectView={(view: DossierView, options?: { anchorId?: string }) =>
                selectWorkbenchTab(view as Tab, {
                  markStarted:
                    view === "listings" ||
                    view === "calculators" ||
                    view === "reports" ||
                    view === "stoep-report",
                  anchorId: options?.anchorId,
                })
              }
              onSkipTask={skipGuidedTask}
              mapSlot={
                <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/88 p-4 shadow-[0_18px_45px_-38px_rgba(13,27,42,0.42)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
                      Selected erf on the map
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleBackToMap}
                        className="rounded-full bg-[#0D1B2A] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#142941]"
                      >
                        Back to full map
                      </button>
                      {selectedErfGoogleMapsUrl && (
                        <a
                          href={selectedErfGoogleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35"
                        >
                          Google Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <SelectedErfMiniMap
                      coordinates={normalizedParcel.coordinates}
                      title={resolved.displayTitle}
                      onBackToMap={handleBackToMap}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[#0D1B2A]/58">
                    Map position is approximate context, not a boundary confirmation.
                  </p>
                </section>
              }
            />
          </section>
        ) : null}

        <div ref={dossierContentRef} className="px-5 pt-4">
          {tab === "investigation" && null}

          {tab === "research" && (
            <>
              <OfficialIdentityChecklist
                parcel={normalizedParcel}
                sourceUrl={sourceUrl}
                sgDoc={sgDoc}
                isCsg={isCsg}
                status={identityStatus}
                workspaceState={workspaceState}
                onStatusChange={updateIdentityStatus}
                onOpenSource={markSourceOpened}
                onReviewSource={markSourceReviewed}
                onSgAttachmentCountChange={updateSgAttachmentCount}
              />
              <ErfResearchDossier parcel={normalizedParcel} view="research" />
            </>
          )}
          {tab === "zoning-build" && (
            <ZoningBuildTab
              parcel={normalizedParcel}
              onOpenTab={(next) => selectWorkbenchTab(next as Tab, { markStarted: true })}
            />
          )}
          {tab === "site-potential" && (
            <SitePotentialTab
              parcel={normalizedParcel}
              parcelRing={parcelRing}
              recordedAreaM2={recordedAreaM2}
              workspaceState={workspaceState}

              onUpdateSite={(patch) =>
                setWorkspacePatch({
                  sitePotential: { ...workspaceState.sitePotential, ...patch },
                  dirty: true,
                })
              }
              onExploreReport={() => selectWorkbenchTab("stoep-report", { markStarted: true })}
              onOpenTab={(next) => selectWorkbenchTab(next as Tab, { markStarted: true })}
            />
          )}
          {tab === "listings" && <ErfResearchDossier parcel={normalizedParcel} view="listings" />}
          {tab === "reports" && <ErfResearchDossier parcel={normalizedParcel} view="reports" />}
          {tab === "notes" && <ErfResearchDossier parcel={normalizedParcel} view="notes" />}
          {tab === "calculators" && (
            <ErfResearchDossier
              parcel={normalizedParcel}
              view="calculators"
              onSelectView={(view) => selectWorkbenchTab(view as Tab, { markStarted: true })}
            />
          )}
          {tab === "stoep-report" && (
            <ErfResearchDossier
              parcel={normalizedParcel}
              parcelRing={parcelRing}
              view="stoep-report"

              onSelectView={(view) => selectWorkbenchTab(view as Tab, { markStarted: true })}
            />
          )}
          {tab === "local-services" && (
            <LocalPropertyTeam
              parcel={normalizedParcel}
              siteMode={workspaceState.sitePotential.mode}
              marketAddress={savedMarketAddress}
              marketAddressLoading={marketAddressLoading}
              onOpenMarket={() => selectWorkbenchTab("listings", { markStarted: true })}
            />
          )}

          {!isInvestigation && (
            <WorkbenchNextStep
              step={pageNextStep}
              onAction={() => {
                if (pageNextStep.anchorId && pageNextStep.tab === tab) {
                  document.getElementById(pageNextStep.anchorId)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  return;
                }
                selectWorkbenchTab(pageNextStep.tab, { markStarted: pageNextStep.markStarted });
              }}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
