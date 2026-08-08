import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildPropertyEvidencePack } from "@/lib/evidence/buildPropertyEvidencePack";
import { buildAskEasyErfSelectedEvidencePayload } from "@/lib/reports/askEasyErf";
import {
  buildPropertyFirstReadModel,
  PropertyFirstRead,
  type PropertyFirstReadProps,
} from "../PropertyFirstRead";

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "csg:lpi:test-808",
    source: "csg",
    sourceLabel: "Chief Surveyor-General",
    erfNumber: "808",
    portion: 0,
    lpi: "C00000000000080800000",
    parcelKey: "E000C000000000000808000000",
    municipality: "Test Local Municipality",
    province: "EASTERN CAPE",
    suburbOrArea: "TEST LOCALITY",
    town: "TEST REGISTRATION REGION",
    coordinates: { lat: -34.1, lng: 24.8 },
    knownFields: [],
    missingFields: [],
    rawProperties: { GEOM_AREA: 777.25 },
    ...overrides,
  };
}

function props(overrides: Partial<PropertyFirstReadProps> = {}): PropertyFirstReadProps {
  const subject = overrides.parcel ?? parcel();
  const workspaceState = createEmptyErfWorkspaceState();
  const planning = buildParcelPlanningAssessment({
    parcelId: subject.id,
    municipality: subject.municipality ?? null,
    locationHints: [subject.suburbOrArea, subject.town, subject.municipality, subject.province],
    erfAreaM2: 777.25,
    manualZoneCode: null,
    documentZoneCode: null,
    documentZoneAssetId: null,
    hasParcelPolygon: true,
  });

  return {
    parcel: subject,
    displayTitle: "Erf 808 Portion 0",
    displaySubtitle: "TEST LOCALITY · TEST REGISTRATION REGION",
    workingAddressLine: null,
    investigationInput: {
      parcel: subject,
      workspaceState,
      assets: [],
      savedEvidence: [],
      planning,
      scenarioCount: 0,
      chosenScenarioId: null,
      marketAddressLine: null,
      startedAt: null,
    },
    planning,
    assets: [],
    savedEvidence: [],
    chosenScenario: null,
    mapSlot: <div>Selected erf map</div>,
    onInvestigate: vi.fn(),
    onOpenExpertTools: vi.fn(),
    ...overrides,
  };
}

describe("PropertyFirstRead", () => {
  it("renders a canonical property first read without copied showcase values", () => {
    const input = props({ askSlot: <div>Shared Ask Easy Erf panel</div> });
    const model = buildPropertyFirstReadModel(input);
    const markup = renderToStaticMarkup(<PropertyFirstRead {...input} />);

    expect(model.title).toBe("Erf 808 Portion 0");
    expect(model.facts).toContainEqual({
      label: "Official cadastral area",
      value: "777.3 m²",
      note: "CSG cadastral area",
    });
    expect(markup).toContain("Property first read");
    expect(markup).toContain("Property facts");
    expect(markup).toContain("Evidence status");
    expect(markup).toContain("Planning snapshot");
    expect(markup).toContain("Selected erf map");
    expect(markup).toContain("Shared Ask Easy Erf panel");
    expect(markup.indexOf("Shared Ask Easy Erf panel")).toBeGreaterThan(
      markup.indexOf("Property facts"),
    );
    expect(markup.indexOf("Shared Ask Easy Erf panel")).toBeLessThan(
      markup.indexOf("Evidence status"),
    );
    expect(markup).not.toContain("Erf 1570");
    expect(markup).not.toContain("618.7 m²");
  });

  it("hides absent facts and never turns missing evidence into zero or verified state", () => {
    const subject = parcel({
      erfNumber: null,
      portion: null,
      lpi: null,
      parcelKey: null,
      rawProperties: {},
    });
    const input = props({ parcel: subject, displayTitle: "Selected official parcel" });
    const model = buildPropertyFirstReadModel(input);
    const joinedFacts = model.facts.map((fact) => `${fact.label}: ${fact.value}`).join(" | ");

    expect(joinedFacts).not.toContain("Erf:");
    expect(joinedFacts).not.toContain("Portion:");
    expect(joinedFacts).not.toContain("0 m²");
    expect(model.evidenceStatuses.find((item) => item.id === "identity")?.status).toBe(
      "Needs evidence",
    );
    expect(model.evidenceStatuses).toHaveLength(9);
    expect(model.evidenceStatuses.some((item) => item.status === "Verified")).toBe(false);
  });

  it("labels manual planning rules and derived footprint as assumptions", () => {
    const subject = parcel({ municipality: "Kouga Local Municipality" });
    const planning = buildParcelPlanningAssessment({
      parcelId: subject.id,
      municipality: subject.municipality ?? null,
      locationHints: ["SEA VISTA", "HUMANSDORP"],
      erfAreaM2: 777.25,
      manualZoneCode: "RES1",
      documentZoneCode: null,
      documentZoneAssetId: null,
      hasParcelPolygon: true,
    });
    const base = props({ parcel: subject });
    const input: PropertyFirstReadProps = {
      ...base,
      planning,
      investigationInput: { ...base.investigationInput, planning },
    };
    const model = buildPropertyFirstReadModel(input);
    const joined = model.planningRows
      .map((row) => `${row.label} ${row.value} ${row.state}`)
      .join(" | ");

    expect(joined).toContain("Working assumption");
    expect(joined).toContain("Working estimate from an unverified coverage assumption");
    expect(joined).not.toContain("Official property right");
  });

  it("keeps Property First Read and Ask aligned to the same manual planning assumption", () => {
    const subject = parcel({ municipality: "Kouga Local Municipality" });
    const planning = buildParcelPlanningAssessment({
      parcelId: subject.id,
      municipality: subject.municipality ?? null,
      locationHints: ["SEA VISTA", "HUMANSDORP"],
      erfAreaM2: 777.25,
      manualZoneCode: "RES1",
      documentZoneCode: null,
      documentZoneAssetId: null,
      hasParcelPolygon: true,
      now: new Date("2026-07-16T08:00:00Z"),
    });
    const base = props({ parcel: subject });
    const input: PropertyFirstReadProps = {
      ...base,
      planning,
      investigationInput: { ...base.investigationInput, planning },
    };
    const model = buildPropertyFirstReadModel(input);
    const pack = buildPropertyEvidencePack({
      parcel: subject,
      workspaceState: base.investigationInput.workspaceState,
      assets: [],
      planningAssessment: planning,
      now: new Date("2026-07-16T08:00:00Z"),
    });
    const selected = buildAskEasyErfSelectedEvidencePayload({
      pack,
      question: "What do we know about zoning?",
      now: new Date("2026-07-16T08:00:00Z"),
    });
    const firstReadZoning = model.evidenceStatuses.find((item) => item.id === "zoning");
    const askZoning = selected.claims.find((claim) => claim.key === "zoning");

    expect(firstReadZoning?.status).toBe("Working assumption");
    expect(askZoning).toMatchObject({ nature: "assumption", status: "not_reviewed" });
    expect(askZoning?.confidenceReason).toContain("Working zoning assumption");
  });

  it("keeps official polygon zoning distinct from document support", () => {
    const base = props();
    const planning = {
      ...base.planning,
      detection: {
        ...base.planning.detection,
        method: "official_polygon" as const,
        zoneCode: "RES1",
        zoneName: "Residential Zone 1",
      },
    };
    const input: PropertyFirstReadProps = {
      ...base,
      planning,
      investigationInput: { ...base.investigationInput, planning },
    };
    const model = buildPropertyFirstReadModel(input);
    const zoning = model.evidenceStatuses.find((item) => item.id === "zoning");

    expect(zoning?.status).toBe("Official polygon supported");
    expect(zoning?.detail).toContain("official planning polygon");
    expect(`${zoning?.status} ${zoning?.detail}`).not.toContain("Document supported");
    expect(model.planningRows[0]?.state).toContain("Official polygon supported");
  });

  it("labels Shape__Area as approximate and retains its warning", () => {
    const subject = parcel({ rawProperties: { Shape__Area: 812.4 } });
    const input = props({ parcel: subject });
    const model = buildPropertyFirstReadModel(input);
    const markup = renderToStaticMarkup(<PropertyFirstRead {...input} />);
    const areaFact = model.facts.find((fact) => fact.value.includes("812.4"));

    expect(areaFact).toMatchObject({
      label: "Approximate parcel area",
      note: "Approximate map geometry area",
    });
    expect(model.area?.warning).toContain("Approximate: derived from projected map geometry");
    expect(markup).toContain("Approximate: derived from projected map geometry");
    expect(areaFact?.label).not.toBe("Official cadastral area");
  });

  it("continues an existing Guided investigation without creating a second journey", () => {
    const base = props();
    const startedWorkspace = {
      ...base.investigationInput.workspaceState,
      investigation: {
        ...base.investigationInput.workspaceState.investigation,
        startedAt: "2026-08-01T08:00:00.000Z",
        currentStepId: "add-address",
      },
    };
    const input: PropertyFirstReadProps = {
      ...base,
      investigationInput: {
        ...base.investigationInput,
        workspaceState: startedWorkspace,
        startedAt: startedWorkspace.investigation.startedAt,
      },
    };

    expect(buildPropertyFirstReadModel(input).investigateLabel).toBe("Continue investigation");
    expect(renderToStaticMarkup(<PropertyFirstRead {...input} />)).toContain(
      "Continue investigation",
    );
  });
});
