from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Keep the Human Review takeover visible across every property workbench surface,
# including guided investigation and the in-depth dossier tabs.
replace_once(
    "src/components/property/OfficialParcelPanel.tsx",
    'import { ErfResearchDossier } from "./ErfResearchDossier";\n',
    'import { ErfResearchDossier } from "./ErfResearchDossier";\nimport { HumanReviewTakeoverCard } from "@/components/humanReview/HumanReviewTakeoverCard";\n',
)
replace_once(
    "src/components/property/OfficialParcelPanel.tsx",
    '''        {isOverview && (
''',
    '''        <section className="mx-4 mt-4 md:mx-7">
          <HumanReviewTakeoverCard
            parcelId={normalizedParcel.id}
            propertyReference={resolved.displayTitle}
            source={`workbench-${tab}`}
            compact={isOverview || isInvestigation}
          />
        </section>

        {isOverview && (
''',
)

# Make the self-service report executive-first instead of showing every dense
# evidence section at once. The complete dossier remains available on demand
# and remains fully expanded for print/PDF output.
replace_once(
    "src/components/property/ErfResearchDossier.tsx",
    'import { ReportOpening } from "@/components/property/dossier/ReportOpening";\n',
    'import { ReportOpening } from "@/components/property/dossier/ReportOpening";\nimport { HumanReviewTakeoverCard } from "@/components/humanReview/HumanReviewTakeoverCard";\n',
)
replace_once(
    "src/components/property/ErfResearchDossier.tsx",
    '''        {/* STICKY REPORT NAV — five primary destinations, ordered by the decision lens */}
''',
    '''        {!printOnly ? (
          <HumanReviewTakeoverCard
            parcelId={parcel.id}
            propertyReference={parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : parcel.id}
            source="self-service-report"
          />
        ) : null}

        <details
          open={printOnly ? true : undefined}
          className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white/92 p-4 shadow-[0_18px_48px_-38px_rgba(13,27,42,0.42)] sm:p-5"
        >
          {!printOnly ? (
            <summary className="report-no-print cursor-pointer list-none rounded-[1.25rem] bg-[#F7FBFF] px-4 py-4 text-[#0D1B2A] ring-1 ring-[#D9E6F2]">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
                Full evidence dossier
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">
                Open the detailed evidence, planning, market and due-diligence sections
              </div>
              <p className="mt-1 text-xs leading-5 text-[#64748B]">
                The report opening above is the readable summary. Use this section when you want the full working evidence behind it.
              </p>
            </summary>
          ) : null}
          <div className={cn("space-y-5", !printOnly && "mt-5")}>
        {/* STICKY REPORT NAV — five primary destinations, ordered by the decision lens */}
''',
)
replace_once(
    "src/components/property/ErfResearchDossier.tsx",
    '''        {composition.groupOrder.map((groupId) => (
          <Fragment key={groupId}>{groupNodes[groupId]}</Fragment>
        ))}
      </div>
    );
''',
    '''        {composition.groupOrder.map((groupId) => (
          <Fragment key={groupId}>{groupNodes[groupId]}</Fragment>
        ))}
          </div>
        </details>
      </div>
    );
''',
)
