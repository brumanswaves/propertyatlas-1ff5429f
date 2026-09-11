import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const propertyChecks = source("src/components/property/investigation/GuidedPropertyChecksStep.tsx");
const fulfillment = source("src/routes/admin_.fulfillment.tsx");
const admin = source("src/routes/admin.tsx");
const workspace = source("src/components/humanReview/OrderInvestigationWorkspace.tsx");
const sharedReport = source("src/components/humanReview/SharedInvestigationReport.tsx");
const satelliteMap = source("src/components/property/dossier/ReportParcelSatelliteMap.tsx");
const recoveryMigration = source("supabase/migrations/20260911180000_recover_failed_easy_erf_investigation.sql");

describe("Easy Erf product recovery guardrails", () => {
  it("does not require a municipal plan, photo or survey to leave Property Checks", () => {
    expect(propertyChecks).toContain("data-property-checks-optional");
    expect(propertyChecks).toContain("No upload is required to move on");
    expect(propertyChecks).toContain("Continue to Market evidence");
    expect(propertyChecks).not.toContain("const canContinue");
    expect(propertyChecks).not.toContain("disabled={!canContinue}");
  });

  it("puts one plain-language Done-for-You action first in Founder Operations", () => {
    expect(admin).toContain("data-done-for-you-admin-priority");
    expect(admin).toContain("Review next Done-for-You investigation");
    expect(admin).toContain("Users & investigators");
    expect(fulfillment).toContain("data-up-next-investigation");
    expect(fulfillment).toContain("UP NEXT");
    expect(fulfillment).toContain("Continue investigation");
  });

  it("makes a failed investigation explicit and recoverable without deleting evidence", () => {
    expect(fulfillment).toContain("Needs recovery");
    expect(fulfillment).toContain("Reopen and continue investigation");
    expect(fulfillment).toContain("Stop this investigation (rare)");
    expect(fulfillment).toContain("Saved evidence is retained");
    expect(recoveryMigration).toContain("v_from_status not in ('ready', 'failed')");
    expect(recoveryMigration).toContain("failure_reason = null");
    expect(recoveryMigration).toContain("insert into public.report_order_events");
  });

  it("lets an admin find and assign an existing investigator without a raw UUID", () => {
    expect(workspace).toContain("searchFounderSupportUsers");
    expect(workspace).toContain("Search investigator by name or email");
    expect(workspace).toContain("No account UUID is required");
    expect(workspace).toContain("Assign to this investigation");
    expect(workspace).toContain("/admin/users");
    expect(workspace).not.toContain("Existing investigator account UUID");
  });

  it("uses real satellite map context in the paid investigation report", () => {
    expect(sharedReport).toContain("ReportParcelSatelliteMap");
    expect(sharedReport).toContain("heroSlot={openingControls?.heroSlot ?? defaultHero}");
    expect(satelliteMap).toContain("mapbox://styles/mapbox/satellite-streets-v12");
    expect(satelliteMap).toContain("data-report-satellite-map");
    expect(satelliteMap).toContain("recorded parcel boundary");
    expect(satelliteMap).toContain("will not substitute generated imagery");
  });

  it("keeps human-only delivery language independent of AI generation", () => {
    expect(fulfillment).toContain("AI is not required");
    expect(fulfillment).not.toContain("generate the brief and approve the combined report version first");
  });
});
