import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { buildPlanningInvestigationJob } from "@/lib/investigation/planningInvestigationJob";
import { PlanningInvestigationPanel } from "../PlanningInvestigationPanel";

function jobForErf1570() {
  const property = {
    parcelId: "E108C034001400001570000000",
    erfNumber: "1570",
    portion: "0",
    lpi: "C03400140000157000000",
    parcelKey: "E108C034001400001570000000",
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "SEA VISTA",
    town: "St Francis Bay",
  };
  return buildPlanningInvestigationJob({
    property,
    planningAssessment: buildParcelPlanningAssessment({
      parcelId: property.parcelId,
      municipality: property.municipality,
      locationHints: ["Sea Vista", "St Francis Bay"],
      erfAreaM2: 618.7,
      manualZoneCode: "RES1",
    }),
  });
}

describe("PlanningInvestigationPanel", () => {
  it("shows the job as completed Easy Erf work rather than agent plumbing", () => {
    const html = renderToStaticMarkup(<PlanningInvestigationPanel job={jobForErf1570()} />);

    expect(html).toContain("Easy Erf investigated the planning position");
    expect(html).toContain("Sources checked");
    expect(html).toContain("Findings");
    expect(html).toContain("Confidence");
    expect(html).toContain("Still unresolved");
    expect(html).toContain("Next investigation");
    expect(html).not.toContain("agentJobContract");
  });
});
