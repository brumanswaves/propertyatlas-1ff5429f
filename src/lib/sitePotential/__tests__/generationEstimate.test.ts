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
      "The first concept is being created. This usually takes a few minutes.",
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

  it("estimates remaining time after two concepts have completed", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "generating",
      requestedCount: 3,
      completedCount: 2,
    });
    expect(estimate?.message).toBe(
      "1 concept remains. Estimated remaining time: approximately 2-8 minutes.",
    );
  });

  it("shows retry copy for retryable partial failure only", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "partial_failed",
      requestedCount: 3,
      completedCount: 1,
      items: [
        { status: "complete", generatedAssetId: "asset-1" },
        { status: "failed", attemptCount: 1 },
        { status: "queued", attemptCount: 0 },
      ],
    });
    expect(estimate?.message).toBe("A retry is in progress. This can add a few minutes.");
    expect(estimate?.detail).toContain("2 concepts remain");
    expect(estimate?.active).toBe(true);
  });

  it("shows retry copy for retryable failed state only", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "failed",
      requestedCount: 3,
      completedCount: 0,
      items: [{ status: "failed", attemptCount: 1, nextAttemptAt: "2026-07-20T12:00:00Z" }],
    });
    expect(estimate?.message).toBe("A retry is in progress. This can add a few minutes.");
    expect(estimate?.active).toBe(true);
  });

  it("does not show retry copy for terminal partial failure", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "partial_failed",
      requestedCount: 3,
      completedCount: 1,
      hasRetryableWork: false,
    });
    expect(estimate?.message).toBe(
      "Generation stopped with 1 of 3 concepts ready. No completion estimate is available.",
    );
    expect(estimate?.active).toBe(false);
    expect(estimate?.message).not.toContain("retry");
  });

  it("does not show retry copy for terminal complete failure", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "failed",
      requestedCount: 3,
      completedCount: 0,
      items: [{ status: "failed", attemptCount: 5 }],
    });
    expect(estimate?.message).toBe(
      "Generation could not be completed. No completion estimate is available.",
    );
    expect(estimate?.active).toBe(false);
    expect(estimate?.message).not.toContain("retry");
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

  it("falls back safely for malformed or non-finite counts", () => {
    const estimate = buildSitePotentialGenerationEstimate({
      status: "queued",
      requestedCount: Number.NaN,
      completedCount: Number.POSITIVE_INFINITY,
    });
    expect(estimate?.message).toBe("Approximately 5-20 minutes for three concepts.");
    expect(estimate?.remainingCount).toBe(3);
    expect(estimate?.active).toBe(true);
  });
});
