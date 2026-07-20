import { describe, expect, it } from "vitest";
import { buildSitePotentialGenerationEstimate } from "../generationEstimate";

describe("Site Potential generation estimates", () => {
  it("shows a broad queued estimate for a new three-concept pack", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "queued",
      requestedCount: 3,
      completedCount: 0,
    });
    expect(estimate?.message).toBe("Approximately 5-20 minutes for three concepts.");
    expect(estimate?.detail).toBe("Images appear individually as they complete.");
    expect(estimate?.active).toBe(true);
  });

  it("uses first-concept copy while generation starts", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "generating",
      requestedCount: 3,
      completedCount: 0,
    });
    expect(estimate?.message).toBe(
      "The first concept is being created. This normally takes several minutes.",
    );
  });

  it("estimates remaining time after one concept has completed", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "generating",
      requestedCount: 3,
      completedCount: 1,
    });
    expect(estimate?.message).toBe(
      "2 concepts remain. Estimated remaining time: approximately 4-15 minutes.",
    );
  });

  it("shows retry copy without pretending to have a countdown", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "partial_failed",
      requestedCount: 3,
      completedCount: 1,
    });
    expect(estimate?.message).toBe("A retry is in progress. This can add several minutes.");
    expect(estimate?.detail).toContain("2 concepts remain");
  });

  it("does not show an active estimate after all concepts are ready", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "complete",
      requestedCount: 3,
      completedCount: 3,
    });
    expect(estimate?.message).toBe("All 3 concepts are ready.");
    expect(estimate?.active).toBe(false);
  });
});
