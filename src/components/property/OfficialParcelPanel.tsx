import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  X,
  ShieldCheck,
  MapPin,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Share2,
  ChevronRight,
  FolderOpen,
  Calculator,
  FileText,
  CheckCircle2,
  ExternalLink,
  Copy,
  Upload,
  Trash2,
} from "lucide-react";
import { type OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { ErfResearchDossier } from "./ErfResearchDossier";
import {
  buildOfficialParcelId,
  type NormalizedOfficialParcel,
} from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  CSG_VIEWER_URL,
  GOVZA_DEEDS_GUIDANCE_URL,
  KOUGA_PUBLIC_MAP_URL,
} from "@/lib/external-urls";
import { buildSgDocumentUrl, type SgDocumentResult } from "@/lib/research/sgDocument";
import {
  buildErfWorkspaceNextStep,
  buildStoepStepProgress,
  readErfWorkspaceState,
  updateErfWorkspaceState,
  type ErfWorkspaceIdentityStatus,
  type ErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import {
  isPdfAttachment,
  isPreviewableImageAttachment,
  isTiffAttachment,
  readSgDiagramAttachment,
  removeSgDiagramAttachment,
  saveSgDiagramAttachment,
  SG_DIAGRAM_MAX_BYTES,
  type ErfWorkspaceAttachmentRecord,
} from "@/lib/workbench/erfWorkspaceFiles";
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

type Tab = "overview" | "research" | "listings" | "reports" | "notes" | "calculators";
const WORKBENCH_NAV: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "research", label: "Sources" },
  { id: "listings", label: "Market" },
  { id: "reports", label: "Reports" },
  { id: "calculators", label: "Strategy" },
  { id: "notes", label: "Notes" },
];

const WORKBENCH_SECTIONS: Record<
  Tab,
  { title: string; subtitle: string; guidanceTitle: string; guidance: string }
> = {
  overview: {
    title: "Overview",
    subtitle: "Start with the first read, evidence readiness, and the recommended next step.",
    guidanceTitle: "Stoep AI First Read",
    guidance: "Use this first read to decide what evidence to check next.",
  },
  research: {
    title: "Official Sources",
    subtitle: "Check public records and source links tied to this erf.",
    guidanceTitle: "Source-check guidance",
    guidance:
      "Start with official and municipal records. Keep ownership, valuation and zoning marked needs evidence until a verified source supports them.",
  },
  listings: {
    title: "Market Evidence",
    subtitle: "Build comps, listing evidence, and manual market notes.",
    guidanceTitle: "Comp-building guidance",
    guidance:
      "Use listings as evidence to save and compare. Portal results may be nearby or unrelated, so verify each comp before it informs your view.",
  },
  reports: {
    title: "Report Vault",
    subtitle: "Add or upload Lightstone, WinDeed, SG, zoning, title deed, or other evidence.",
    guidanceTitle: "Evidence vault guidance",
    guidance:
      "Paid reports are optional confidence upgrades. Upload or attach evidence when you have it; the basic workflow still works without a purchase.",
  },
  calculators: {
    title: "Strategy Lab",
    subtitle: "Run the numbers before deciding whether to buy, hold, flip, or build.",
    guidanceTitle: "Number-check guidance",
    guidance:
      "Treat calculator outputs as estimates from your assumptions, not verified valuations or investment advice.",
  },
  notes: {
    title: "Notes",
    subtitle: "Capture your research, questions, and decision notes.",
    guidanceTitle: "Research notes guidance",
    guidance:
      "Keep open questions, evidence links and decision notes together so the erf stays reviewable later.",
  },
};

const ASK_STOEP_PROMPTS: { label: string; tab: Tab }[] = [
  { label: "What is risky?", tab: "research" },
  { label: "What should I verify?", tab: "research" },
  { label: "Run the numbers", tab: "calculators" },
];

function readInitialTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "calc" || value === "calculators" ? "calculators" : "overview";
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

function panelFirstRead(parcel: NormalizedOfficialParcel): string {
  const identity = [
    parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "this official erf",
    parcel.portion != null && String(parcel.portion) !== "0" ? `Portion ${parcel.portion}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const location = [parcel.suburbOrArea, parcel.municipality, parcel.province]
    .filter(Boolean)
    .join(", ");

  return `${identity}${location ? ` in ${location}` : ""} has enough public context for an early read. Ownership, valuation, zoning, sales history and GIS precision still need verified evidence.`;
}

function formatMapCoordinate(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "Not available";
}

function formatAreaM2(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Area not available";
  return `${Math.round(n).toLocaleString()} m²`;
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
}: {
  parcelId: string;
  sgDoc: SgDocumentResult;
  onOpenSource: (sourceId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [attachment, setAttachment] = useState<ErfWorkspaceAttachmentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const isPdf = attachment ? isPdfAttachment(attachment.fileName, attachment.fileType) : false;
  const isImage = attachment
    ? isPreviewableImageAttachment(attachment.fileName, attachment.fileType)
    : false;
  const isTiff = attachment ? isTiffAttachment(attachment.fileName, attachment.fileType) : false;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setStorageError(null);
    readSgDiagramAttachment(parcelId)
      .then((record) => {
        if (!alive) return;
        setAttachment(record);
      })
      .catch((error: Error) => {
        if (!alive) return;
        setStorageError(error.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [parcelId]);

  useEffect(() => {
    if (!attachment) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(attachment.file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [attachment]);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    const result = await saveSgDiagramAttachment(parcelId, file).catch((error: Error) => {
      setStorageError(error.message);
      return null;
    });
    if (!result) return;
    if (!result.ok) {
      if (result.reason === "too_large") {
        toast.error(
          "File is too large for local browser storage. Please upload a smaller PDF/image.",
        );
      } else {
        toast.error("Unsupported file type. Upload a PDF, PNG, JPG, JPEG, TIF, or TIFF file.");
      }
      return;
    }
    setAttachment(result.record);
    setStorageError(null);
    onOpenSource("sg-diagram-evidence");
    toast.success("SG diagram attached to this erf file.");
  }

  async function removeAttachment() {
    await removeSgDiagramAttachment(parcelId);
    setAttachment(null);
    toast.success("SG diagram attachment removed");
  }

  return (
    <section className="mt-5 rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            SG Diagram Evidence
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
            attachment ? "bg-emerald-600 text-white" : "bg-[#0D1B2A]/8 text-[#0D1B2A]/64",
          )}
        >
          {attachment ? "Attached locally" : "Not attached"}
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
          Upload SG diagram
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff"
          className="hidden"
          onChange={(event) => {
            void uploadFile(event.target.files?.[0]);
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
        Stored locally in this browser for this erf. Save/export support will come later. Maximum
        local attachment size is {formatFileSize(SG_DIAGRAM_MAX_BYTES)}.
      </p>

      {storageError && (
        <p className="mt-3 rounded-xl border border-[#C75A31]/25 bg-[#fff1e9] px-3 py-2 text-xs text-[#7A2D12]">
          {storageError}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-[#0D1B2A]/58">Checking local SG diagram attachment...</p>
      ) : attachment ? (
        <div className="mt-4 rounded-[1.25rem] border border-emerald-500/24 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-[#0D1B2A]">{attachment.fileName}</div>
              <dl className="mt-2 grid gap-1 text-xs text-[#0D1B2A]/68 sm:grid-cols-2">
                <div>Type: {attachment.fileType}</div>
                <div>Size: {formatFileSize(attachment.fileSize)}</div>
                <div>Uploaded: {formatAttachmentDate(attachment.uploadedAt)}</div>
                <div>Source: {attachment.sourceLabel}</div>
              </dl>
              <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                SG diagram attached to this erf file. This records evidence, not legal verification.
              </p>
              {isTiff && (
                <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[#0D1B2A]/62">
                  TIFF preview may not display in all browsers. The file is still attached to this
                  erf.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
                >
                  View attachment
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => void removeAttachment()}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#C75A31]/25 bg-white px-4 py-2 text-xs font-semibold text-[#7A2D12] transition hover:bg-[#fff1e9]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove attachment
              </button>
            </div>
          </div>

          {previewUrl && isImage && (
            <img
              src={previewUrl}
              alt="User uploaded SG diagram preview"
              className="mt-4 max-h-72 w-full rounded-2xl border border-emerald-500/20 object-contain bg-white"
            />
          )}
          {previewUrl && isPdf && (
            <iframe
              title="User uploaded SG diagram PDF preview"
              src={previewUrl}
              className="mt-4 h-72 w-full rounded-2xl border border-emerald-500/20 bg-white"
            />
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#0D1B2A]/58">
          No SG diagram attached yet. You can upload one even if the SG document list is not
          buildable for this erf.
        </p>
      )}
    </section>
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
      id: "sg-document-list",
      name: "SG document list",
      why: "Surveyor-General document list when the registration division, erf and portion can be built safely.",
      href: sgDoc.shown ? sgDoc.url : undefined,
      actionLabel: "Open SG document list",
      helper: sgDoc.shown
        ? "This opens the official SG document list for this erf/portion where available. Download the SG diagram, then upload it to this erf workspace when report upload is available."
        : undefined,
      unavailableReason: sgDoc.shown ? undefined : sgDoc.reason,
    },
    {
      id: "deeds-registry-guidance",
      name: "Deeds registry guidance",
      why: "Official government guidance for deeds registry information. This is guidance, not free ownership verification.",
      href: GOVZA_DEEDS_GUIDANCE_URL,
      actionLabel: "Open guidance",
      helper:
        "Use this to understand the official deeds process. ErfStoep does not claim legally verified ownership.",
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
            StoepSteps / Step 1
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
        {verificationSources.map((source) => {
          const statusLabel = sourceStatus(source);
          const reviewed = statusLabel === "Reviewed";
          const opened = statusLabel === "Opened";
          const unavailable = statusLabel === "Unavailable";

          return (
            <article
              key={source.id}
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
          );
        })}
      </div>

      <SgDiagramEvidenceSection parcelId={parcel.id} sgDoc={sgDoc} onOpenSource={onOpenSource} />

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyIdentifiers}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
        >
          Copy parcel identifiers
        </button>
        {!sgDoc.shown && (
          <span className="inline-flex min-h-11 items-center rounded-full border border-[#0D1B2A]/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0D1B2A]/58">
            SG document list unavailable until buildable fields exist
          </span>
        )}
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
      displayTitle: street || erfLabel,
      displaySubtitle: [erfLabel, user.suburb ?? minorRegion, "User Entered"]
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
  const [fetchedAt, setFetchedAt] = useState(() => new Date().toLocaleString());
  const [identityStatus, setIdentityStatus] = useState<IdentityCheckStatus>("needs_verification");
  const [workspaceState, setWorkspaceState] = useState<ErfWorkspaceState>(() =>
    readErfWorkspaceState(parcelId),
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [workflowFeedback, setWorkflowFeedback] = useState<string | null>(null);

  const [userAddr, setUserAddr] = useState<UserAddress | null>(null);
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
    const mergedIdentityStatus =
      workspace.identityStatus === "none" && legacyIdentityStatus !== "needs_verification"
        ? identityStatusToWorkspace(legacyIdentityStatus)
        : workspace.identityStatus;
    const nextWorkspace =
      mergedIdentityStatus === workspace.identityStatus
        ? workspace
        : updateErfWorkspaceState(parcelId, { identityStatus: mergedIdentityStatus });
    setWorkspaceState(nextWorkspace);
    setIdentityStatus(workspaceStatusToIdentity(nextWorkspace.identityStatus));
    setShareCopied(false);
    setWorkflowFeedback(null);
  }, [parcelId]);
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
        user: userAddr,
      }),
    [csg, geo, userAddr, lat, lng],
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
      province: csg?.province ?? userAddr?.province ?? "Eastern Cape",
      suburbOrArea: userAddr?.suburb ?? csg?.minorRegion ?? resolved.displaySubtitle ?? null,
      town: userAddr?.town ?? csg?.majorRegion ?? null,
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
    userAddr,
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

  function selectWorkbenchTab(nextTab: Tab, options?: { markStarted?: boolean }) {
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
          "Stoep Report step started. Use saved evidence and assumptions, not fake data.",
        );
      }
    }
    setTab(nextTab);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
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
  const isOverview = tab === "overview";
  const nextStep = buildErfWorkspaceNextStep(workspaceState);
  const stoepSteps = buildStoepStepProgress(workspaceState);
  const identityReadiness = IDENTITY_STATUS_LABELS[identityStatus];
  const fileArea = normalizedParcel.suburbOrArea ?? normalizedParcel.town ?? "Area not confirmed";
  const fileRegion = [normalizedParcel.municipality, normalizedParcel.province]
    .filter(Boolean)
    .join(" / ");

  return (
    <aside className="pointer-events-auto fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-[#f8fafc]/96 shadow-[0_28px_90px_rgba(13,27,42,0.28)] backdrop-blur-xl">
      <nav className="hidden absolute inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-[#0D1B2A] p-4 text-white md:flex md:flex-col">
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFB86B]">
            ErfStoep
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
              Reports
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
                    ? "bg-[#FF6A00] text-white shadow-[0_16px_36px_-18px_rgba(255,106,0,0.8)]"
                    : "text-white/72 hover:bg-white/10 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
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
          {WORKBENCH_NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectWorkbenchTab(item.id)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                  active
                    ? "border-[#FF6A00] bg-[#FF6A00] text-white shadow-[0_12px_28px_-20px_rgba(255,106,0,0.9)]"
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
        </section>

        <section className="mx-4 mt-4 overflow-hidden rounded-[2rem] border border-[#0D1B2A]/10 bg-white shadow-[0_24px_70px_-38px_rgba(13,27,42,0.42)] backdrop-blur md:mx-7 md:mt-7">
          <div className="relative overflow-hidden rounded-none border-0 bg-white p-6 text-[#0D1B2A] sm:p-7">
            {isOverview ? (
              <>
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-[#0D1B2A]/10">
                      <Sparkles className="h-3 w-3 text-[#FFB86B]" /> Stoep AI First Read
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3df] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9A4A09] ring-1 ring-[#FF8A33]/25">
                      Early read / needs evidence
                    </span>
                  </div>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6A00]">
                    Every erf. All the facts.
                  </p>
                  <h3 className="mt-5 text-[30px] font-semibold leading-[1.12] tracking-tight text-[#0D1B2A] sm:text-[38px]">
                    {resolved.displayTitle}
                  </h3>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-[#0D1B2A]/78">
                    {panelFirstRead(normalizedParcel)}
                  </p>
                  <div className="mt-8">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                          How ErfStoep builds your report
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0D1B2A]/64">
                          Start with the erf, add proof, test the numbers, then keep one clear
                          report.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                      <div className="overflow-hidden rounded-[1.75rem] border border-[#D9E6F2] bg-[#F7FBFF] p-5 shadow-[0_22px_55px_-42px_rgba(13,27,42,0.55)]">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
                          <div className="min-w-0 flex-1">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D1B2A] ring-1 ring-[#D9E6F2]">
                              <ShieldCheck className="h-4 w-4 text-[#FF6A00]" />
                              Start here
                            </div>
                            <h4 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                              Know this erf
                            </h4>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-[#0D1B2A]/68">
                              Confirm the parcel, save evidence, run numbers, and create one Stoep
                              Report.
                            </p>
                          </div>
                          <div className="w-full rounded-[1.5rem] border border-[#D9E6F2] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(13,27,42,0.45)] lg:w-72">
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                                Mini report
                              </div>
                              <Sparkles className="h-4 w-4 text-[#FF6A00]" />
                            </div>
                            <dl className="mt-4 space-y-2">
                              {[
                                ["Identity", "Checked", "text-emerald-700"],
                                ["Evidence", "2 sources", "text-[#0D1B2A]"],
                                ["Market", "Needs comps", "text-[#9A4A09]"],
                                ["Strategy", "Not started", "text-[#64748B]"],
                              ].map(([label, value, color]) => (
                                <div
                                  key={label}
                                  className="flex items-center justify-between rounded-xl bg-[#F7FBFF] px-3 py-2"
                                >
                                  <dt className="text-xs font-medium text-[#0D1B2A]/62">{label}</dt>
                                  <dd className={cn("text-xs font-bold", color)}>{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {[
                          {
                            title: "Evidence Vault",
                            body: "Save source checks, uploaded reports, notes, listings and comps.",
                            Icon: FolderOpen,
                            chips: ["Sources", "Notes", "PDFs"],
                          },
                          {
                            title: "Strategy Lab",
                            body: "Run build, flip, hold and max-offer calculators.",
                            Icon: Calculator,
                            chips: ["Build", "Flip", "Offer"],
                          },
                          {
                            title: "Stoep Report",
                            body: "Stoep AI uses saved evidence and assumptions to create one clear report.",
                            Icon: FileText,
                            chips: ["Summary", "Risks", "Next steps"],
                          },
                        ].map(({ title, body, Icon, chips }) => (
                          <div
                            key={title}
                            className="rounded-[1.5rem] border border-[#D9E6F2] bg-white p-4 shadow-[0_16px_38px_-34px_rgba(13,27,42,0.42)]"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0F6FC] text-[#0D1B2A]">
                                <Icon className="h-6 w-6" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-semibold text-[#0D1B2A]">
                                  {title}
                                </div>
                                <p className="mt-1 text-sm leading-5 text-[#0D1B2A]/62">{body}</p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {chips.map((chip) => (
                                    <span
                                      key={chip}
                                      className="rounded-full bg-[#F7FBFF] px-2.5 py-1 text-[10px] font-semibold text-[#0D1B2A]/64 ring-1 ring-[#D9E6F2]"
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-6 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                        StoepSteps progress
                      </div>
                      <h4 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
                        Identity → Sources / Evidence → Market → Strategy → Stoep Report
                      </h4>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-[#0D1B2A]/64">
                      Opening a source starts the step. Reviewed by user, identity choices, saved
                      evidence and calculator/report starts move the workflow forward.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-5">
                    {stoepSteps.map((step) => (
                      <div
                        key={step.id}
                        className={cn(
                          "rounded-2xl border bg-white p-3 shadow-[0_14px_32px_-30px_rgba(13,27,42,0.45)]",
                          step.status === "Current"
                            ? "border-[#FF6A00]/36 ring-1 ring-[#FF6A00]/18"
                            : step.status === "Done"
                              ? "border-emerald-500/28"
                              : step.status === "Blocked / uncertain"
                                ? "border-[#C75A31]/28 bg-[#fff7f2]"
                                : "border-[#0D1B2A]/10",
                        )}
                      >
                        <div className="text-sm font-semibold text-[#0D1B2A]">{step.label}</div>
                        <div
                          className={cn(
                            "mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                            step.status === "Current"
                              ? "bg-[#FF6A00] text-white"
                              : step.status === "Done"
                                ? "bg-emerald-600 text-white"
                                : step.status === "Blocked / uncertain"
                                  ? "bg-[#C75A31] text-white"
                                  : "bg-[#0D1B2A]/8 text-[#0D1B2A]/62",
                          )}
                        >
                          {step.status}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
                          Done when: {step.doneWhen}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative mt-6 rounded-[1.5rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                        Current StoepStep
                      </div>
                      <p className="mt-1 text-xl font-semibold leading-snug text-[#0D1B2A]">
                        {nextStep.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/66">{nextStep.body}</p>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {[
                          ["Why this matters", nextStep.why],
                          ["Do this now", nextStep.doNow],
                          ["Done when", nextStep.doneWhen],
                          ["Next", nextStep.next],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[#0D1B2A]/8 bg-white/78 px-3 py-2"
                          >
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                              {label}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/70">{value}</p>
                          </div>
                        ))}
                      </div>
                      {workflowFeedback && (
                        <p className="mt-4 rounded-2xl border border-[#FF6A00]/24 bg-white px-3 py-2 text-sm font-semibold text-[#0D1B2A]">
                          What changed: {workflowFeedback}
                        </p>
                      )}
                      {!workspaceState.saved && workspaceState.dirty && (
                        <p className="mt-3 rounded-2xl border border-[#0D1B2A]/10 bg-white/72 px-3 py-2 text-sm text-[#0D1B2A]/68">
                          Changes are stored in this browser. Save this erf to keep it in My Erfs.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectWorkbenchTab(nextStep.tab, { markStarted: true })}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-8px_rgba(255,106,0,0.55)] transition hover:bg-[#FF7D1F]"
                      >
                        {nextStep.action}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectWorkbenchTab("calculators", { markStarted: true })}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-5 py-3 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
                      >
                        Skip to Strategy Lab
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#fbf8f1] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                  {activeSection.guidanceTitle}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                  {activeSection.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
                  {activeSection.guidance}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mx-4 mt-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/86 p-4 shadow-[0_18px_45px_-34px_rgba(13,27,42,0.45)] backdrop-blur md:mx-7">
          <div className="mb-4 grid gap-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#fbf8f1] p-4 lg:grid-cols-[minmax(18rem,1.15fr)_minmax(16rem,0.85fr)]">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                Selected erf map
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                {resolved.displayTitle}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
                Read-only map context centered on the selected erf area. Coordinates are approximate
                parcel context unless confirmed by an official source.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#0D1B2A]/70">
                {normalizedParcel.erfNumber && (
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                    Erf {normalizedParcel.erfNumber}
                  </span>
                )}
                {normalizedParcel.suburbOrArea && (
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                    {normalizedParcel.suburbOrArea}
                  </span>
                )}
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                  {formatAreaM2(csg?.geometryArea ?? kouga?.shapeArea)}
                </span>
              </div>
              <div className="mt-4 rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  Coordinates
                </div>
                <dl className="mt-2 space-y-1 text-xs text-[#0D1B2A]/70">
                  <div className="flex justify-between gap-3">
                    <dt>Lat</dt>
                    <dd className="font-mono">
                      {formatMapCoordinate(normalizedParcel.coordinates?.lat)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Lng</dt>
                    <dd className="font-mono">
                      {formatMapCoordinate(normalizedParcel.coordinates?.lng)}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={handleBackToMap}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
                >
                  Back to full map
                </button>
                {selectedErfGoogleMapsUrl && (
                  <a
                    href={selectedErfGoogleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <SelectedErfMiniMap
              coordinates={normalizedParcel.coordinates}
              title={resolved.displayTitle}
              onBackToMap={handleBackToMap}
            />
          </div>

          {isOverview && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                  Ask Stoep
                </div>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                  What do you want to understand first?
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {ASK_STOEP_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => selectWorkbenchTab(prompt.tab)}
                    className="rounded-full border border-[#0D1B2A]/10 bg-[#fff8ec] px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff1dc]"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {isOverview && (
          <section className="mx-4 mt-4 grid gap-3 md:mx-7 md:grid-cols-4">
            {[
              ["Identity", identityReadiness],
              ["Ownership", "Needs evidence"],
              ["Market value", "Needs evidence"],
              ["Strategy", "Not chosen"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/88 p-4 shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {label}
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#0D1B2A]">{value}</p>
              </div>
            ))}
          </section>
        )}

        {isOverview && (
          <section className="mx-4 mt-4 grid gap-3 md:mx-7 md:grid-cols-4">
            {[
              ["Verify official records", "Open CSG, SG and municipal sources.", "research"],
              ["Build market evidence", "Find listings and comps for this erf.", "listings"],
              [
                "Run Strategy Lab",
                "Test flip, build, hold and max offer assumptions.",
                "calculators",
              ],
              ["Add/upload evidence", "Coming soon", "coming-soon"],
            ].map(([label, value, nextTab]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (nextTab !== "coming-soon")
                    selectWorkbenchTab(nextTab as Tab, { markStarted: true });
                }}
                disabled={nextTab === "coming-soon"}
                className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-4 text-left shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)] transition hover:-translate-y-0.5 hover:border-[#FF6A00]/35 hover:shadow-[0_24px_55px_-34px_rgba(13,27,42,0.55)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:border-[#0D1B2A]/10 disabled:hover:shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0D1B2A]">{label}</div>
                    <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/62">{value}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-[#FF6A00] transition group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </section>
        )}

        <div ref={dossierContentRef} className="px-5 pt-4">
          {tab === "overview" && null}

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
              />
              <ErfResearchDossier parcel={normalizedParcel} view="research" />
            </>
          )}
          {tab === "listings" && <ErfResearchDossier parcel={normalizedParcel} view="listings" />}
          {tab === "reports" && <ErfResearchDossier parcel={normalizedParcel} view="reports" />}
          {tab === "notes" && <ErfResearchDossier parcel={normalizedParcel} view="notes" />}
          {tab === "calculators" && (
            <ErfResearchDossier parcel={normalizedParcel} view="calculators" />
          )}
        </div>
      </div>
    </aside>
  );
}
