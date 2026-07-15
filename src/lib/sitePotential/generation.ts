import {
  SITE_POTENTIAL_DEFAULT_IMAGE_MODEL,
  SITE_POTENTIAL_DEFAULT_IMAGE_QUALITY,
  SITE_POTENTIAL_DEFAULT_IMAGE_SIZE,
  SITE_POTENTIAL_PACK_SIZE,
} from "./config";
import { SITE_POTENTIAL_PROMPT_VERSION } from "./generationJobs";
import {
  describeSitePotentialParcelContext,
  type SitePotentialParcelContext,
} from "./parcelContext";

export interface SitePotentialPromptInput {
  mode: "vacant_land" | "renovation" | "other_building" | "unknown" | "skipped";
  designBrief?: string | null;
  selectedStyle?: string | null;
  renovationLevel?: string | null;
  requestedRooms?: string[];
  requestedFeatures?: string[];
  customInstructions?: string | null;
  parcelContext?: SitePotentialParcelContext | null;
  referenceLabels?: string[];
}

export interface SitePotentialConceptDirection {
  key: string;
  name: string;
  rationale: string;
  designInstruction: string;
  cameraInstruction: string;
}

export const SITE_POTENTIAL_CONCEPT_DIRECTIONS: SitePotentialConceptDirection[] = [
  {
    key: "sheltered-courtyard",
    name: "Sheltered Courtyard",
    rationale:
      "A protected indoor-outdoor heart that uses the building mass to reduce prevailing-wind exposure.",
    designInstruction:
      "Develop a compact L-shaped or courtyard-led home. Use garage, service rooms and solid walls as a wind buffer. Place the main outdoor living area in a sheltered, sunny position with a private street edge.",
    cameraInstruction:
      "Use an elevated oblique view from the street corner that clearly shows the entry, the building footprint and the sheltered courtyard relationship.",
  },
  {
    key: "view-focused-linear",
    name: "View-Focused Linear",
    rationale:
      "A long, view-oriented plan that gives the primary living spaces a strong relationship to the best outlook.",
    designInstruction:
      "Develop an elongated linear or gently cranked home with a materially different footprint from a courtyard house. Organise living spaces and bedrooms toward the best view, with a long covered deck or terrace and service spaces forming a buffer on the exposed side.",
    cameraInstruction:
      "Use a low-to-mid elevated oblique view from the primary view side so the linear massing, deck and relationship to the landscape are unmistakable.",
  },
  {
    key: "split-level-site-response",
    name: "Split-Level Site Response",
    rationale:
      "A stepped concept that works with terrain and separates arrival, living and private zones across levels.",
    designInstruction:
      "Develop a stepped split-level home that follows the apparent slope. Put arrival and garage at the most practical road level, step the main living level toward views and use terraces rather than a flat generic platform. The massing and roof form must be clearly different from the other concepts.",
    cameraInstruction:
      "Use an elevated side-oblique perspective that makes the slope, stepped floor levels, retaining strategy and road access legible.",
  },
];

export function sitePotentialConceptDirection(optionIndex: number) {
  return (
    SITE_POTENTIAL_CONCEPT_DIRECTIONS[optionIndex] ??
    SITE_POTENTIAL_CONCEPT_DIRECTIONS[optionIndex % SITE_POTENTIAL_CONCEPT_DIRECTIONS.length]
  );
}

export function buildSitePotentialPrompt(input: SitePotentialPromptInput, optionIndex: number) {
  const direction = sitePotentialConceptDirection(optionIndex);
  const modeLabel = input.mode === "renovation" ? "renovation" : "new-build";
  const references = input.referenceLabels?.length
    ? input.referenceLabels
        .map((label, index) => `Reference image ${index + 1}: ${label}.`)
        .join(" ")
    : "No reference image was available; rely on the written official parcel context and avoid claiming surveyed accuracy.";
  return [
    `Create one premium landscape-format architectural ${modeLabel} concept visualisation for Easy Erf.`,
    `This is concept ${optionIndex + 1} of ${SITE_POTENTIAL_PACK_SIZE}: ${direction.name}.`,
    `Prompt version: ${SITE_POTENTIAL_PROMPT_VERSION}.`,
    `Distinct design direction: ${direction.designInstruction}`,
    `Camera and composition: ${direction.cameraInstruction}`,
    `Official parcel context: ${describeSitePotentialParcelContext(input.parcelContext ?? null)}`,
    references,
    input.designBrief ? `User brief: ${input.designBrief}.` : null,
    input.selectedStyle ? `Preferred style: ${input.selectedStyle}.` : null,
    input.renovationLevel ? `Renovation level: ${input.renovationLevel}.` : null,
    input.requestedRooms?.length ? `Requested rooms: ${input.requestedRooms.join(", ")}.` : null,
    input.requestedFeatures?.length
      ? `Requested features: ${input.requestedFeatures.join(", ")}.`
      : null,
    input.customInstructions ? `Additional instructions: ${input.customInstructions}.` : null,
    input.mode === "renovation"
      ? "Preserve the recognisable house structure, site relationship, camera evidence and major openings unless the renovation level expressly permits major structural change."
      : "Use the official parcel map and site photographs as grounding. Respect the visible road side, neighbouring development, orientation, terrain and view direction. Do not place the house on a generic imaginary waterfront lot.",
    "Create a realistic South African residential architectural visualisation with buildable-looking proportions, restrained materials and credible landscaping.",
    "The three concepts are independent. Do not imitate or preserve any previously generated Easy Erf concept. The footprint, massing, roof form, outdoor-space logic and camera composition must follow this concept's named direction.",
    "Do not generate words, captions, labels, signs, watermarks, logos, disclaimers, borders, floor-plan annotations or presentation-board text inside the image.",
    "Do not imply municipal approval, surveyed placement or exact legal buildability. Produce one coherent photorealistic image only.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function openAiImageModelFromEnv() {
  return process.env.OPENAI_IMAGE_MODEL || SITE_POTENTIAL_DEFAULT_IMAGE_MODEL;
}

export function openAiImageQualityFromEnv() {
  const value = String(
    process.env.OPENAI_IMAGE_QUALITY || SITE_POTENTIAL_DEFAULT_IMAGE_QUALITY,
  ).toLowerCase();
  return value === "low" || value === "high" || value === "auto" ? value : "medium";
}

export interface OpenAiImageResult {
  b64: string;
  requestId: string | null;
}

export interface OpenAiImageRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function openAiOutputFormat() {
  const configured = String(process.env.OPENAI_IMAGE_OUTPUT_FORMAT ?? "png").toLowerCase();
  return configured === "jpeg" || configured === "webp" ? configured : "png";
}

function openAiImageSize() {
  return process.env.OPENAI_IMAGE_SIZE || SITE_POTENTIAL_DEFAULT_IMAGE_SIZE;
}

function isTransientOpenAiStatus(status: number) {
  return status === 429 || status >= 500;
}

function retryAfterMs(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return Math.min(8000, 1000 * 2 ** attempt);
}

async function parseOpenAiImageResponse(response: Response, label: string) {
  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `${label} failed (${response.status}).`);
  }
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) throw new Error(`${label} response did not include an image.`);
  return {
    b64: encoded,
    requestId: response.headers.get("x-request-id"),
  };
}

async function withTransientOpenAiRetry(
  request: () => Promise<Response>,
  label: string,
  options: OpenAiImageRequestOptions = {},
  maxAttempts = 3,
): Promise<OpenAiImageResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await request();
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`${label} timed out before the worker lease expired.`);
      }
      throw error;
    }
    if (response.ok || !isTransientOpenAiStatus(response.status) || attempt === maxAttempts - 1) {
      return parseOpenAiImageResponse(response, label);
    }
    lastError = new Error(`${label} transient failure (${response.status}).`);
    await waitForRetry(retryAfterMs(response, attempt), options.signal);
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function waitForRetry(ms: number, signal?: AbortSignal) {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function requestSignal(options: OpenAiImageRequestOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 9 * 60 * 1000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    },
  };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  options: OpenAiImageRequestOptions = {},
) {
  const { signal, cleanup } = requestSignal(options);
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    cleanup();
  }
}

export async function requestImageGenerationWithOpenAI(
  prompt: string,
  options: OpenAiImageRequestOptions = {},
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return withTransientOpenAiRetry(
    () =>
      fetchWithTimeout(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: openAiImageModelFromEnv(),
            prompt,
            size: openAiImageSize(),
            output_format: openAiOutputFormat(),
            quality: openAiImageQualityFromEnv(),
          }),
        },
        options,
      ),
    "OpenAI image generation",
    options,
  );
}

export async function generateImageBase64WithOpenAI(prompt: string) {
  return (await requestImageGenerationWithOpenAI(prompt)).b64;
}

export interface ImageEditReference {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

const SUPPORTED_REFERENCE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validateImageEditReferences(references: ImageEditReference[]) {
  if (!references.length) throw new Error("At least one image reference is required.");
  for (const reference of references) {
    const mimeType = reference.mimeType.toLowerCase();
    if (!SUPPORTED_REFERENCE_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported image reference type: ${reference.mimeType}`);
    }
    if (reference.bytes.byteLength > 25 * 1024 * 1024) {
      throw new Error("Image reference exceeds the supported input size.");
    }
  }
}

export async function requestImageEditWithOpenAI(
  prompt: string,
  references: ImageEditReference | ImageEditReference[],
  options: OpenAiImageRequestOptions = {},
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const referenceList = Array.isArray(references) ? references : [references];
  validateImageEditReferences(referenceList);
  const form = new FormData();
  form.append("model", openAiImageModelFromEnv());
  form.append("prompt", prompt);
  form.append("size", openAiImageSize());
  form.append("output_format", openAiOutputFormat());
  form.append("quality", openAiImageQualityFromEnv());
  referenceList.forEach((reference, index) => {
    const imageBytes = new Uint8Array(reference.bytes.byteLength);
    imageBytes.set(reference.bytes);
    form.append(
      "image[]",
      new Blob([imageBytes.buffer], { type: reference.mimeType || "image/png" }),
      reference.fileName || `reference-image-${index + 1}.png`,
    );
  });
  return withTransientOpenAiRetry(
    () =>
      fetchWithTimeout(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
        },
        options,
      ),
    "OpenAI image edit",
    options,
  );
}

export async function editImageBase64WithOpenAI(
  prompt: string,
  references: ImageEditReference | ImageEditReference[],
) {
  return (await requestImageEditWithOpenAI(prompt, references)).b64;
}

export function base64ToBlob(base64: string, mimeType = "image/png") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
