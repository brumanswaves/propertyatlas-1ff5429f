/**
 * Behavioural tests for the deployed `extract-erf-asset` handler.
 *
 * The Deno entry point is loaded with a stubbed `Deno` global so the exact
 * request handler that runs in production is exercised here: parcel binding,
 * the atomic processing lock, idempotency and the request-size cap must all be
 * enforced *before* any file download or OpenAI call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERF_EXTRACTION_VERSION } from "../../../../supabase/functions/_shared/erfExtractionContract";

const OPENAI_HOST = "api.openai.com";

type Handler = (request: Request) => Promise<Response>;

let handler: Handler;
let assetRow: Record<string, unknown>;
let openAiCalls = 0;
let openAiRequests: Array<Record<string, unknown>>;
let openAiUrls: string[];
let openAiUploads: FormData[];
let openAiDeletes: string[];
let backgroundStartStatus = 200;
let backgroundPollStatus = 200;
let backgroundPollPayload: Record<string, unknown>;
let cleanupStatus = 200;
let downloadCalls = 0;
let patchCalls: Array<{ url: string; body: Record<string, unknown> }>;
let patchOk = true;
let relatedAssetRows: Record<string, unknown>[];
let previewUploadCalls = 0;
let previewUploadStatus = 200;
let previewUrl = "https://temporary-preview.test/sg-overview.png";
let fastPreviewUrls: string[];
let previewBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
let previewContentType = "image/png";
let previewFetches: Array<{ url: string; authorization: string | null }>;

const ASSET_ID = "6a8a1f2c-0000-4000-8000-000000000000";
const PARCEL_ID = "csg:lpi:C03400140000157000000";

function baseAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    user_id: "user-1",
    parcel_id: PARCEL_ID,
    asset_category: "paid_report",
    storage_bucket: "erf-files",
    storage_path: "erf-files/1570/report.pdf",
    original_file_name: "report.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    metadata: {},
    updated_at: "2026-07-25T10:00:00Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function sgExtractionResult(overrides: Record<string, unknown> = {}) {
  return {
    identity: {
      erfNumber: "1570",
      portionNumber: "0",
      lpiCode: "C03400140000157000000",
      sgCode: "GP12252",
      streetAddress: null,
      suburbOrTown: "St Francis Bay",
      municipality: "Kouga Local Municipality",
      province: "Eastern Cape",
    },
    documentType: "General Plan",
    provider: "Chief Surveyor-General",
    documentDate: null,
    pageCount: 1,
    summary: "General Plan showing Erf 1570.",
    extractedText: "GENERAL PLAN GP12252. Erf 1570. Padrone Crescent.",
    warning: null,
    claims: [
      {
        domain: "identity",
        key: "erfNumber",
        label: "Erf number",
        value: "1570",
        numericValue: 1570,
        unit: null,
        page: 1,
        quote: "Erf 1570",
        confidence: "high",
        interpretation: false,
      },
    ],
    ...overrides,
  };
}

function completedBackgroundPayload(result: unknown = sgExtractionResult(), imageUrl = previewUrl) {
  return {
    id: "resp-sg-test",
    status: "completed",
    output: [
      {
        type: "code_interpreter_call",
        container_id: "cntr-sg-test",
        status: "completed",
        outputs: [{ type: "image", url: imageUrl }],
      },
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(result) }],
      },
    ],
  };
}

function completedFastPreprocessPayload(imageUrls = fastPreviewUrls) {
  return {
    id: "resp-sg-test",
    status: "completed",
    output: [
      {
        type: "code_interpreter_call",
        container_id: "cntr-sg-test",
        status: "completed",
        outputs: imageUrls.map((url) => ({ type: "image", url })),
      },
    ],
  };
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.includes("/auth/v1/user")) return Promise.resolve(jsonResponse({ id: "user-1" }));
  if (url.includes("/rest/v1/erf_assets") && method === "GET") {
    const rows = url.includes("select=id,source_label") ? [assetRow, ...relatedAssetRows] : [assetRow];
    return Promise.resolve(jsonResponse(rows));
  }
  if (url.includes("/rest/v1/erf_assets") && method === "PATCH") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    patchCalls.push({ url, body });
    if (!patchOk) return Promise.resolve(new Response("nope", { status: 500 }));
    // Emulate the compare-and-swap: the filtered PATCH only matches while
    // updated_at still equals the value the caller read.
    const filterMatch = /updated_at=eq\.([^&]+)/.exec(url);
    if (filterMatch && decodeURIComponent(filterMatch[1]) !== assetRow.updated_at) {
      return Promise.resolve(jsonResponse([]));
    }
    assetRow = { ...assetRow, metadata: body.metadata, updated_at: body.updated_at };
    return Promise.resolve(jsonResponse([assetRow]));
  }
  if (url.includes("/rest/v1/saved_properties")) {
    return Promise.resolve(
      jsonResponse([
        {
          user_data: {
            parcel: {
              erfNumber: "1570",
              portion: "0",
              municipality: "Kouga Local Municipality",
              province: "Eastern Cape",
              town: "St Francis Bay",
              streetAddress: "8 Harbour Road, St Francis Bay",
            },
          },
        },
      ]),
    );
  }
  if (url === previewUrl || fastPreviewUrls.includes(url)) {
    previewFetches.push({
      url,
      authorization: new Headers(init?.headers ?? {}).get("Authorization"),
    });
    return Promise.resolve(
      new Response(previewBytes, {
        status: 200,
        headers: previewContentType ? { "Content-Type": previewContentType } : undefined,
      }),
    );
  }
  if (url.includes("/storage/v1/object/") && method === "POST") {
    previewUploadCalls += 1;
    return Promise.resolve(jsonResponse({ Key: "derived/sg-overview.png" }, previewUploadStatus));
  }
  if (url.includes("/storage/v1/object/") && method === "GET") {
    downloadCalls += 1;
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
  }
  if (url.endsWith("/v1/files") && method === "POST") {
    openAiCalls += 1;
    openAiUrls.push(url);
    openAiUploads.push(init?.body as FormData);
    return Promise.resolve(jsonResponse({ id: "file-sg-test", purpose: "user_data" }));
  }
  if (url.endsWith("/v1/responses") && method === "POST") {
    openAiCalls += 1;
    openAiUrls.push(url);
    openAiRequests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return Promise.resolve(
      jsonResponse({ id: "resp-sg-test", status: "queued", output: [] }, backgroundStartStatus),
    );
  }
  if (url.includes("/v1/responses/") && method === "GET") {
    openAiCalls += 1;
    openAiUrls.push(url);
    return Promise.resolve(jsonResponse(backgroundPollPayload, backgroundPollStatus));
  }
  if (
    (url.includes("/v1/files/") || url.includes("/v1/containers/")) &&
    method === "DELETE"
  ) {
    openAiDeletes.push(url);
    return Promise.resolve(jsonResponse({ deleted: cleanupStatus < 400 }, cleanupStatus));
  }
  if (url.includes(OPENAI_HOST)) {
    openAiCalls += 1;
    openAiUrls.push(url);
    openAiRequests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return Promise.resolve(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                identity: {
                  erfNumber: "1570",
                  lpiCode: "C03400140000157000000",
                  suburbOrTown: "St Francis Bay",
                },
                documentType: "Lightstone report",
                provider: "Lightstone",
                documentDate: null,
                pageCount: 3,
                summary: null,
                extractedText: "Erf 1570 St Francis Bay",
                warning: null,
                claims: [],
              }),
            },
          },
        ],
      }),
    );
  }
  return Promise.resolve(new Response("not found", { status: 404 }));
}

beforeEach(async () => {
  assetRow = baseAsset();
  openAiCalls = 0;
  openAiRequests = [];
  openAiUrls = [];
  openAiUploads = [];
  openAiDeletes = [];
  backgroundStartStatus = 200;
  backgroundPollStatus = 200;
  backgroundPollPayload = { id: "resp-sg-test", status: "in_progress", output: [] };
  cleanupStatus = 200;
  downloadCalls = 0;
  patchCalls = [];
  patchOk = true;
  relatedAssetRows = [];
  previewUploadCalls = 0;
  previewUploadStatus = 200;
  previewUrl = "https://temporary-preview.test/sg-overview.png";
  fastPreviewUrls = [
    "https://temporary-preview.test/sg-overview.png",
    "https://temporary-preview.test/sg-top-left.png",
    "https://temporary-preview.test/sg-top-right.png",
    "https://temporary-preview.test/sg-bottom-left.png",
    "https://temporary-preview.test/sg-bottom-right.png",
  ];
  previewBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  previewContentType = "image/png";
  previewFetches = [];
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        ({
          SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-key",
          SUPABASE_ANON_KEY: "anon-key",
          OPENAI_API_KEY: "openai-key",
          ERF_SG_TIFF_MODEL: "gpt-5.2",
        })[key],
    },
    serve: (fn: Handler) => {
      handler = fn;
    },
  });
  vi.resetModules();
  await import("../../../../supabase/functions/extract-erf-asset/index.ts");
});

function call(body: unknown, token = "user-token") {
  return handler(
    new Request("https://fn.test/extract-erf-asset", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("extract-erf-asset request binding", () => {
  it("requires expectedParcelId", async () => {
    const response = await call({ assetId: ASSET_ID });
    expect(response.status).toBe(400);
    expect(downloadCalls).toBe(0);
    expect(openAiCalls).toBe(0);
  });

  it("never downloads or calls OpenAI when expectedParcelId is wrong", async () => {
    const response = await call({ assetId: ASSET_ID, expectedParcelId: "csg:lpi:OTHER" });
    const payload = (await response.json()) as { code: string };
    expect(response.status).toBe(409);
    expect(payload.code).toBe("PARCEL_MISMATCH");
    expect(downloadCalls).toBe(0);
    expect(openAiCalls).toBe(0);
  });

  it("rejects an oversized request body before parsing", async () => {
    const response = await handler(
      new Request("https://fn.test/extract-erf-asset", {
        method: "POST",
        headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID, pad: "x".repeat(9000) }),
      }),
    );
    expect(response.status).toBe(413);
    expect(openAiCalls).toBe(0);
  });

  it("refuses a paid report that is not a PDF without calling OpenAI", async () => {
    assetRow = baseAsset({ mime_type: "image/png" });
    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as { code: string; extractionStatus: string };
    expect(payload.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(payload.extractionStatus).toBe("unsupported");
    expect(openAiCalls).toBe(0);
  });
});

describe("extract-erf-asset TIFF background review", () => {
  function useTiffAsset(metadata: Record<string, unknown> = {}) {
    assetRow = baseAsset({
      asset_category: "sg_diagram",
      storage_path: "erf-files/1570/11032680-test-fixture.tif",
      original_file_name: "11032680 TEST FIXTURE.tif",
      mime_type: "image/tiff",
      size_bytes: 742_000,
      metadata,
    });
  }

  function useRunningTiffAsset() {
    useTiffAsset({
      extractionStatus: "processing",
      extractionStartedAt: new Date().toISOString(),
      extractionProvider: "openai_code_interpreter",
      extractionModel: "gpt-5.2",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
      openaiBackgroundStartedAt: new Date().toISOString(),
    });
  }

  it("keeps PDF extraction on the existing synchronous Chat Completions path", async () => {
    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });

    expect(openAiUrls).toEqual(["https://api.openai.com/v1/chat/completions"]);
    expect(openAiUploads).toHaveLength(0);
    expect(openAiRequests[0]).toHaveProperty("messages");
    expect(openAiRequests[0]).not.toHaveProperty("background");
  });

  it("starts a private, expiring fast TIFF preprocessing job and returns processing", async () => {
    useTiffAsset();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const form = openAiUploads[0];
    const request = openAiRequests[0];
    const requestText = JSON.stringify(request);

    expect(payload).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(payload.warning).toContain("several minutes");
    expect(JSON.stringify(payload)).not.toContain("openai-key");
    expect(JSON.stringify(payload)).not.toContain("service-key");
    expect(form.get("purpose")).toBe("user_data");
    expect(form.get("expires_after[anchor]")).toBe("created_at");
    expect(form.get("expires_after[seconds]")).toBe("3600");
    expect((form.get("file") as File).name).toBe("11032680 TEST FIXTURE.tif");
    expect(request).toMatchObject({
      model: "gpt-5.2",
      background: true,
      max_output_tokens: 4_000,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "code_interpreter",
          container: { type: "auto", file_ids: ["file-sg-test"] },
        },
      ],
    });
    expect(request).not.toHaveProperty("text");
    expect(requestText).not.toContain("input_file");
    expect(requestText).toContain("conversion only");
    expect(requestText).toContain("exactly five PNG images");
    expect(requestText).toContain("top-left, top-right, bottom-left, and bottom-right");
    expect(requestText).not.toContain("Erf 1570");
    expect(requestText).not.toContain("LPI C03400140000157000000");
    expect(requestText).not.toContain("user-1");
    expect(requestText).not.toContain("email");
    expect(requestText).not.toContain("private notes");

    const metadata = assetRow.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({
      extractionStatus: "processing",
      extractionProvider: "openai_sg_tiff_fast_preprocess",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
    });
    expect(JSON.stringify(metadata)).not.toContain("data:image/tiff");
    expect(JSON.stringify(metadata)).not.toContain("openai-key");
  });

  it("polls a running TIFF job without downloading or restarting it", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = { id: "resp-sg-test", status: "in_progress", output: [] };

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(downloadCalls).toBe(0);
    expect(openAiUrls).toEqual(["https://api.openai.com/v1/responses/resp-sg-test"]);
    expect(openAiUploads).toHaveLength(0);
  });

  it("sends exactly five ordered preprocessed images through the normal extraction contract", async () => {
    useTiffAsset({
      extractionStatus: "processing",
      extractionStartedAt: new Date().toISOString(),
      extractionProvider: "openai_sg_tiff_fast_preprocess",
      extractionModel: "gpt-5.2",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
      openaiBackgroundStartedAt: new Date().toISOString(),
    });
    backgroundPollPayload = completedFastPreprocessPayload();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const visionRequest = openAiRequests.find((request) => Array.isArray(request.messages));
    const content = ((visionRequest?.messages as Array<Record<string, unknown>>)[1]?.content ?? []) as Array<Record<string, unknown>>;

    expect(payload).toMatchObject({ success: true, identityMatchStatus: "matched" });
    expect(previewFetches).toHaveLength(5);
    expect(previewFetches.map((entry) => entry.url)).toEqual(fastPreviewUrls);
    expect(content.filter((block) => block.type === "image_url")).toHaveLength(5);
    expect(content[1]).toMatchObject({ type: "text", text: "Page 1:" });
    expect(content[3]).toMatchObject({ type: "text", text: expect.stringContaining("top left quadrant") });
    expect(assetRow.metadata).toMatchObject({
      sgPreviewStoragePath: "erf-files/1570/derived/sg-overview.png",
      normalizedExtractionMimeType: "image/png",
      openaiResponseId: null,
    });
    expect(JSON.stringify(assetRow.metadata)).not.toContain("temporary-preview.test");
  });

  it("uses the deep Code Interpreter review only when the fast preprocessor has unusable images", async () => {
    useTiffAsset({
      extractionStatus: "processing",
      extractionStartedAt: new Date().toISOString(),
      extractionProvider: "openai_sg_tiff_fast_preprocess",
      extractionModel: "gpt-5.2",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
      openaiBackgroundStartedAt: new Date().toISOString(),
    });
    backgroundPollPayload = completedFastPreprocessPayload(fastPreviewUrls.slice(0, 4));

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const deepRequest = openAiRequests.at(-1);

    expect(payload).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(deepRequest).toMatchObject({
      background: true,
      max_output_tokens: 24_000,
      reasoning: { effort: "high" },
      text: { format: { type: "json_schema", name: "erf_document_extraction" } },
    });
    expect(assetRow.metadata).toMatchObject({ extractionProvider: "openai_code_interpreter" });
  });

  it("falls back to deep review when the fast preprocessing response fails", async () => {
    useTiffAsset({
      extractionStatus: "processing",
      extractionStartedAt: new Date().toISOString(),
      extractionProvider: "openai_sg_tiff_fast_preprocess",
      extractionModel: "gpt-5.2",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
      openaiBackgroundStartedAt: new Date().toISOString(),
    });
    backgroundPollPayload = { id: "resp-sg-test", status: "failed", output: [] };

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(assetRow.metadata).toMatchObject({ extractionProvider: "openai_code_interpreter" });
    expect(openAiRequests.at(-1)).toMatchObject({ max_output_tokens: 24_000 });
  });

  it.each([404, 410])(
    "recovers an expired TIFF response (%s) into a retryable failed asset",
    async (status) => {
      useRunningTiffAsset();
      backgroundPollStatus = status;

      const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
      const payload = (await response.json()) as Record<string, unknown>;
      const metadata = assetRow.metadata as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        success: false,
        extractionStatus: "failed",
        error: "The previous survey-plan review expired. Try reading the diagram again.",
      });
      expect(metadata).toMatchObject({
        extractionStatus: "failed",
        extractionProvider: null,
        openaiResponseId: null,
        openaiFileId: null,
        openaiContainerId: null,
        openaiBackgroundStartedAt: null,
      });
      expect(openAiDeletes).toEqual(
        expect.arrayContaining([
          "https://api.openai.com/v1/files/file-sg-test",
        ]),
      );
    },
  );

  it("keeps TIFF job metadata for a transient background retrieve failure", async () => {
    useRunningTiffAsset();
    backgroundPollStatus = 503;

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const metadata = assetRow.metadata as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ success: false, code: "SERVER_UNAVAILABLE" });
    expect(String(payload.error)).toContain("The survey plan review could not be checked yet.");
    expect(metadata).toMatchObject({
      extractionStatus: "processing",
      extractionProvider: "openai_code_interpreter",
      openaiResponseId: "resp-sg-test",
      openaiFileId: "file-sg-test",
    });
    expect(openAiDeletes).toHaveLength(0);
  });

  it("can start a fresh TIFF review after recovering an expired response", async () => {
    useRunningTiffAsset();
    backgroundPollStatus = 404;

    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    backgroundPollStatus = 200;

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "processing" });
    expect(openAiUrls).toEqual(
      expect.arrayContaining([
        "https://api.openai.com/v1/files",
        "https://api.openai.com/v1/responses",
      ]),
    );
    expect((assetRow.metadata as Record<string, unknown>).openaiResponseId).toBe("resp-sg-test");
  });

  it("normalizes a completed TIFF result through the canonical identity and claim gates", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = completedBackgroundPayload();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const metadata = assetRow.metadata as Record<string, unknown>;

    expect(payload).toMatchObject({
      success: true,
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      claimCount: 1,
    });
    expect(metadata.identityMatchStatus).toBe("matched");
    expect(metadata.extractedClaims).toHaveLength(1);
    expect(metadata.openaiResponseId).toBeNull();
    expect(metadata.openaiFileId).toBeNull();
    expect(openAiDeletes).toEqual(
      expect.arrayContaining([
        "https://api.openai.com/v1/files/file-sg-test",
        "https://api.openai.com/v1/containers/cntr-sg-test",
      ]),
    );
  });

  it("stores the temporary Code Interpreter image as a private derived preview", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = completedBackgroundPayload();

    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });

    expect(previewUploadCalls).toBe(1);
    expect(assetRow.metadata).toMatchObject({
      sgPreviewStoragePath: "erf-files/1570/derived/sg-overview.png",
      sgPreviewMimeType: "image/png",
    });
    expect((assetRow.metadata as Record<string, unknown>).sgPreviewGeneratedAt).toEqual(expect.any(String));
    expect(previewFetches).toEqual([
      { url: "https://temporary-preview.test/sg-overview.png", authorization: null },
    ]);
    expect(JSON.stringify(assetRow.metadata)).not.toContain("temporary-preview.test");
  });

  it("authenticates a temporary preview only when it is hosted by the OpenAI API", async () => {
    useRunningTiffAsset();
    previewUrl = "https://api.openai.com/v1/files/preview-sg/content";
    backgroundPollPayload = completedBackgroundPayload();

    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });

    expect(previewFetches).toEqual([
      { url: "https://api.openai.com/v1/files/preview-sg/content", authorization: "Bearer openai-key" },
    ]);
    expect(JSON.stringify(assetRow.metadata)).not.toContain("preview-sg");
  });

  it("sniffs a PNG overview when the temporary response has a generic MIME header", async () => {
    useRunningTiffAsset();
    previewContentType = "application/octet-stream";
    backgroundPollPayload = completedBackgroundPayload();

    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });

    expect(previewUploadCalls).toBe(1);
    expect(assetRow.metadata).toMatchObject({ sgPreviewMimeType: "image/png" });
  });

  it("rejects invalid preview bytes without failing the completed TIFF extraction", async () => {
    useRunningTiffAsset();
    previewContentType = "application/octet-stream";
    previewBytes = new Uint8Array([1, 2, 3, 4]);
    backgroundPollPayload = completedBackgroundPayload();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "ready" });
    expect(previewUploadCalls).toBe(0);
    expect(assetRow.metadata).not.toMatchObject({ sgPreviewStoragePath: expect.anything() });
  });

  it("keeps the five-megabyte preview limit non-fatal", async () => {
    useRunningTiffAsset();
    previewBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    backgroundPollPayload = completedBackgroundPayload();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "ready" });
    expect(previewUploadCalls).toBe(0);
    expect(assetRow.metadata).not.toMatchObject({ sgPreviewStoragePath: expect.anything() });
  });

  it("does not fail a completed TIFF extraction when preview storage fails", async () => {
    useRunningTiffAsset();
    previewUploadStatus = 500;
    backgroundPollPayload = completedBackgroundPayload();

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "ready" });
    expect(previewUploadCalls).toBe(1);
    expect(assetRow.metadata).not.toMatchObject({ sgPreviewStoragePath: expect.anything() });
  });

  it("keeps a General Plan with the target erf visible confirmable and filters its claims safely", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = completedBackgroundPayload(
      sgExtractionResult({
        identity: {
          erfNumber: "1496",
          portionNumber: "PTN OF 1496-GP12252",
          lpiCode: null,
          sgCode: "GP12252",
          streetAddress: null,
          suburbOrTown: "SEA VISTA",
          municipality: "Humansdorp",
          province: "Province of the Cape of Good Hope",
        },
        extractedText:
          "GENERAL PLAN No. 12252. SUBDIVISIONS OF ERF 1496 SEA VISTA. Province of the Cape of Good Hope. Erf 1570. Padrone Crescent. Erf 1569.",
        claims: [
          {
            domain: "identity",
            key: "erfNumber",
            label: "Erf number",
            value: "1570",
            numericValue: null,
            unit: null,
            page: 1,
            quote: "Erf 1570",
            confidence: "high",
            interpretation: false,
          },
          {
            domain: "documents",
            key: "boundaryNotes",
            label: "Plan-wide annotation",
            value: "50%",
            numericValue: 50,
            unit: "%",
            page: 1,
            quote: "Boundary note: Padrone Crescent",
            confidence: "high",
            interpretation: false,
          },
        ],
      }),
    );

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const metadata = assetRow.metadata as Record<string, unknown>;
    const claims = metadata.extractedClaims as Array<Record<string, unknown>>;

    expect(payload).toMatchObject({
      success: true,
      code: "IDENTITY_UNVERIFIED",
      identityMatchStatus: "unverified",
      readable: true,
    });
    expect(metadata.extractionStatus).toBe("partial");
    expect(metadata.identityMatchReason).toContain("supports this investigation");
    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: "identity", key: "erfNumber", scope: "subject" }),
        expect.objectContaining({ domain: "documents", key: "boundaryNotes", scope: "parent_plan" }),
      ]),
    );
    expect(claims).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ domain: "documents", key: "boundaryNotes", scope: "subject" })]),
    );
  });

  it("uses user-confirmed paid-report lineage as supporting provenance for a parent General Plan", async () => {
    useRunningTiffAsset();
    relatedAssetRows = [
      baseAsset({
        id: "asset-paid-lineage",
        source_label: "Confirmed title report",
        metadata: {
          extractionStatus: "partial",
          identityMatchStatus: "unverified",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: PARCEL_ID,
          documentLineage: { parentErfNumber: "1496", generalPlanReference: "GP12252" },
        },
      }),
    ];
    backgroundPollPayload = completedBackgroundPayload(
      sgExtractionResult({
        identity: {
          erfNumber: "1496",
          portionNumber: "PTN OF 1496-GP12252",
          lpiCode: null,
          sgCode: "GP12252",
          streetAddress: null,
          suburbOrTown: "SEA VISTA",
          municipality: "Humansdorp",
          province: "Eastern Cape",
        },
        extractedText: "GENERAL PLAN No. 12252 of SUBDIVISIONS OF ERF 1496 SEA VISTA.",
      }),
    );

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const metadata = assetRow.metadata as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, identityMatchStatus: "parent_lineage_match" });
    expect(metadata.identityMatchReason).toContain("Confirmed title report");
  });

  it("does not use stale user-confirmed mismatch metadata as parent-plan lineage", async () => {
    useRunningTiffAsset();
    relatedAssetRows = [
      baseAsset({
        id: "asset-stale-mismatch-lineage",
        source_label: "Wrong property report",
        metadata: {
          extractionStatus: "partial",
          identityMatchStatus: "mismatch",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: PARCEL_ID,
          documentLineage: { parentErfNumber: "1496", generalPlanReference: "GP12252" },
        },
      }),
    ];
    backgroundPollPayload = completedBackgroundPayload(
      sgExtractionResult({
        identity: {
          erfNumber: "1496",
          portionNumber: "PTN OF 1496-GP12252",
          lpiCode: null,
          sgCode: "GP12252",
          streetAddress: null,
          suburbOrTown: "SEA VISTA",
          municipality: "Humansdorp",
          province: "Eastern Cape",
        },
        extractedText: "GENERAL PLAN No. 12252 of SUBDIVISIONS OF ERF 1496 SEA VISTA.",
      }),
    );

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;
    const metadata = assetRow.metadata as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, identityMatchStatus: "mismatch" });
    expect(metadata.identityMatchReason).not.toContain("Wrong property report");
  });

  it("rejects free-form background prose and cleans up instead of bypassing the contract", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = completedBackgroundPayload();
    const output = backgroundPollPayload.output as Array<Record<string, unknown>>;
    output[1] = { type: "message", content: [{ type: "output_text", text: "free-form proof" }] };

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({
      success: false,
      code: "MALFORMED_MODEL_RESPONSE",
      extractionStatus: "failed",
    });
    expect(openAiDeletes).toHaveLength(2);
  });

  it("attempts file cleanup when the background request cannot start", async () => {
    useTiffAsset();
    backgroundStartStatus = 500;

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: false, extractionStatus: "failed" });
    expect(openAiDeletes).toContain("https://api.openai.com/v1/files/file-sg-test");
  });

  it("keeps a good canonical result when temporary resource cleanup fails", async () => {
    useRunningTiffAsset();
    backgroundPollPayload = completedBackgroundPayload();
    cleanupStatus = 500;

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({ success: true, extractionStatus: "ready" });
    expect(assetRow.metadata).toMatchObject({
      extractionStatus: "ready",
      openaiResponseId: null,
      openaiFileId: null,
    });
    expect(openAiDeletes).toHaveLength(2);
  });
});

describe("extract-erf-asset concurrency and idempotency", () => {
  it("only lets one of two concurrent requests reach OpenAI", async () => {
    const [a, b] = await Promise.all([
      call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID }),
      call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID }),
    ]);
    const codes = await Promise.all([a.json(), b.json()]).then((items) =>
      (items as Array<{ code?: string }>).map((item) => item.code ?? "ok"),
    );
    expect(openAiCalls).toBe(1);
    expect(codes).toContain("ALREADY_PROCESSING");
  });

  it("returns 409 while a fresh processing lock is held", async () => {
    assetRow = baseAsset({
      metadata: { extractionStatus: "processing", extractionStartedAt: new Date().toISOString() },
    });
    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    expect(response.status).toBe(409);
    expect(openAiCalls).toBe(0);
  });

  it("recovers from a stale processing lock", async () => {
    assetRow = baseAsset({
      metadata: {
        extractionStatus: "processing",
        extractionStartedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
    });
    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    expect(openAiCalls).toBe(1);
  });

  it("does not reprocess a current matched ready asset", async () => {
    assetRow = baseAsset({
      metadata: {
        extractionStatus: "ready",
        identityMatchStatus: "matched",
        extractionVersion: ERF_EXTRACTION_VERSION,
        extractedClaims: [{ key: "registeredOwner" }],
      },
    });
    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as { reused: boolean; claimCount: number };
    expect(payload.reused).toBe(true);
    expect(payload.claimCount).toBe(1);
    expect(openAiCalls).toBe(0);
  });

  it("ignores a browser retry flag on a current matched ready asset", async () => {
    assetRow = baseAsset({
      metadata: { extractionStatus: "ready", identityMatchStatus: "matched", extractionVersion: ERF_EXTRACTION_VERSION },
    });
    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID, retry: true });
    expect(openAiCalls).toBe(0);
  });

  it("surfaces a failed metadata write instead of pretending success", async () => {
    assetRow = baseAsset({ mime_type: "application/vnd.ms-excel" });
    patchOk = false;
    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as { code: string };
    expect(response.status).toBe(503);
    expect(payload.code).toBe("SERVER_UNAVAILABLE");
  });
});

describe("extract-erf-asset identity gate", () => {
  it("uses upload-bound parcel context before an Erf File bookmark exists", async () => {
    assetRow = baseAsset({
      metadata: {
        expectedIdentityContext: {
          parcelId: PARCEL_ID,
          lpiCode: "C03400140000157000000",
          erfNumber: "1570",
          portionNumber: "0",
          municipality: "Kouga Local Municipality",
          province: "Eastern Cape",
          town: "St Francis Bay",
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/rest/v1/saved_properties")) {
          return Promise.resolve(jsonResponse([]));
        }
        return fakeFetch(input, init);
      }),
    );

    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const written = patchCalls.at(-1)!.body.metadata as Record<string, unknown>;
    expect(written.identityMatchStatus).toBe("matched");
    expect(openAiCalls).toBe(1);
  });

  it("preserves readable extraction when identity needs confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes(OPENAI_HOST)) {
          openAiCalls += 1;
          openAiRequests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      identity: { erfNumber: "1570" },
                      documentType: "Property report",
                      provider: "Independent provider",
                      documentDate: null,
                      pageCount: 2,
                      summary: "Readable report for Erf 1570; location not printed.",
                      extractedText: "Erf 1570. Municipal valuation R1 200 000.",
                      warning: null,
                      claims: [
                        {
                          domain: "valuation",
                          key: "municipalValue",
                          label: "Municipal valuation",
                          value: "R1 200 000",
                          numericValue: 1200000,
                          unit: "ZAR",
                          page: 1,
                          quote: "Municipal valuation R1 200 000",
                          confidence: "high",
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
          );
        }
        return fakeFetch(input, init);
      }),
    );

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as {
      code: string;
      identityMatchStatus: string;
      readable: boolean;
    };
    expect(payload).toMatchObject({
      code: "IDENTITY_UNVERIFIED",
      identityMatchStatus: "unverified",
      readable: true,
    });
    const written = patchCalls.at(-1)!.body.metadata as Record<string, unknown>;
    expect(written.extractionStatus).toBe("partial");
    expect(written.extractedText).toContain("Municipal valuation");
    expect(written.extractedClaims).toHaveLength(1);

    const messages = openAiRequests.at(-1)?.messages as Array<{ role?: string; content?: string }>;
    const prompt = messages.find((message) => message.role === "system")?.content ?? "";
    expect(prompt).toContain("Review this document in the context of the active Easy Erf dossier.");
    expect(prompt).toContain("Erf 1570");
    expect(prompt).toContain("LPI C03400140000157000000");
    expect(prompt).toContain("Municipality Kouga Local Municipality");
    expect(prompt).toContain("Working address 8 Harbour Road, St Francis Bay");
    expect(prompt).toContain("never copy them into extracted identity or claims unless they are literally stated");
    expect(prompt).not.toContain("user-1");
  });

  it("keeps a readable wrong-property result for explanation but does not mark it matched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes(OPENAI_HOST)) {
          openAiCalls += 1;
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      identity: {
                        erfNumber: "262",
                        streetAddress: "123 Street Name",
                        suburbOrTown: "Potchefstroom",
                        municipality: "Tlokwe",
                        province: "North-West",
                      },
                      documentType: "Lightstone report",
                      provider: "Lightstone",
                      documentDate: null,
                      pageCount: 8,
                      summary: null,
                      extractedText: "Title deed T1234/2019 for a Potchefstroom property",
                      warning: null,
                      claims: [
                        {
                          domain: "ownership",
                          key: "registeredOwner",
                          label: "Registered owner",
                          value: "Someone Else",
                          numericValue: null,
                          unit: null,
                          page: 2,
                          quote: "Registered owner: Someone Else",
                          confidence: "high",
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
          );
        }
        return fakeFetch(input, init);
      }),
    );

    const response = await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const payload = (await response.json()) as { code: string; identityMatchStatus: string; warning: string; readable: boolean };
    expect(payload.code).toBe("IDENTITY_MISMATCH");
    expect(payload.identityMatchStatus).toBe("mismatch");
    expect(payload.warning).toContain("Document identity does not match the selected parcel.");
    expect(payload.readable).toBe(true);

    const written = patchCalls.at(-1)!.body.metadata as Record<string, unknown>;
    expect(written.extractionStatus).toBe("partial");
    expect(written.identityMatchStatus).toBe("mismatch");
    expect(written.extractedClaims).toHaveLength(1);
    expect(written.extractedText).toContain("Potchefstroom");
  });

  it("stores a matched document as searchable evidence", async () => {
    await call({ assetId: ASSET_ID, expectedParcelId: PARCEL_ID });
    const written = patchCalls.at(-1)!.body.metadata as Record<string, unknown>;
    expect(written.identityMatchStatus).toBe("matched");
    expect(written.extractedText).toContain("Erf 1570");
  });
});
