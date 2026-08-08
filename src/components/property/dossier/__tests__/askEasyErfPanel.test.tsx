import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { canonicalActionNavigation, canonicalReportAction } from "@/lib/investigation/canonicalNextAction";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { evidenceAsset, evidenceParcel } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ReportAction } from "@/lib/reports/reportFindings";
import { AskEasyErfCanonicalActionCard } from "../AskEasyErfPanel";

function action(overrides: Partial<ReportAction> = {}): ReportAction {
  return {
    id: "investigation-add-sg-diagram",
    parcelId: "parcel-a",
    priority: 20,
    title: "Attach the Surveyor-General diagram",
    reason: "It supports cadastral dimensions and identity.",
    completionCriteria: "A matched searchable SG diagram is stored.",
    status: "open",
    targetTab: "research",
    targetAnchorId: "sg-diagram-evidence",
    actionLabel: "Add SG diagram",
    estimatedMinutes: 5,
    steps: [],
    afterCompletion: "The next canonical investigation task becomes current.",
    findingIds: [],
    gapIds: [],
    contradictionIds: [],
    ...overrides,
  };
}

describe("Ask Easy Erf canonical application action", () => {
  it("renders the canonical action and derives navigation only from its tab and anchor", () => {
    const canonical = action();
    const markup = renderToStaticMarkup(
      <AskEasyErfCanonicalActionCard action={canonical} onSelectView={vi.fn()} />,
    );

    expect(canonicalActionNavigation(canonical)).toEqual({
      targetTab: "research",
      targetAnchorId: "sg-diagram-evidence",
    });
    expect(markup).toContain("Next best step");
    expect(markup).toContain("Attach the Surveyor-General diagram");
    expect(markup).toContain("Add SG diagram");
  });

  it("does not use the model-returned nextAction as workflow navigation", () => {
    const source = readFileSync(resolve(__dirname, "../AskEasyErfPanel.tsx"), "utf8");

    expect(source).toContain("canonicalNextAction");
    expect(source).toContain("canonicalActionNavigation(action)");
    expect(source).not.toContain("Recommended next action: {answer.nextAction}");
    expect(source).not.toContain("onSelectView(answer.nextAction");
  });

  it("keeps viewing and asking free of workspace progress writes", () => {
    const source = readFileSync(resolve(__dirname, "../AskEasyErfPanel.tsx"), "utf8");

    expect(source).not.toContain("updateErfWorkspaceState");
    expect(source).not.toContain("reportStarted");
    expect(source).not.toContain("marketEvidenceStarted");
    expect(source).not.toContain("calculatorStarted");
  });

  it("mounts the shared panel in Property Overview with canonical evidence and action", () => {
    const panelSource = readFileSync(resolve(__dirname, "../../OfficialParcelPanel.tsx"), "utf8");
    const firstReadSource = readFileSync(resolve(__dirname, "../PropertyFirstRead.tsx"), "utf8");

    expect(panelSource).toContain("askSlot={");
    expect(panelSource).toContain("<AskEasyErfPanel");
    expect(panelSource).toContain("evidencePack={overviewReport.evidencePack ?? null}");
    expect(panelSource).toContain("canonicalNextAction={overviewCanonicalNextAction}");
    expect(firstReadSource).toContain("{props.askSlot}");
  });

  it("advances automatically after matched searchable SG evidence is recorded", () => {
    const parcel = evidenceParcel();
    const workspaceState = {
      ...createEmptyErfWorkspaceState(),
      identityStatus: "looks_correct" as const,
    };
    const planning = buildParcelPlanningAssessment({
      parcelId: parcel.id,
      municipality: parcel.municipality ?? null,
      locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
      erfAreaM2: 900,
      manualZoneCode: null,
      documentZoneCode: null,
      documentZoneAssetId: null,
      hasParcelPolygon: true,
    });
    const baseInput = {
      parcel,
      workspaceState,
      assets: [],
      savedEvidence: [],
      planning,
      scenarioCount: 0,
      chosenScenarioId: null,
    };

    const before = canonicalReportAction(baseInput);
    const after = canonicalReportAction({
      ...baseInput,
      assets: [evidenceAsset()],
    });

    expect(before?.id).toBe("investigation-add-sg-diagram");
    expect(after?.id).not.toBe("investigation-add-sg-diagram");
    expect(after?.priority).toBeGreaterThan(before?.priority ?? 0);
  });
});
