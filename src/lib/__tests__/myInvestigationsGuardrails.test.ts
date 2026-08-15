import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), ...path.split("/")), "utf8");
}

describe("My Investigations guardrails", () => {
  it("does not restore the old hard-coded dashboard guidance or browser-only report count", () => {
    const dashboard = source("src/routes/dashboard.tsx");

    expect(dashboard).not.toContain("const NEXT_ACTIONS");
    expect(dashboard).not.toContain("pa.reportInterests.");
    expect(dashboard).not.toContain("Saved Research Dossiers");
    expect(dashboard).toContain("My Investigations");
    expect(dashboard).toContain("Continue Investigation");
    expect(dashboard).toContain("GUIDED_INVESTIGATION_STEPS");
  });

  it("uses the existing saved property row as the durable dashboard projection boundary", () => {
    const sync = source("src/components/workbench/WorkspaceCloudSync.tsx");

    expect(sync).toContain('from("saved_properties")');
    expect(sync).toContain("patchSavedPropertyUserData");
    expect(sync).toContain("buildSavedInvestigationUserDataPatch");
    expect(sync).not.toMatch(/create table|agent_runs|dashboard_progress/i);
  });

  it("keeps the dashboard projection explicitly non-canonical", () => {
    const projection = source("src/lib/workbench/savedInvestigationProjection.ts");

    expect(projection).not.toContain("readinessScore");
    expect(projection).not.toContain("nextBestAction");
    expect(projection).not.toContain("completedStepIds");
    expect(projection).toContain("currentStepId");
    expect(projection).toContain("workspaceUpdatedAt");
  });

  it("mounts workspace cloud sync without replacing the route outlet", () => {
    const root = source("src/routes/__root.tsx");

    expect(root).toContain("<WorkspaceCloudSync />");
    expect(root).toContain("<Outlet />");
  });
});
