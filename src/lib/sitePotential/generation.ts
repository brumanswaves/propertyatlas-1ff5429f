import {
  SITE_POTENTIAL_DEFAULT_IMAGE_MODEL,
  SITE_POTENTIAL_DISCLAIMER,
  SITE_POTENTIAL_PACK_SIZE,
} from "./config";
import { SITE_POTENTIAL_PROMPT_VERSION } from "./generationJobs";

export interface SitePotentialPromptInput {
  mode: "vacant_land" | "renovation" | "other_building" | "unknown" | "skipped";
  designBrief?: string | null;
  selectedStyle?: string | null;
  renovationLevel?: string | null;
  requestedRooms?: string[];
  requestedFeatures?: string[];
  customInstructions?: string | null;
  parcelSummary?: string | null;
}

export function buildSitePotentialPrompt(input: SitePotentialPromptInput, optionIndex: number) {
  const modeLabel = input.mode === "renovation" ? "renovation concept" : "vacant-land concept";
  const optionNumber = optionIndex + 1;
  const primaryDirection =
    "Primary concept direction: a coherent premium South African residential concept with restrained coastal materials, practical indoor-outdoor living, and a calm investor-grade presentation.";
  const coordinatedVariation =
    optionNumber === 1
      ? "This is the primary concept. Establish the overall architectural direction for the pack."
      : `This is coordinated alternative ${optionNumber - 1}. Keep the same property identity and primary direction, varying only controlled elements such as exterior colour, material emphasis, landscaping, roof treatment, outdoor living, and renovation intensity. Do not create an unrelated property.`;
  const parts = [
    `Create option ${optionNumber} of ${SITE_POTENTIAL_PACK_SIZE} for an Easy Erf ${modeLabel}.`,
    `Prompt version: ${SITE_POTENTIAL_PROMPT_VERSION}.`,
    primaryDirection,
    coordinatedVariation,
    input.parcelSummary ? `Parcel context: ${input.parcelSummary}.` : null,
    input.designBrief ? `User brief: ${input.designBrief}.` : null,
    input.selectedStyle ? `Style: ${input.selectedStyle}.` : null,
    input.renovationLevel ? `Renovation level: ${input.renovationLevel}.` : null,
    input.requestedRooms?.length ? `Requested rooms: ${input.requestedRooms.join(", ")}.` : null,
    input.requestedFeatures?.length
      ? `Requested features: ${input.requestedFeatures.join(", ")}.`
      : null,
    input.customInstructions ? `Custom instructions: ${input.customInstructions}.` : null,
    "Produce a premium South African residential property concept visualisation.",
    input.mode === "renovation"
      ? "Use the supplied user-uploaded property photograph as the visual reference. Preserve the recognisable house structure, camera viewpoint, site relationship, major openings and massing unless the selected renovation level explicitly allows major changes."
      : "Do not imply surveyed placement, municipal approval, or exact parcel positioning.",
    input.mode !== "renovation"
      ? "If a site photograph is supplied, use it only as an illustrative context reference and do not claim exact parcel or building geometry."
      : null,
    "No large text overlay. If watermarking is needed, keep it tiny and unobtrusive.",
    SITE_POTENTIAL_DISCLAIMER,
  ].filter(Boolean);
  return parts.join(" ");
}

export function openAiImageModelFromEnv() {
  return process.env.OPENAI_IMAGE_MODEL || SITE_POTENTIAL_DEFAULT_IMAGE_MODEL;
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
  return process.env.OPENAI_IMAGE_SIZE || "1024x1024";
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
