import { describe, expect, it } from "vitest";
import { buildSitePotentialRuntimeProgress } from "../generationProgress";

const now = new Date("2026-07-20T12:05:00Z");

describe("Site Potential runtime generation progress", () => {
  it("shows queued packs as waiting, not generating", () => {
    const progress = buildSitePotentialRuntimeProgress(
      {
        status: "queued",
        requestedCount: 3,
        completedCount: 0,
        createdAt: "2026-07-20T12:04:30Z",
        workerActive: false,
        items: [
          { optionIndex: 1, status: "queued" },
          { optionIndex: 2, status: "queued" },
          { optionIndex: 3, status: "queued" },
        ],
      },
      now,
      now,
    );

    expect(progress?.heading).toBe("Waiting for generator");
    expect(progress?.detail).toBe("Waiting for the image generator to start.");
    expect(progress?.slots.map((slot) => slot.status)).toEqual(["Waiting", "Waiting", "Waiting"]);
  });

  it("shows the exact concept number once a worker starts generating", () => {
    const progress = buildSitePotentialRuntimeProgress(
      {
        status: "generating",
        requestedCount: 3,
        completedCount: 0,
        workerHeartbeatAt: "2026-07-20T12:04:45Z",
        items: [
          { optionIndex: 1, status: "generating" },
          { optionIndex: 2, status: "queued" },
          { optionIndex: 3, status: "queued" },
        ],
      },
      now,
      now,
    );

    expect(progress?.heading).toBe("Creating concept 1 of 3");
    expect(progress?.workerActive).toBe(true);
    expect(progress?.slots[0]).toMatchObject({ optionIndex: 1, status: "Generating" });
  });

  it("shows completed counts and does not reset elapsed time on status checks", () => {
    const progress = buildSitePotentialRuntimeProgress(
      {
        status: "generating",
        requestedCount: 3,
        completedCount: 1,
        createdAt: "2026-07-20T12:00:00Z",
        items: [
          { optionIndex: 1, status: "complete", generatedAssetReady: true },
          { optionIndex: 2, status: "queued" },
          { optionIndex: 3, status: "queued" },
        ],
      },
      now,
      new Date("2026-07-20T12:04:50Z"),
    );

    expect(progress?.heading).toBe("1 of 3 concepts ready");
    expect(progress?.progressLabel).toBe("1 of 3");
    expect(progress?.startedLabel).toBe("Started 5 minutes ago");
    expect(progress?.lastCheckedLabel).toBe("Last status check 10 seconds ago");
  });

  it("detects stalled queued packs without worker activity", () => {
    const progress = buildSitePotentialRuntimeProgress(
      {
        status: "queued",
        requestedCount: 3,
        completedCount: 0,
        createdAt: "2026-07-20T12:02:00Z",
        workerActive: false,
      },
      now,
      now,
    );

    expect(progress?.stalled).toBe(true);
    expect(progress?.detail).toContain("background worker");
  });

  it("shows retryable and terminal failure states with sanitized messages", () => {
    const retryable = buildSitePotentialRuntimeProgress(
      {
        status: "partial_failed",
        requestedCount: 3,
        completedCount: 1,
        hasRetryableWork: true,
        items: [
          { optionIndex: 1, status: "complete", generatedAssetReady: true },
          { optionIndex: 2, status: "failed", attemptCount: 1 },
          { optionIndex: 3, status: "queued" },
        ],
      },
      now,
      now,
    );
    const terminal = buildSitePotentialRuntimeProgress(
      {
        status: "failed",
        requestedCount: 3,
        completedCount: 0,
        terminal: true,
        failureMessage: "SUPABASE_SERVICE_ROLE_KEY sk-secret raw failure",
        items: [{ optionIndex: 1, status: "failed", attemptCount: 3 }],
      },
      now,
      now,
    );

    expect(retryable?.heading).toBe("Retrying concept 2");
    expect(retryable?.slots[1].status).toBe("Retrying");
    expect(terminal?.heading).toBe("Generation needs attention");
    expect(terminal?.sanitizedFailure).not.toContain("sk-secret");
    expect(terminal?.sanitizedFailure).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
