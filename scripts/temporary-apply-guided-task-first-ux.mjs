import { readFileSync, writeFileSync } from "node:fs";

const path = "src/components/property/OfficialParcelPanel.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const first = source.indexOf(oldText);
  const second = first === -1 ? -1 : source.indexOf(oldText, first + oldText.length);
  if (first === -1 || second !== -1) {
    throw new Error(`${label}: expected exactly one match, found ${first === -1 ? 0 : 2}`);
  }
  source = source.replace(oldText, newText);
}

replaceOnce(
  '<aside className="pointer-events-auto fixed inset-0 z-[80] h-[100dvh] overflow-hidden bg-[#f8fafc]/96 shadow-[0_28px_90px_rgba(13,27,42,0.28)] backdrop-blur-xl">',
  '<aside className="pointer-events-auto fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-[#f8fafc]/96 shadow-[0_28px_90px_rgba(13,27,42,0.28)] backdrop-blur-xl">',
  "flex column workbench shell",
);

replaceOnce(
  '"sticky top-0 z-30 flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#0D1B2A]/10 bg-[#fbf8f1]/95 px-4 pb-3 pt-4 shadow-sm backdrop-blur max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-7",',
  '"sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#0D1B2A]/10 bg-[#fbf8f1]/95 px-3 py-2 shadow-sm backdrop-blur max-md:pt-[calc(env(safe-area-inset-top)+0.5rem)] md:items-start md:gap-3 md:px-7 md:pb-3 md:pt-4",',
  "compact header shell",
);

replaceOnce(
  `        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6A00]">
            {isOverview ? "Property overview" : "Erf Workbench"}
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
        </div>`,
  `        <div className="min-w-0 flex-1" data-mobile-workbench-header="compact">
          <div className="mb-1 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6A00] md:block">
            {isOverview ? "Property overview" : "Erf Workbench"}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground md:mt-1 md:text-lg">
              {resolved.displayTitle}
            </h2>
            <div className="inline-flex shrink-0 rounded-full bg-[#0D1B2A]/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A] md:hidden">
              {workspaceState.saved
                ? workspaceState.dirty
                  ? "Unsaved changes"
                  : "Saved"
                : "Unsaved"}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider md:mt-0 md:text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              <span className="md:hidden">Official</span>
              <span className="hidden md:inline">Official Public Data</span>
            </span>
            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-foreground">
              {isCsg ? "CSG" : "Kouga"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground md:hidden">
            {fileArea}
          </div>
          {resolved.displaySubtitle && (
            <div className="mt-0.5 hidden items-center gap-1 truncate text-[11px] text-muted-foreground md:flex">
              <MapPin className="h-3 w-3" /> {resolved.displaySubtitle}
            </div>
          )}
        </div>`,
  "compact mobile identity block",
);

replaceOnce(
  '<div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">',
  '<div className="flex shrink-0 items-center justify-end gap-1.5 md:max-w-full md:flex-wrap md:gap-2">',
  "compact header actions",
);

replaceOnce(
  `          <button
            type="button"
            onClick={saveErfFile}
            disabled={!workspaceState.dirty}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#FF6A00] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:bg-[#0D1B2A]/20 disabled:text-[#0D1B2A]/55 disabled:shadow-none"
            title={workspaceState.dirty ? "Save Changes" : "All changes saved"}
            aria-label="Save dossier changes"
          >
            Save Changes
          </button>`,
  `          <button
            type="button"
            onClick={saveErfFile}
            disabled={!workspaceState.dirty}
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#FF6A00] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:bg-[#0D1B2A]/20 disabled:text-[#0D1B2A]/55 disabled:shadow-none md:min-h-11 md:gap-1.5 md:px-3 md:py-2 md:text-xs"
            title={workspaceState.dirty ? "Save Changes" : "All changes saved"}
            aria-label="Save dossier changes"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </button>`,
  "compact save changes button",
);

replaceOnce(
  'className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-stone-900 shadow-sm hover:bg-amber-100 md:min-h-0 md:border-0 md:bg-transparent md:p-2 md:text-foreground md:shadow-none md:hover:bg-muted"',
  'className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0 text-stone-900 shadow-sm hover:bg-amber-100 md:h-auto md:w-auto md:min-h-0 md:border-0 md:bg-transparent md:p-2 md:text-foreground md:shadow-none md:hover:bg-muted"',
  "compact save erf button",
);

replaceOnce(
  '            <span className="md:hidden">{saved ? "Saved" : "Save erf"}</span>\n',
  "",
  "remove mobile save erf label",
);

replaceOnce(
  'className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#142941] md:px-4"',
  'className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#0D1B2A] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#142941] md:min-h-11 md:gap-1.5 md:px-4 md:py-2 md:text-xs"',
  "compact map button",
);

replaceOnce(
  '<span className="sm:hidden">Back to map</span>',
  '<span className="sm:hidden">Map</span>',
  "short mobile map label",
);

replaceOnce(
  '"scrollbar-thin relative h-[calc(100dvh-5.25rem)] min-h-0 overflow-y-auto overscroll-contain pb-8",',
  '"scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8",',
  "flexible workbench content height",
);

replaceOnce(
  `        <section className="mx-4 mt-4 md:mx-7">
          <HumanReviewTakeoverCard
            parcelId={normalizedParcel.id}
            propertyReference={resolved.displayTitle}
            source={\`workbench-${tab}\`}
            compact={isOverview || isInvestigation}
          />
        </section>

`,
  "",
  "remove offer before primary work",
);

replaceOnce(
  `          {showWorkbenchNextStep && (
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
      </div>`,
  `          {showWorkbenchNextStep && (
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

        <section
          className="mx-4 mt-4 md:mx-7 md:mt-6"
          data-done-for-you-placement="after-primary-work"
        >
          <HumanReviewTakeoverCard
            parcelId={normalizedParcel.id}
            propertyReference={resolved.displayTitle}
            source={\`workbench-${tab}\`}
            compact
          />
        </section>
      </div>`,
  "place collapsed offer after primary work",
);

writeFileSync(path, source);
