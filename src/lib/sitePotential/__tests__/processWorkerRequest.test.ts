import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => ({
  createServiceRoleSupabaseClient: vi.fn(),
  createSupabaseGenerationStore: vi.fn(),
  processSitePotentialGenerationQueue: vi.fn(),
  openAiSitePotentialImageClient: { kind: "image-client" },
}));

vi.mock("../serverAuth", () => ({
  createServiceRoleSupabaseClient: workerMocks.createServiceRoleSupabaseClient,
}));

vi.mock("../generationSupabaseWorker", () => ({
  createSupabaseGenerationStore: workerMocks.createSupabaseGenerationStore,
  openAiSitePotentialImageClient: workerMocks.openAiSitePotentialImageClient,
}));

vi.mock("../generationWorker", () => ({
  processSitePotentialGenerationQueue: workerMocks.processSitePotentialGenerationQueue,
}));

import { handleProcessSitePotentialRequest } from "../processWorkerRequest";

const originalEnv = { ...process.env };

function workerRequest(input?: { body?: unknown; authorization?: string; workerSecret?: string }) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (input?.authorization) headers.set("Authorization", input.authorization);
  if (input?.workerSecret) headers.set("X-Site-Potential-Worker-Secret", input.workerSecret);
  return new Request("https://easyerf.test/api/public/site-potential/process", {
    method: "POST",
    headers,
    body: JSON.stringify(input?.body ?? {}),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("process Site Potential worker request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SITE_POTENTIAL_WORKER_ENABLED = "true";
    process.env.SITE_POTENTIAL_WORKER_SECRET = "worker-secret";
    workerMocks.createServiceRoleSupabaseClient.mockReturnValue({ kind: "supabase" });
    workerMocks.createSupabaseGenerationStore.mockReturnValue({ kind: "store" });
    workerMocks.processSitePotentialGenerationQueue.mockResolvedValue({
      workerId: "site-potential-worker:test",
      recoveredItems: 0,
      recoveredPacks: 0,
      claimed: 0,
      completed: 0,
      failed: 0,
      skippedExisting: 0,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 when the worker secret header is missing", async () => {
    const response = await handleProcessSitePotentialRequest(workerRequest());

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Worker authorization failed.",
    });
    expect(workerMocks.processSitePotentialGenerationQueue).not.toHaveBeenCalled();
  });

  it("returns 401 when the worker secret is incorrect", async () => {
    const response = await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer wrong-secret" }),
    );

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Worker authorization failed.",
    });
  });

  it("returns 403 when the worker is disabled", async () => {
    process.env.SITE_POTENTIAL_WORKER_ENABLED = "false";

    const response = await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer worker-secret" }),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Site Potential worker is disabled.",
    });
    expect(workerMocks.processSitePotentialGenerationQueue).not.toHaveBeenCalled();
  });

  it("accepts the configured bearer secret", async () => {
    const response = await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer worker-secret", body: { maxItems: 2 } }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ success: true });
    expect(workerMocks.createServiceRoleSupabaseClient).toHaveBeenCalledTimes(1);
    expect(workerMocks.processSitePotentialGenerationQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        imageClient: workerMocks.openAiSitePotentialImageClient,
        maxItems: 2,
        store: { kind: "store" },
        workerId: expect.stringMatching(/^site-potential-worker:/),
      }),
    );
  });

  it("accepts the configured X-Site-Potential-Worker-Secret header", async () => {
    const response = await handleProcessSitePotentialRequest(
      workerRequest({ workerSecret: "worker-secret" }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ success: true });
  });

  it("clamps maxItems from 1 to 6", async () => {
    await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer worker-secret", body: { maxItems: 999 } }),
    );
    await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer worker-secret", body: { maxItems: -4 } }),
    );

    expect(workerMocks.processSitePotentialGenerationQueue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ maxItems: 6 }),
    );
    expect(workerMocks.processSitePotentialGenerationQueue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ maxItems: 1 }),
    );
  });

  it("sanitizes raw infrastructure failures and never exposes the configured secret", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    workerMocks.processSitePotentialGenerationQueue.mockRejectedValueOnce(
      new Error("SUPABASE_SERVICE_ROLE_KEY worker-secret SQL failed"),
    );

    const response = await handleProcessSitePotentialRequest(
      workerRequest({ authorization: "Bearer worker-secret" }),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("Site Potential worker failed. Check private worker logs for details.");
    expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(text).not.toContain("worker-secret");
    consoleSpy.mockRestore();
  });
});
