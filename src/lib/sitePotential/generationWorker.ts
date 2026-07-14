import {
  buildSitePotentialPrompt,
  openAiImageModelFromEnv,
  type ImageEditReference,
  type OpenAiImageResult,
} from "./generation";
import {
  buildGeneratedDesignMetadata,
  isPermanentGenerationFailure,
  nextAttemptAt,
  requiresImageEditPath,
  sanitizedGenerationError,
  sourceAssetsForGenerationMode,
  type SourceAssetLike,
} from "./generationJobs";
import type { SitePotentialProject } from "./types";

export interface GenerationWorkerClaim {
  itemId: string;
  workerId: string;
  userId: string;
  designPackId: string;
  siteProjectId: string;
  parcelId: string;
  optionIndex: number;
  attemptCount: number;
}

export interface ExistingGeneratedAsset {
  id: string;
}

export interface StoredReferenceAsset extends SourceAssetLike {
  storage_bucket?: string | null;
  storage_path?: string | null;
}

export interface GenerationWorkerContext {
  project: SitePotentialProject;
  inputAssets: StoredReferenceAsset[];
}

export interface UploadedGeneratedImage {
  assetId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FinalizeGeneratedItemInput {
  claim: GenerationWorkerClaim;
  upload: UploadedGeneratedImage;
  assetType: string;
  metadata: Record<string, unknown>;
}

export interface MarkGenerationFailureInput {
  claim: GenerationWorkerClaim;
  code: string;
  message: string;
  retryable: boolean;
  nextAttemptAt: string | null;
}

export interface SitePotentialGenerationStore {
  recoverStaleJobs(now: Date): Promise<{ recoveredItems: number; recoveredPacks: number }>;
  claimNextItem(workerId: string, now: Date): Promise<GenerationWorkerClaim | null>;
  loadContext(claim: GenerationWorkerClaim): Promise<GenerationWorkerContext>;
  findExistingAssetForItem(claim: GenerationWorkerClaim): Promise<ExistingGeneratedAsset | null>;
  findPrimaryConceptReference(claim: GenerationWorkerClaim): Promise<StoredReferenceAsset | null>;
  downloadReferenceAsset(asset: StoredReferenceAsset): Promise<ImageEditReference>;
  uploadGeneratedImage(
    claim: GenerationWorkerClaim,
    imageBytes: Uint8Array,
  ): Promise<UploadedGeneratedImage>;
  removeUploadedImage(upload: UploadedGeneratedImage): Promise<void>;
  finalizeGeneratedItem(input: FinalizeGeneratedItemInput): Promise<ExistingGeneratedAsset>;
  finalizeExistingAsset(claim: GenerationWorkerClaim, asset: ExistingGeneratedAsset): Promise<void>;
  markItemFailed(input: MarkGenerationFailureInput): Promise<void>;
}

export interface SitePotentialImageClient {
  generate(prompt: string): Promise<OpenAiImageResult>;
  edit(prompt: string, references: ImageEditReference[]): Promise<OpenAiImageResult>;
}

export interface SitePotentialWorkerResult {
  workerId: string;
  recoveredItems: number;
  recoveredPacks: number;
  claimed: number;
  completed: number;
  failed: number;
  skippedExisting: number;
}

export async function processSitePotentialGenerationQueue(input: {
  store: SitePotentialGenerationStore;
  imageClient: SitePotentialImageClient;
  workerId: string;
  maxItems?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const recovery = await input.store.recoverStaleJobs(now);
  const result: SitePotentialWorkerResult = {
    workerId: input.workerId,
    recoveredItems: recovery.recoveredItems,
    recoveredPacks: recovery.recoveredPacks,
    claimed: 0,
    completed: 0,
    failed: 0,
    skippedExisting: 0,
  };
  const maxItems = input.maxItems ?? 1;

  for (let index = 0; index < maxItems; index += 1) {
    const claim = await input.store.claimNextItem(input.workerId, new Date());
    if (!claim) break;
    result.claimed += 1;

    const existing = await input.store.findExistingAssetForItem(claim);
    if (existing) {
      await input.store.finalizeExistingAsset(claim, existing);
      result.skippedExisting += 1;
      result.completed += 1;
      continue;
    }

    try {
      await processClaimedSitePotentialItem({
        store: input.store,
        imageClient: input.imageClient,
        claim,
      });
      result.completed += 1;
    } catch (error) {
      result.failed += 1;
      const code = generationFailureCode(error);
      const retryable = !isPermanentGenerationFailure(code);
      await input.store.markItemFailed({
        claim,
        code,
        message: sanitizedGenerationError(error),
        retryable,
        nextAttemptAt: retryable
          ? nextAttemptAt({ attemptCount: claim.attemptCount, now: new Date() })
          : null,
      });
    }
  }

  return result;
}

async function processClaimedSitePotentialItem(input: {
  store: SitePotentialGenerationStore;
  imageClient: SitePotentialImageClient;
  claim: GenerationWorkerClaim;
}) {
  const context = await input.store.loadContext(input.claim);
  const sourceAssets = sourceAssetsForGenerationMode(context.project.mode, context.inputAssets);
  const originalReferences: ImageEditReference[] = [];
  for (const sourceAsset of sourceAssets) {
    originalReferences.push(await input.store.downloadReferenceAsset(sourceAsset));
  }
  const primaryConcept =
    input.claim.optionIndex > 1 ? await input.store.findPrimaryConceptReference(input.claim) : null;
  const primaryReference = primaryConcept
    ? await input.store.downloadReferenceAsset(primaryConcept)
    : null;
  const references = primaryReference
    ? [...originalReferences, primaryReference]
    : originalReferences;
  const prompt = buildSitePotentialPrompt(
    {
      mode: context.project.mode,
      designBrief: context.project.design_brief,
      selectedStyle: context.project.selected_style,
      renovationLevel: context.project.renovation_level,
      requestedRooms: context.project.requested_rooms ?? [],
      requestedFeatures: context.project.requested_features ?? [],
      customInstructions: context.project.custom_instructions,
      parcelSummary: `Parcel ${input.claim.parcelId}`,
    },
    input.claim.optionIndex - 1,
  );
  const image =
    requiresImageEditPath(context.project.mode, sourceAssets) || primaryReference
      ? await input.imageClient.edit(prompt, references)
      : await input.imageClient.generate(prompt);
  const imageBytes = Uint8Array.from(Buffer.from(image.b64, "base64"));
  const upload = await input.store.uploadGeneratedImage(input.claim, imageBytes);
  try {
    await input.store.finalizeGeneratedItem({
      claim: input.claim,
      upload,
      assetType: context.project.mode === "renovation" ? "renovation_concept" : "new_build_concept",
      metadata: buildGeneratedDesignMetadata({
        designPackId: input.claim.designPackId,
        designPackItemId: input.claim.itemId,
        optionIndex: input.claim.optionIndex,
        siteProjectId: input.claim.siteProjectId,
        sourceAssetIds: [
          ...sourceAssets.map((asset) => asset.id),
          ...(primaryConcept ? [primaryConcept.id] : []),
        ],
        originalSourceAssetIds: sourceAssets.map((asset) => asset.id),
        primaryConceptAssetId: primaryConcept?.id ?? null,
        model: openAiImageModelFromEnv(),
        prompt,
        openAiRequestId: image.requestId,
      }),
    });
  } catch (error) {
    await input.store.removeUploadedImage(upload);
    throw error;
  }
}

function generationFailureCode(error: unknown) {
  const message = sanitizedGenerationError(error).toLowerCase();
  if (message.includes("moderation")) return "MODERATION_BLOCKED";
  if (message.includes("unsupported image") || message.includes("source image")) {
    return "SOURCE_IMAGE_INVALID";
  }
  if (message.includes("invalid")) return "INVALID_INPUT";
  return "GENERATION_FAILED";
}
