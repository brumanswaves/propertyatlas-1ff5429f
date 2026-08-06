import { describe, expect, it } from "vitest";
import {
  workflowFeedbackForStartedTab,
  workspaceProgressPatchForStartedTab,
} from "@/lib/workbench/workbenchTabProgress";

describe("workbench tab progress side effects", () => {
  it("does not mark report started when Documents or Paid Reports are opened", () => {
    expect(workspaceProgressPatchForStartedTab("reports")).toBeNull();
    expect(workflowFeedbackForStartedTab("reports")).toContain("Paid Reports opened");
  });

  it("marks report started only when the actual Easy Erf Report opens", () => {
    expect(workspaceProgressPatchForStartedTab("stoep-report")).toEqual({
      reportStarted: true,
      dirty: true,
    });
    expect(workflowFeedbackForStartedTab("stoep-report")).toContain("Easy Erf Report opened");
  });
});
