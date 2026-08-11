import { erfExtractionResponsesTextFormat } from "../_shared/erfExtractionContract.ts";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const FILE_EXPIRY_SECONDS = 60 * 60;
const TIFF_BACKGROUND_MAX_OUTPUT_TOKENS = 24_000;
const TIFF_BACKGROUND_REASONING_EFFORT = "high";

export const OPENAI_TIFF_EXTRACTION_PROVIDER = "openai_code_interpreter" as const;

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
  | ({ state: "completed"; parsed: unknown } & OpenAiTiffResources)
  | ({ state: "failed"; status: "failed" | "cancelled" | "incomplete" } & OpenAiTiffResources);

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

export function codeInterpreterTiffInstructions() {
  return [
    "Review the attached Surveyor-General TIFF using Code Interpreter and return only the required structured extraction result.",
    "The file may be a 70M+ pixel bilevel survey TIFF.",
    "NEVER render or copy the entire full-resolution TIFF into one large image or matrix.",
    "Use memory-safe strip, tile, downscale and crop processing.",
    "Create a low-resolution overview, then inspect bounded native-resolution crops for small printed labels.",
    "Search the full sheet for the requested erf number.",
    "Distinguish the subject erf from its parent General Plan and neighbouring erven.",
    "Dossier identifiers are comparison context only. Never infer that the target erf is present.",
    "Report only facts visibly supported by the TIFF and explicitly preserve uncertainty.",
    "OCR alone is not identity proof. Every accepted claim needs a supporting quote or visible evidence string and provenance.",
  ].join("\n");
}

async function deleteResource(
  fetchImpl: typeof fetch,
  apiKey: string,
  path: string,
) {
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

  const response = await fetchImpl(`${OPENAI_API_BASE}/responses`, {
    method: "POST",
    headers: { ...authHeaders(input.apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      background: true,
      store: true,
      // Reasoning and visible output share this budget. Dense SG TIFF review needs
      // enough headroom for safe Code Interpreter inspection before JSON output.
      max_output_tokens: TIFF_BACKGROUND_MAX_OUTPUT_TOKENS,
      reasoning: { effort: TIFF_BACKGROUND_REASONING_EFFORT },
      instructions: input.systemPrompt,
      input: codeInterpreterTiffInstructions(),
      tools: [
        {
          type: "code_interpreter",
          container: { type: "auto", file_ids: [fileId] },
        },
      ],
      text: { format: erfExtractionResponsesTextFormat() },
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

export async function pollOpenAiTiffBackground(input: {
  fetchImpl?: typeof fetch;
  apiKey: string;
  responseId: string;
  fileId?: string | null;
  containerId?: string | null;
}): Promise<OpenAiTiffPollResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${OPENAI_API_BASE}/responses/${input.responseId}`, {
    headers: authHeaders(input.apiKey),
  }).catch(() => null);
  const payload = response
    ? ((await response.json().catch(() => null)) as OpenAiResponsePayload | null)
    : null;
  if (!response?.ok || !payload) {
    throw new OpenAiTiffBackgroundError("retrieve", response?.status ?? null);
  }

  const resources = {
    fileId: input.fileId ?? null,
    containerId: responseContainerId(payload) ?? input.containerId ?? null,
  };
  const status = responseStatus(payload);
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
  return { state: "completed", parsed, ...resources };
}
