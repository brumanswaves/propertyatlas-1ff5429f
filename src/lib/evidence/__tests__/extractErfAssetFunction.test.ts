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
let downloadCalls = 0;
let patchCalls: Array<{ url: string; body: Record<string, unknown> }>;
let patchOk = true;

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

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.includes("/auth/v1/user")) return Promise.resolve(jsonResponse({ id: "user-1" }));
  if (url.includes("/rest/v1/erf_assets") && method === "GET") return Promise.resolve(jsonResponse([assetRow]));
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
  if (url.includes("/storage/v1/object/")) {
    downloadCalls += 1;
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
  }
  if (url.includes(OPENAI_HOST)) {
    openAiCalls += 1;
    openAiRequests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return Promise.resolve(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                identity: { erfNumber: "1570", suburbOrTown: "St Francis Bay" },
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
  downloadCalls = 0;
  patchCalls = [];
  patchOk = true;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        ({
          SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-key",
          SUPABASE_ANON_KEY: "anon-key",
          OPENAI_API_KEY: "openai-key",
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
