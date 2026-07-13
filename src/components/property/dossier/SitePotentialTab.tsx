import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Home,
  Image as ImageIcon,
  Info,
  Sparkles,
  TreePine,
  Upload,
  XCircle,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import type {
  ErfWorkspaceState,
  SitePotentialMode,
  SitePotentialSnapshot,
} from "@/lib/workbench/erfWorkspaceState";

/**
 * Callbacks are exposed so Codex can wire the real backend later.
 * The UI in this file must not simulate successful payment or
 * completed generation for normal users.
 */
export interface SitePotentialGenerationCallbacks {
  onRequestGeneration?: (input: SitePotentialGenerationInput) => void;
  onSelectPreferredConcept?: (conceptId: string) => void;
  onClearPreferredConcept?: () => void;
  onSkipSection?: (skipped: boolean) => void;
}

export interface SitePotentialGenerationInput {
  mode: SitePotentialMode;
  renovationLevel?: "cosmetic" | "moderate" | "major";
  style?: string;
  customInstructions?: string;
  imageRightsConfirmed: boolean;
}

export interface SitePotentialTabProps {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  onUpdateSite: (patch: Partial<SitePotentialSnapshot>) => void;
  callbacks?: SitePotentialGenerationCallbacks;
  /**
   * When true, the paid generation and file upload backend is not connected
   * in the current environment. The UI shows honest "backend not connected"
   * states and never fakes success.
   */
  backendConnected?: boolean;
  onExploreReport?: () => void;
}

const STYLES: { id: string; label: string }[] = [
  { id: "coastal", label: "Coastal contemporary" },
  { id: "modern", label: "Modern" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "traditional", label: "Traditional" },
  { id: "farmhouse", label: "Farmhouse" },
  { id: "minimal", label: "Minimal" },
  { id: "custom", label: "Custom" },
];

const RENOVATION_LEVELS: { id: "cosmetic" | "moderate" | "major"; label: string; body: string }[] =
  [
    { id: "cosmetic", label: "Cosmetic refresh", body: "Paint, finishes, small updates." },
    { id: "moderate", label: "Moderate renovation", body: "Kitchen, bathrooms, layout tweaks." },
    { id: "major", label: "Major transformation", body: "Extensions, rebuilds, new footprint." },
  ];

const MODE_OPTIONS: { id: SitePotentialMode; label: string; body: string; icon: JSX.Element }[] = [
  {
    id: "vacant_land",
    label: "Vacant land",
    body: "No existing structure or the erf is being cleared.",
    icon: <TreePine className="h-4 w-4" />,
  },
  {
    id: "existing_house",
    label: "Existing house",
    body: "A house is standing and could be renovated.",
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: "other",
    label: "Other building",
    body: "Outbuilding, commercial, or non-residential structure.",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  {
    id: "unsure",
    label: "Not sure",
    body: "Come back once the erf state is clearer.",
    icon: <Info className="h-4 w-4" />,
  },
];

export function SitePotentialTab({
  parcel,
  workspaceState,
  onUpdateSite,
  callbacks,
  backendConnected = false,
  onExploreReport,
}: SitePotentialTabProps) {
  const site = workspaceState.sitePotential;
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const planInputRef = useRef<HTMLInputElement | null>(null);

  const [renovationLevel, setRenovationLevel] = useState<
    "cosmetic" | "moderate" | "major" | null
  >(null);
  const [style, setStyle] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");

  const identityLine = useMemo(() => {
    const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "This erf";
    const suburb = parcel.suburbOrArea ?? parcel.town ?? parcel.municipality ?? null;
    return suburb ? `${erf} • ${suburb}` : erf;
  }, [parcel]);

  const totalFiles = site.photoCount + site.planCount;
  const needsPhotos = site.mode === "existing_house" && site.photoCount === 0;
  const needsRights =
    site.mode === "existing_house" && site.photoCount > 0 && !site.imageRightsConfirmed;

  function selectMode(mode: SitePotentialMode) {
    onUpdateSite({ mode, skipped: false });
  }

  function toggleSkipped() {
    const next = !site.skipped;
    onUpdateSite({ skipped: next });
    callbacks?.onSkipSection?.(next);
  }

  function addPhotos(count: number) {
    if (count <= 0) return;
    onUpdateSite({ photoCount: site.photoCount + count });
  }

  function addPlans(count: number) {
    if (count <= 0) return;
    onUpdateSite({ planCount: site.planCount + count });
  }

  function confirmRights(next: boolean) {
    onUpdateSite({ imageRightsConfirmed: next });
  }

  function requestGeneration() {
    if (!site.mode || site.mode === "unsure" || site.mode === "other") return;
    if (!backendConnected) return;
    callbacks?.onRequestGeneration?.({
      mode: site.mode,
      renovationLevel: renovationLevel ?? undefined,
      style: style ?? undefined,
      customInstructions: customInstructions || undefined,
      imageRightsConfirmed: site.imageRightsConfirmed,
    });
  }

  const generationDisabled =
    !backendConnected ||
    !site.mode ||
    site.mode === "unsure" ||
    site.mode === "other" ||
    (site.mode === "existing_house" && (needsPhotos || needsRights));

  const generationCta =
    site.mode === "vacant_land" ? "Create new-build concepts" : "Create renovation concepts";

  const generationStatus = deriveGenerationStatus(site, {
    backendConnected,
    needsPhotos,
    needsRights,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-[1.5rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#0D1B2A] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                Site Potential
              </span>
              <span className="text-[11px] font-semibold text-[#64748B]">{identityLine}</span>
            </div>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[#0D1B2A]">
              What is currently on this erf, and what could it become?
            </h2>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#4A5A6A]">
              Explore renovation and new-build possibilities for this erf. Concepts are visual
              starting points, not architectural plans or municipal approvals.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[#4A5A6A]">
              <span>
                <strong className="text-[#0D1B2A]">Files:</strong> {totalFiles}
              </span>
              <span>
                <strong className="text-[#0D1B2A]">Concepts:</strong> {site.conceptCount}
              </span>
              <span>
                <strong className="text-[#0D1B2A]">Preferred design:</strong>{" "}
                {site.preferredConceptId ? "Selected" : "None"}
              </span>
              <span>
                <strong className="text-[#0D1B2A]">Status:</strong>{" "}
                {site.skipped ? "Skipped for this report" : "Optional workflow"}
              </span>
            </dl>
          </div>
          <div className="flex shrink-0 flex-col gap-2 md:items-end">
            <button
              type="button"
              onClick={toggleSkipped}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold",
                site.skipped
                  ? "bg-[#FF6A00] text-white hover:bg-[#ff7a1a]"
                  : "border border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:bg-[#0D1B2A]/5",
              )}
            >
              {site.skipped ? "Unskip Site Potential" : "Skip for this report"}
            </button>
            {onExploreReport && (
              <button
                type="button"
                onClick={onExploreReport}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0D1B2A]/70 hover:text-[#0D1B2A]"
              >
                View in Easy Erf Report <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!backendConnected && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-[12.5px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Backend not connected in this environment.</strong> Paid generation and image
            storage are not simulated here. You can select a property state, capture your
            preferences and mark this section skipped or complete once the pipeline is live.
          </div>
        </div>
      )}

      {/* Step 1: property state */}
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Step 1 — What is currently on this erf?
        </h3>
        <p className="mt-1 text-[12.5px] text-[#64748B]">
          Your choice controls which fields appear below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const active = site.mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectMode(option.id)}
                className={cn(
                  "flex flex-col items-start rounded-2xl border p-4 text-left transition min-h-[112px]",
                  active
                    ? "border-[#FF6A00] bg-[#FF6A00]/[0.06] shadow-[0_10px_30px_-16px_rgba(255,106,0,0.5)]"
                    : "border-[#0D1B2A]/10 bg-white hover:border-[#0D1B2A]/25",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full",
                    active ? "bg-[#FF6A00] text-white" : "bg-[#0D1B2A]/5 text-[#0D1B2A]",
                  )}
                >
                  {option.icon}
                </span>
                <span className="mt-3 text-[14px] font-semibold text-[#0D1B2A]">
                  {option.label}
                </span>
                <span className="mt-1 text-[12px] text-[#64748B]">{option.body}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: mode-specific workflow */}
      {site.mode === "existing_house" && (
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Step 2 — Renovation setup
          </h3>
          <UploadRow
            title="Current property photos"
            hint="Front, sides, back, garden and any interior areas you want reimagined."
            count={site.photoCount}
            inputRef={photoInputRef}
            accept="image/*"
            onSelected={(count) => addPhotos(count)}
            emptyLabel="No photos added"
          />
          <RightsCheckbox
            checked={site.imageRightsConfirmed}
            onChange={confirmRights}
            required={site.photoCount > 0}
          />
          <div className="mt-6 space-y-4">
            <FieldGroup label="Renovation level">
              <div className="grid gap-2 sm:grid-cols-3">
                {RENOVATION_LEVELS.map((level) => (
                  <Chip
                    key={level.id}
                    active={renovationLevel === level.id}
                    onClick={() => setRenovationLevel(level.id)}
                    label={level.label}
                    body={level.body}
                  />
                ))}
              </div>
            </FieldGroup>
            <FieldGroup label="Style">
              <div className="flex flex-wrap gap-2">
                {STYLES.map((option) => (
                  <PillChip
                    key={option.id}
                    active={style === option.id}
                    onClick={() => setStyle(option.id)}
                    label={option.label}
                  />
                ))}
              </div>
            </FieldGroup>
            <FieldGroup label="Optional: custom instructions">
              <textarea
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
                rows={3}
                placeholder="Roof treatment, colour palette, landscaping, pool, deck, garage, entertainment area…"
                className="w-full rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
              />
            </FieldGroup>
          </div>
        </section>
      )}

      {site.mode === "vacant_land" && (
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Step 2 — New-build setup
          </h3>
          <UploadRow
            title="Site photographs"
            hint="Photos of the erf from the street and boundary, if you have them."
            count={site.photoCount}
            inputRef={photoInputRef}
            accept="image/*"
            onSelected={(count) => addPhotos(count)}
            emptyLabel="No site photos yet"
          />
          <UploadRow
            title="Survey, topographical plan or concept plans"
            hint="PDF, image or CAD-exported PDF. Kept in the Erf File."
            count={site.planCount}
            inputRef={planInputRef}
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
            onSelected={(count) => addPlans(count)}
            emptyLabel="No plans yet"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Desired property type",
              "Bedrooms",
              "Bathrooms",
              "Storeys",
              "Garage spaces",
              "Approx. floor area",
              "Architectural style",
              "Budget range",
              "View / orientation priorities",
              "Custom instructions",
            ].map((label) => (
              <label key={label} className="flex flex-col text-[12px] text-[#64748B]">
                <span className="mb-1 font-semibold text-[#0D1B2A]">{label}</span>
                <input
                  type="text"
                  className="rounded-xl border border-[#0D1B2A]/12 bg-white px-3 py-2 text-[13px] text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
                  placeholder="Optional"
                />
              </label>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-[#64748B]">
            Concepts are illustrative unless verified survey and planning information exists.
          </p>
        </section>
      )}

      {(site.mode === "other" || site.mode === "unsure") && (
        <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6 text-[13px] text-[#4A5A6A]">
          Concept generation is currently tuned for existing-house renovations and vacant-land
          new-builds. You can still add photos and plans to the Erf File below, or skip this
          section for this report.
        </section>
      )}

      {/* Erf File uploads */}
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
              Save to this Erf File
            </h3>
            <p className="mt-1 text-[12.5px] text-[#64748B]">
              Photos, plans and inspiration for this erf are saved here so every module can see
              them. Files belong to this erf permanently.
            </p>
          </div>
          <span className="rounded-full bg-[#0D1B2A]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0D1B2A]/70">
            {totalFiles} file{totalFiles === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {/* Paid design pack */}
      <section className="rounded-[1.75rem] border border-[#EADFC9]/70 bg-[#FBF6EC] p-6 shadow-[0_16px_44px_-28px_rgba(13,27,42,0.3)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF6A00]" />
              <h3 className="text-[16px] font-semibold tracking-tight text-[#0D1B2A]">
                Six AI Property Concepts
              </h3>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-[#4A5A6A]">
              One primary concept direction plus five coordinated alternatives, saved permanently
              to this erf. Choose one design for the Easy Erf Report.
            </p>
            <ul className="mt-3 grid gap-1 text-[12px] text-[#4A5A6A] sm:grid-cols-2">
              <li>• One primary concept direction</li>
              <li>• Five coordinated alternatives</li>
              <li>• Saved permanently to this erf</li>
              <li>• Pick one design for the Easy Erf Report</li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-[26px] font-bold text-[#0D1B2A]">R100</div>
            <button
              type="button"
              onClick={requestGeneration}
              disabled={generationDisabled}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold shadow-[0_12px_30px_-10px_rgba(255,106,0,0.7)]",
                generationDisabled
                  ? "cursor-not-allowed bg-[#0D1B2A]/10 text-[#0D1B2A]/40 shadow-none"
                  : "bg-[#FF6A00] text-white hover:bg-[#ff7a1a]",
              )}
            >
              {generationCta} <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-semibold text-[#64748B]">{generationStatus}</span>
          </div>
        </div>
      </section>

      {/* Concept gallery */}
      <ConceptGallery
        site={site}
        onSelect={(id) => {
          onUpdateSite({ preferredConceptId: id });
          callbacks?.onSelectPreferredConcept?.(id);
        }}
        onClear={() => {
          onUpdateSite({ preferredConceptId: null });
          callbacks?.onClearPreferredConcept?.();
        }}
      />

      {/* Easy Erf Report preview card */}
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
              What will be sent to the report
            </div>
            <div className="mt-1 text-[15px] font-semibold text-[#0D1B2A]">
              {site.preferredConceptId
                ? `Preferred concept ${site.preferredConceptId}`
                : site.skipped
                  ? "Site Potential skipped for this report"
                  : "No preferred design selected yet"}
            </div>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Mode: {siteModeLabel(site.mode)} · Concepts saved: {site.conceptCount} · Files:{" "}
              {totalFiles}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Disclaimer: concepts are visual explorations, not architectural or municipally
              approved plans.
            </p>
          </div>
          {onExploreReport && (
            <button
              type="button"
              onClick={onExploreReport}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2.5 text-[12.5px] font-semibold text-white hover:bg-[#142941]"
            >
              View in Easy Erf Report <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function siteModeLabel(mode: SitePotentialMode | null) {
  switch (mode) {
    case "vacant_land":
      return "Vacant land";
    case "existing_house":
      return "Existing house";
    case "other":
      return "Other building";
    case "unsure":
      return "Not sure";
    default:
      return "Not set";
  }
}

function deriveGenerationStatus(
  site: SitePotentialSnapshot,
  ctx: { backendConnected: boolean; needsPhotos: boolean; needsRights: boolean },
) {
  if (!ctx.backendConnected) return "Backend not connected";
  if (!site.mode || site.mode === "unsure" || site.mode === "other") return "Ready for input";
  if (ctx.needsPhotos) return "Needs photographs";
  if (ctx.needsRights) return "Needs image-rights confirmation";
  if (site.conceptCount === 0) return "Awaiting payment or entitlement";
  if (site.conceptCount > 0 && site.conceptCount < 6) return "Partially complete";
  return "Complete";
}

function UploadRow({
  title,
  hint,
  count,
  inputRef,
  accept,
  onSelected,
  emptyLabel,
}: {
  title: string;
  hint: string;
  count: number;
  inputRef: React.RefObject<HTMLInputElement>;
  accept: string;
  onSelected: (count: number) => void;
  emptyLabel: string;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-[#F7F5EE] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-[13.5px] font-semibold text-[#0D1B2A]">{title}</div>
        <div className="text-[11.5px] text-[#64748B]">{hint}</div>
        <div className="mt-1 text-[11px] font-semibold text-[#0D1B2A]/70">
          {count > 0 ? `${count} file${count === 1 ? "" : "s"} added` : emptyLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 self-start rounded-full bg-[#0D1B2A] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#142941]"
      >
        <Upload className="h-3.5 w-3.5" /> Upload files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const n = event.target.files?.length ?? 0;
          if (n > 0) onSelected(n);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function RightsCheckbox({
  checked,
  onChange,
  required,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  required: boolean;
}) {
  return (
    <label className="mt-3 flex items-start gap-3 rounded-2xl border border-[#0D1B2A]/10 bg-white p-3 text-[12.5px] text-[#0D1B2A]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#FF6A00]"
      />
      <span>
        I own these images or have permission to use them for AI concept visualisation.
        {required && !checked && (
          <span className="ml-2 text-[11px] font-semibold text-[#B24A00]">Required</span>
        )}
      </span>
    </label>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  body,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-2xl border p-3 text-left transition",
        active
          ? "border-[#FF6A00] bg-[#FF6A00]/[0.06]"
          : "border-[#0D1B2A]/10 bg-white hover:border-[#0D1B2A]/25",
      )}
    >
      <span className="text-[13px] font-semibold text-[#0D1B2A]">{label}</span>
      <span className="mt-1 text-[11.5px] text-[#64748B]">{body}</span>
    </button>
  );
}

function PillChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "border-[#FF6A00] bg-[#FF6A00] text-white"
          : "border-[#0D1B2A]/15 bg-white text-[#0D1B2A] hover:border-[#0D1B2A]/30",
      )}
    >
      {label}
    </button>
  );
}

function ConceptGallery({
  site,
  onSelect,
  onClear,
}: {
  site: SitePotentialSnapshot;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const slots = Array.from({ length: 6 }, (_, i) => `concept-${i + 1}`);
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
          Concept gallery
        </h3>
        <span className="text-[11.5px] text-[#64748B]">
          {site.conceptCount === 0
            ? "No concepts generated yet"
            : `${site.conceptCount} of 6 available`}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((id, index) => {
          const ready = index < site.conceptCount;
          const isSelected = site.preferredConceptId === id;
          return (
            <article
              key={id}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border bg-[#FBF6EC]",
                isSelected ? "border-[#FF6A00]" : "border-[#EADFC9]",
              )}
            >
              <div className="relative aspect-[4/3] bg-[#0D1B2A]/5">
                <div className="absolute inset-0 grid place-items-center text-[11.5px] font-semibold text-[#0D1B2A]/50">
                  {ready ? `Concept ${index + 1}` : "Not generated yet"}
                </div>
                {isSelected && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#FF6A00] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    <CheckCircle2 className="h-3 w-3" /> Selected for Easy Erf Report
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="text-[13px] font-semibold text-[#0D1B2A]">
                  Concept #{index + 1}
                </div>
                <div className="text-[11.5px] text-[#64748B]">
                  {ready
                    ? "Design summary appears here once concepts are generated."
                    : "Awaiting generation."}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!ready || isSelected}
                    onClick={() => onSelect(id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11.5px] font-semibold",
                      !ready
                        ? "cursor-not-allowed bg-[#0D1B2A]/5 text-[#0D1B2A]/40"
                        : isSelected
                          ? "cursor-not-allowed bg-[#0D1B2A]/5 text-[#0D1B2A]/40"
                          : "bg-[#0D1B2A] text-white hover:bg-[#142941]",
                    )}
                  >
                    Select as preferred
                  </button>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={onClear}
                      className="inline-flex items-center gap-1 rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Remove from report
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
