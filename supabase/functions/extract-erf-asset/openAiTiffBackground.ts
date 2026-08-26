import { erfExtractionResponsesTextFormat } from "../_shared/erfExtractionContract.ts";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const FILE_EXPIRY_SECONDS = 60 * 60;
const TIFF_DEEP_BACKGROUND_MAX_OUTPUT_TOKENS = 24_000;
const TIFF_DEEP_BACKGROUND_REASONING_EFFORT = "high";
const TIFF_FAST_PREPROCESS_MAX_OUTPUT_TOKENS = 4_000;
const TIFF_FAST_PREPROCESS_REASONING_EFFORT = "low";
const CODE_INTERPRETER_OUTPUT_INCLUDE = "code_interpreter_call.outputs";

export const OPENAI_TIFF_EXTRACTION_PROVIDER = "openai_code_interpreter" as const;
export const OPENAI_TIFF_FAST_PREPROCESS_PROVIDER = "openai_sg_tiff_fast_preprocess" as const;
export const OPENAI_TIFF_EXPECTED_PREPROCESS_IMAGES = 5;

export class OpenAiTiffBackgroundError extends Error {
  constructor(
    public readonly stage: "upload" | "start" | "retrieve",
    public readonly statusCode: number | null = null,
  ) {
    super("The survey plan background review could not be completed.");
    this.name = "OpenAiTiffBackgroundError";
  }
}

interface OpenAiResponsePayload {
  id?: unknown;
  status?: unknown;
  output?: unknown;
}

export interface OpenAiTiffResources {
  fileId: string | null;
  containerId: string | null;
}

export interface OpenAiTiffBackgroundJob extends OpenAiTiffResources {
  responseId: string;
}

export type OpenAiTiffPollResult =
  | ({ state: "processing"; status: "queued" | "in_progress" } & OpenAiTiffResources)
  | ({ state: "completed"; parsed: unknown; previewUrls: string[] } & OpenAiTiffResources)
  | ({ state: "failed"; status: "failed" | "cancelled" | "incomplete" } & OpenAiTiffResources);

export type OpenAiTiffBackgroundMode = "deep_review" | "fast_preprocess";

function authHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

function responseId(payload: OpenAiResponsePayload | null) {
  return typeof payload?.id === "string" && payload.id ? payload.id : null;
}

function responseStatus(payload: OpenAiResponsePayload | null) {
  return typeof payload?.status === "string" ? payload.status : null;
}

function responseContainerId(payload: OpenAiResponsePayload | null) {
  if (!Array.isArray(payload?.output)) return null;
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (raw.type === "code_interpreter_call" && typeof raw.container_id === "string") {
      return raw.container_id;
    }
  }
  return null;
}

function responseOutputText(payload: OpenAiResponsePayload | null) {
  if (!Array.isArray(payload?.output)) return null;
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const raw = part as Record<string, unknown>;
      if (raw.type === "output_text" && typeof raw.text === "string") return raw.text;
    }
  }
  return null;
}

export function responseImageOutputUrls(payload: OpenAiResponsePayload | null) {
  if (!Array.isArray(payload?.output)) return [];
  const urls: string[] = [];
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const outputs = (item as Record<string, unknown>).outputs;
    if (!Array.isArray(outputs)) continue;
    for (const output of outputs) {
      if (!output || typeof output !== "object") continue;
      const raw = output as Record<string, unknown>;
      if (raw.type === "image" && typeof raw.url === "string" && raw.url.trim()) {
        urls.push(raw.url.trim());
      }
    }
  }
  return urls;
}

export function responseImageOutputUrl(payload: OpenAiResponsePayload | null) {
  return responseImageOutputUrls(payload)[0] ?? null;
}

function codeInterpreterDeepTiffInstructions() {
  return [
    "Review the attached Surveyor-General TIFF using Code Interpreter and return only the required structured extraction result.",
    "The file may be a 70M+ pixel bilevel survey TIFF.",
    "NEVER render or copy the entire full-resolution TIFF into one large image or matrix.",
    "Use memory-safe strip, tile, downscale and crop processing.",
    "Create a low-resolution overview, then inspect bounded native-resolution crops for small printed labels.",
    "Create exactly one low-resolution whole-sheet overview for human review, with the longest edge between 1200 and 1600 pixels, grayscale but readable, and no annotations.",
    "Do not merely save the overview to disk: explicitly DISPLAY it inline from Code Interpreter so its output contains exactly one image. Never display the full-resolution source TIFF.",
    "Search the full sheet for the requested erf number.",
    "Distinguish the subject erf from its parent General Plan and neighbouring erven.",
    "Dossier identifiers are comparison context only. Never infer that the target erf is present.",
    "Report only facts visibly supported by the TIFF and explicitly preserve uncertainty.",
    "OCR alone is not identity proof. Every accepted claim needs a supporting quote or visible evidence string and provenance.",
  ].join("\n");
}

function codeInterpreterFastTiffInstructions() {
  return [
    "Prepare this large Surveyor-General TIFF for a separate, normal vision extraction request.",
    "This is conversion only: do not extract facts, identify the property, reason about evidence, or return structured extraction JSON.",
    "Never render or copy the full-resolution TIFF into one large image or matrix.",
    "Use memory-safe strip, tile, downscale and crop processing.",
    "Create and DISPLAY exactly five PNG images in this exact order: one readable low-resolution whole-sheet overview (longest edge about 1800px), then overlapping high-detail crops for top-left, top-right, bottom-left, and bottom-right quadrants (longest edge no more than 2400px).",
    "The four detail images must be a 2 by 2 grid with modest overlap so small labels at boundaries remain visible.",
    "Display the five derived images inline as Code Interpreter image outputs. Do not display the original TIFF. Do not include another image or text answer.",
  ].join("\n");
}

export function codeInterpreterTiffInstructions(mode: OpenAiTiffBackgroundMode = "deep_review") {
  return mode === "fast_preprocess"
    ? codeInterpreterFastTiffInstructions()
    : codeInterpreterDeepTiffInstructions();
}

async function deleteResource(fetchImpl: typeof fetch, apiKey: string, path: string) {
  try {
    const response = await fetchImpl(`${OPENAI_API_BASE}${path}`, {
      method: "DELETE",
      headers: authHeaders(apiKey),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function cleanupOpenAiTiffResources(input: {
  fetchImpl?: typeof fetch;
  apiKey: string;
  fileId?: string | null;
  containerId?: string | null;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts: Array<Promise<boolean>> = [];
  if (input.fileId) attempts.push(deleteResource(fetchImpl, input.apiKey, `/files/${input.fileId}`));
  if (input.containerId) {
    attempts.push(deleteResource(fetchImpl, input.apiKey, `/containers/${input.containerId}`));
  }
  const results = await Promise.all(attempts);
  return { attempted: attempts.length, allDeleted: results.every(Boolean) };
}

export async function startOpenAiTiffBackground(input: {
  fetchImpl?: typeof fetch;
  apiKey: string;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  model: string;
  systemPrompt: string;
  mode?: OpenAiTiffBackgroundMode;
}): Promise<OpenAiTiffBackgroundJob> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("expires_after[anchor]", "created_at");
  form.append("expires_after[seconds]", String(FILE_EXPIRY_SECONDS));
  form.append(
    "file",
    new Blob([input.bytes as unknown as BlobPart], { type: input.mimeType }),
    input.fileName,
  );

  const upload = await fetchImpl(`${OPENAI_API_BASE}/files`, {
    method: "POST",
    headers: authHeaders(input.apiKey),
    body: form,
  }).catch(() => null);
  const uploadPayload = upload
    ? ((await upload.json().catch(() => null)) as { id?: unknown } | null)
    : null;
  const fileId = typeof uploadPayload?.id === "string" ? uploadPayload.id : null;
  if (!upload?.ok || !fileId) throw new OpenAiTiffBackgroundError("upload", upload?.status ?? null);

  const mode = input.mode ?? "deep_review";
  const response = await fetchImpl(`${OPENAI_API_BASE}/responses`, {
    method: "POST",
    headers: { ...authHeaders(input.apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      background: true,
      store: true,
      include: [CODE_INTERPRETER_OUTPUT_INCLUDE],
      // The fast job creates bounded images only. The deep fallback keeps the
      // larger budget needed for full Code Interpreter document review.
      max_output_tokens:
        mode === "fast_preprocess"
          ? TIFF_FAST_PREPROCESS_MAX_OUTPUT_TOKENS
          : TIFF_DEEP_BACKGROUND_MAX_OUTPUT_TOKENS,
      reasoning: {
        effort:
          mode === "fast_preprocess"
            ? TIFF_FAST_PREPROCESS_REASONING_EFFORT
            : TIFF_DEEP_BACKGROUND_REASONING_EFFORT,
      },
      instructions: mode === "fast_preprocess" ? undefined : input.systemPrompt,
      input: codeInterpreterTiffInstructions(mode),
      tools: [
        {
          type: "code_interpreter",
          container: { type: "auto", file_ids: [fileId] },
        },
      ],
      ...(mode === "deep_review" ? { text: { format: erfExtractionResponsesTextFormat() } } : {}),
    }),
  }).catch(() => null);
  const payload = response
    ? ((await response.json().catch(() => null)) as OpenAiResponsePayload | null)
    : null;
  const id = responseId(payload);
  if (!response?.ok || !id) {
    await cleanupOpenAiTiffResources({ fetchImpl, apiKey: input.apiKey, fileId });
    throw new OpenAiTiffBackgroundError("start", response?.status ?? null);
  }

  return { responseId: id, fileId, containerId: responseContainerId(payload) };
}

async function retrieveOpenAiResponse(input: {
  fetchImpl: typeof fetch;
  apiKey: string;
  responseId: string;
  includeCodeInterpreterOutputs?: boolean;
}) {
  const url = new URL(`${OPENAI_API_BASE}/responses/${input.responseId}`);
  if (input.includeCodeInterpreterOutputs) {
    url.searchParams.append("include[]", CODE_INTERPRETER_OUTPUT_INCLUDE);
  }
  const response = await input.fetchImpl(url, {
    headers: authHeaders(input.apiKey),
  }).catch(() => null);
  const payload = response
    ? ((await response.json().catch(() => null)) as OpenAiResponsePayload | null)
    : null;
  if (!response?.ok || !payload) {
    throw new OpenAiTiffBackgroundError("retrieve", response?.status ?? null);
  }
  return { response, payload };
}

export async function pollOpenAiTiffBackground(input: {
  fetchImpl?: typeof fetch;
  apiKey: string;
  responseId: string;
  fileId?: string | null;
  containerId?: string | null;
}): Promise<OpenAiTiffPollResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let { response, payload } = await retrieveOpenAiResponse({
    fetchImpl,
    apiKey: input.apiKey,
    responseId: input.responseId,
  });

  let status = responseStatus(payload);
  if (status === "completed" && responseImageOutputUrls(payload).length === 0) {
    ({ response, payload } = await retrieveOpenAiResponse({
      fetchImpl,
      apiKey: input.apiKey,
      responseId: input.responseId,
      includeCodeInterpreterOutputs: true,
    }));
    status = responseStatus(payload);
  }

  const resources = {
    fileId: input.fileId ?? null,
    containerId: responseContainerId(payload) ?? input.containerId ?? null,
  };
  if (status === "queued" || status === "in_progress") {
    return { state: "processing", status, ...resources };
  }
  if (status === "failed" || status === "cancelled" || status === "incomplete") {
    return { state: "failed", status, ...resources };
  }
  if (status !== "completed") throw new OpenAiTiffBackgroundError("retrieve", response.status);

  const raw = responseOutputText(payload);
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  return {
    state: "completed",
    parsed,
    previewUrls: responseImageOutputUrls(payload),
    ...resources,
  };
}
