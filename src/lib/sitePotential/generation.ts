import {
  SITE_POTENTIAL_DEFAULT_IMAGE_MODEL,
  SITE_POTENTIAL_DISCLAIMER,
  SITE_POTENTIAL_PACK_SIZE,
} from "./config";

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
  const parts = [
    `Create option ${optionIndex + 1} of ${SITE_POTENTIAL_PACK_SIZE} for an Easy Erf ${modeLabel}.`,
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
      ? "Preserve the recognisable building form and camera viewpoint where reference photos are provided."
      : "Do not imply surveyed placement, municipal approval, or exact parcel positioning.",
    "No large text overlay. If watermarking is needed, keep it tiny and unobtrusive.",
    SITE_POTENTIAL_DISCLAIMER,
  ].filter(Boolean);
  return parts.join(" ");
}

export function openAiImageModelFromEnv() {
  return process.env.OPENAI_IMAGE_MODEL || SITE_POTENTIAL_DEFAULT_IMAGE_MODEL;
}

export async function generateImageBase64WithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiImageModelFromEnv(),
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
      response_format: "b64_json",
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI image generation failed (${response.status}).`);
  }
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI response did not include an image.");
  return encoded;
}

export function base64ToBlob(base64: string, mimeType = "image/png") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

