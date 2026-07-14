import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  processSitePotentialGenerationQueue,
  type SitePotentialGenerationStore,
} from "../generationWorker";
import type { ImageEditReference, OpenAiImageResult } from "../generation";
import type { SitePotentialProject } from "../types";

const baseProject: SitePotentialProject = {
  id: "project-1",
  user_id: "user-1",
  parcel_id: "parcel-1",
  mode: "renovation",
  design_brief: "coastal renovation",
  selected_style: "Coastal contemporary",
  renovation_level: "moderate",
  requested_rooms: [],
  requested_features: [],
  custom_instructions: null,
  rights_confirmed_at: "2026-07-14T00:00:00.000Z",
  generation_status: "generating",
  selected_design_asset_id: null,
  skipped_at: null,
  metadata: {},
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
};

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function claim(optionIndex = 1) {
  return {
    itemId: `item-${optionIndex}`,
    workerId: "worker-1",
    userId: "user-1",
    designPackId: "pack-1",
    siteProjectId: "project-1",
    parcelId: "parcel-1",
    optionIndex,
    attemptCount: 0,
  };
}

function imageResult(): OpenAiImageResult {
  return { b64: Buffer.from("image-bytes").toString("base64"), requestId: "req_123" };
}

function reference(id: string): ImageEditReference {
  return {
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/png",
    fileName: `${id}.png`,
  };
}

function makeStore(overrides: Partial<SitePotentialGenerationStore> = {}) {
  const events: string[] = [];
  const store: SitePotentialGenerationStore = {
    async recoverStaleJobs() {
      events.push("recover");
      return { recoveredItems: 0, recoveredPacks: 0 };
    },
    async claimNextItem() {
      events.push("claim");
      return claim(1);
    },
    async loadContext() {
      events.push("context");
      return {
        project: baseProject,
        inputAssets: [
          {
            id: "source-photo-1",
            asset_category: "existing_house_photo",
            storage_path: "source-photo-1.png",
            mime_type: "image/png",
          },
        ],
      };
    },
    async findExistingAssetForItem() {
      return null;
    },
    async findPrimaryConceptReference() {
      return null;
    },
    async renewLease() {
      events.push("renew");
      return true;
    },
    async downloadReferenceAsset(asset) {
      events.push(`download:${asset.id}`);
      return reference(asset.id);
    },
    async uploadGeneratedImage(claimed) {
      events.push(`upload:${claimed.optionIndex}`);
      return {
        assetId: `asset-${claimed.optionIndex}`,
        storageBucket: "erf-files",
        storagePath: `generated/${claimed.optionIndex}.png`,
        fileName: `generated-${claimed.optionIndex}.png`,
        mimeType: "image/png",
        sizeBytes: 11,
      };
    },
    async removeUploadedImage(upload) {
      events.push(`remove:${upload.storagePath}`);
    },
    async finalizeGeneratedItem(input) {
      events.push(`finalize:${input.claim.optionIndex}`);
      return { id: input.upload.assetId };
    },
    async finalizeExistingAsset(claimed, asset) {
      events.push(`finalize-existing:${claimed.optionIndex}:${asset.id}`);
    },
    async markItemFailed(input) {
      events.push(`failed:${input.claim.optionIndex}:${input.code}:${input.retryable}`);
    },
    ...overrides,
  };
  return { store, events };
}

describe("durable Site Potential generation worker", () => {
  it("uses uploaded renovation photo bytes and does not use prompt-only generation", async () => {
    const { store, events } = makeStore();
    const calls = { generate: 0, editReferences: 0 };
    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      imageClient: {
        async generate() {
          calls.generate += 1;
          return imageResult();
        },
        async edit(_prompt, references) {
          calls.editReferences = references.length;
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({ claimed: 1, completed: 1, failed: 0 });
    expect(calls.generate).toBe(0);
    expect(calls.editReferences).toBe(1);
    expect(events).toContain("download:source-photo-1");
    expect(events).toContain("finalize:1");
  });

  it("references the primary concept image for coordinated alternatives", async () => {
    let metadata: Record<string, unknown> | null = null;
    const { store } = makeStore({
      async claimNextItem() {
        return claim(2);
      },
      async findPrimaryConceptReference() {
        return {
          id: "primary-concept-asset",
          asset_category: "generated_design",
          storage_path: "primary.png",
          mime_type: "image/png",
        };
      },
      async finalizeGeneratedItem(input) {
        metadata = input.metadata;
        return { id: input.upload.assetId };
      },
    });
    let referenceCount = 0;

    await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      imageClient: {
        async generate() {
          throw new Error("Should not generate prompt-only for coordinated alternative.");
        },
        async edit(_prompt, references) {
          referenceCount = references.length;
          return imageResult();
        },
      },
    });

    expect(referenceCount).toBe(2);
    expect(metadata).toMatchObject({
      originalSourceAssetIds: ["source-photo-1"],
      primaryConceptAssetId: "primary-concept-asset",
      sourceAssetIds: ["source-photo-1", "primary-concept-asset"],
      openAiRequestId: "req_123",
    });
  });

  it("does not regenerate a slot with an existing canonical asset", async () => {
    const { store, events } = makeStore({
      async findExistingAssetForItem() {
        return { id: "asset-existing" };
      },
    });

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      imageClient: {
        async generate() {
          throw new Error("No OpenAI call expected.");
        },
        async edit() {
          throw new Error("No OpenAI call expected.");
        },
      },
    });

    expect(result).toMatchObject({ claimed: 1, completed: 1, skippedExisting: 1 });
    expect(events).toContain("finalize-existing:1:asset-existing");
  });

  it("removes uploaded storage object when finalisation fails", async () => {
    const { store, events } = makeStore({
      async finalizeGeneratedItem() {
        throw new Error("transaction rollback");
      },
    });

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      imageClient: {
        async generate() {
          return imageResult();
        },
        async edit() {
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({ claimed: 1, completed: 0, failed: 1 });
    expect(events).toContain("remove:generated/1.png");
    expect(events.some((event) => event.startsWith("failed:1:GENERATION_FAILED:true"))).toBe(true);
  });

  it("recovers stale jobs before claiming and limits worker claims", async () => {
    let claims = 0;
    const { store } = makeStore({
      async recoverStaleJobs() {
        return { recoveredItems: 2, recoveredPacks: 1 };
      },
      async claimNextItem() {
        claims += 1;
        return claims === 1 ? claim(1) : null;
      },
    });

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 6,
      imageClient: {
        async generate() {
          return imageResult();
        },
        async edit() {
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({
      recoveredItems: 2,
      recoveredPacks: 1,
      claimed: 1,
      completed: 1,
    });
  });

  it("creates exactly six canonical assets for six successful slots", async () => {
    let nextOptionIndex = 1;
    const finalizedAssets = new Set<string>();
    const metadataByOption = new Map<number, Record<string, unknown>>();
    const { store } = makeStore({
      async claimNextItem() {
        if (nextOptionIndex > 6) return null;
        return claim(nextOptionIndex++);
      },
      async findPrimaryConceptReference(claimed) {
        if (claimed.optionIndex === 1) return null;
        return {
          id: "asset-1",
          asset_category: "generated_design",
          storage_path: "primary.png",
          mime_type: "image/png",
        };
      },
      async finalizeGeneratedItem(input) {
        finalizedAssets.add(input.upload.assetId);
        metadataByOption.set(input.claim.optionIndex, input.metadata);
        return { id: input.upload.assetId };
      },
    });

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 6,
      imageClient: {
        async generate() {
          return imageResult();
        },
        async edit() {
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({ claimed: 6, completed: 6, failed: 0 });
    expect(finalizedAssets).toEqual(
      new Set(["asset-1", "asset-2", "asset-3", "asset-4", "asset-5", "asset-6"]),
    );
    expect(metadataByOption.get(1)).toMatchObject({ primaryConceptAssetId: null });
    for (const optionIndex of [2, 3, 4, 5, 6]) {
      expect(metadataByOption.get(optionIndex)).toMatchObject({
        primaryConceptAssetId: "asset-1",
        originalSourceAssetIds: ["source-photo-1"],
      });
    }
  });

  it("heartbeats while OpenAI generation is pending", async () => {
    const { store, events } = makeStore();

    await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      leaseRenewalMs: 1,
      imageClient: {
        async generate() {
          return imageResult();
        },
        async edit() {
          await new Promise((resolve) => setTimeout(resolve, 8));
          return imageResult();
        },
      },
    });

    expect(events.filter((event) => event === "renew").length).toBeGreaterThanOrEqual(4);
    expect(events).toContain("finalize:1");
  });

  it("does not make a fourth OpenAI call when max-attempt claims are exhausted", async () => {
    let claims = 0;
    const { store } = makeStore({
      async claimNextItem() {
        claims += 1;
        return claims <= 3 ? { ...claim(1), attemptCount: claims } : null;
      },
      async loadContext() {
        throw new Error("simulated worker crash after claim");
      },
    });
    let openAiCalls = 0;

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 6,
      imageClient: {
        async generate() {
          openAiCalls += 1;
          return imageResult();
        },
        async edit() {
          openAiCalls += 1;
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({ claimed: 3, completed: 0, failed: 3 });
    expect(openAiCalls).toBe(0);
  });

  it("removes uploaded storage and avoids finalisation after lease ownership is lost", async () => {
    let renewals = 0;
    const { store, events } = makeStore({
      async renewLease() {
        renewals += 1;
        events.push(`renew:${renewals}`);
        return renewals < 4;
      },
      async finalizeGeneratedItem() {
        throw new Error("finalise should not run after losing lease");
      },
    });

    const result = await processSitePotentialGenerationQueue({
      store,
      workerId: "worker-1",
      maxItems: 1,
      imageClient: {
        async generate() {
          return imageResult();
        },
        async edit() {
          return imageResult();
        },
      },
    });

    expect(result).toMatchObject({ claimed: 1, completed: 0, failed: 1 });
    expect(events).toContain("remove:generated/1.png");
    expect(events.some((event) => event.startsWith("failed:"))).toBe(false);
  });

  it("does not process the same slot when two workers compete for one claim", async () => {
    let claimed = false;
    const finalizedAssets: string[] = [];
    const { store } = makeStore({
      async claimNextItem(workerId) {
        if (claimed) return null;
        claimed = true;
        return { ...claim(1), workerId };
      },
      async finalizeGeneratedItem(input) {
        finalizedAssets.push(input.upload.assetId);
        return { id: input.upload.assetId };
      },
    });

    const imageClient = {
      async generate() {
        return imageResult();
      },
      async edit() {
        return imageResult();
      },
    };

    const [first, second] = await Promise.all([
      processSitePotentialGenerationQueue({
        store,
        workerId: "worker-a",
        maxItems: 1,
        imageClient,
      }),
      processSitePotentialGenerationQueue({
        store,
        workerId: "worker-b",
        maxItems: 1,
        imageClient,
      }),
    ]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(first.completed + second.completed).toBe(1);
    expect(finalizedAssets).toEqual(["asset-1"]);
  });

  it("keeps the user-facing route as queue-only and free of OpenAI worker calls", () => {
    const route = read("src/routes/api/site-potential.generate.ts");

    expect(route).toContain("queueSitePotentialGeneration");
    expect(route).toContain("durableJobQueued");
    expect(route).not.toContain("requestImageGenerationWithOpenAI");
    expect(route).not.toContain("requestImageEditWithOpenAI");
    expect(route).not.toContain("processSitePotentialGenerationQueue");
    expect(route).not.toMatch(/for\s*\(\s*const\s+item\s+of\s+retry/i);
  });

  it("keeps process-route errors sanitized", () => {
    const route = read("src/routes/api/site-potential.process.ts");
    const handler = read("src/lib/sitePotential/processWorkerRequest.ts");

    expect(route).toContain("handleProcessSitePotentialRequest(request)");
    expect(handler).toContain("publicWorkerError");
    expect(handler).toContain("sanitizedGenerationError");
    expect(handler).not.toContain("error instanceof Error ? error.message");
  });
});
