import { describe, expect, it } from "vitest";
import {
  codeInterpreterTiffInstructions,
  pollOpenAiTiffBackground,
  startOpenAiTiffBackground,
} from "../../../../supabase/functions/extract-erf-asset/openAiTiffBackground";

const INCLUDE_VALUE = "code_interpreter_call.outputs";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenAI TIFF Code Interpreter outputs", () => {
  it("requests Code Interpreter outputs when the background response is created", async () => {
    let createBody: Record<string, unknown> | null = null;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/files")) return jsonResponse({ id: "file-test" });
      if (url.endsWith("/v1/responses")) {
        createBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse({ id: "resp-test", status: "queued", output: [] });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await startOpenAiTiffBackground({
      fetchImpl,
      apiKey: "test-key",
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "diagram.tiff",
      mimeType: "image/tiff",
      model: "gpt-5.6-sol",
      systemPrompt: "Extract only visible evidence.",
      mode: "fast_preprocess",
    });

    expect(createBody).toMatchObject({ include: [INCLUDE_VALUE] });
  });

  it("uses deterministic filenames for generated SG preview images", () => {
    expect(codeInterpreterTiffInstructions("deep_review")).toContain("/mnt/data/sg-overview.png");
    const fast = codeInterpreterTiffInstructions("fast_preprocess");
    expect(fast).toContain("/mnt/data/sg-overview.png");
    expect(fast).toContain("/mnt/data/sg-detail-top-left.png");
    expect(fast).toContain("/mnt/data/sg-detail-top-right.png");
    expect(fast).toContain("/mnt/data/sg-detail-bottom-left.png");
    expect(fast).toContain("/mnt/data/sg-detail-bottom-right.png");
  });

  it("re-retrieves a completed response with the include parameter when outputs were omitted", async () => {
    const requestedUrls: string[] = [];
    const parsed = { documentType: "GENERAL PLAN" };
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (requestedUrls.length === 1) {
        return jsonResponse({
          id: "resp-test",
          status: "completed",
          output: [
            {
              type: "code_interpreter_call",
              container_id: "cntr-test",
              status: "completed",
            },
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(parsed) }],
            },
          ],
        });
      }
      return jsonResponse({
        id: "resp-test",
        status: "completed",
        output: [
          {
            type: "code_interpreter_call",
            container_id: "cntr-test",
            status: "completed",
            outputs: [{ type: "image", url: "https://api.openai.com/v1/containers/cntr-test/files/overview.png" }],
          },
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(parsed) }],
          },
        ],
      });
    }) as typeof fetch;

    const result = await pollOpenAiTiffBackground({
      fetchImpl,
      apiKey: "test-key",
      responseId: "resp-test",
      fileId: "file-test",
      containerId: "cntr-test",
    });

    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toBe("https://api.openai.com/v1/responses/resp-test");
    expect(requestedUrls[1]).toContain("include%5B%5D=code_interpreter_call.outputs");
    expect(result).toMatchObject({
      state: "completed",
      parsed,
      previewUrls: ["https://api.openai.com/v1/containers/cntr-test/files/overview.png"],
    });
  });

  it("recovers generated images from container files when inline outputs stay empty", async () => {
    const requestedUrls: string[] = [];
    const parsed = { documentType: "GENERAL PLAN" };
    const completedWithoutOutputs = {
      id: "resp-test",
      status: "completed",
      output: [
        {
          type: "code_interpreter_call",
          container_id: "cntr-test",
          status: "completed",
        },
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(parsed) }],
        },
      ],
    };
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.startsWith("https://api.openai.com/v1/responses/resp-test")) {
        return jsonResponse(completedWithoutOutputs);
      }
      if (url === "https://api.openai.com/v1/containers/cntr-test/files?limit=100&order=asc") {
        return jsonResponse({
          object: "list",
          data: [
            {
              id: "cfile-bottom-right",
              path: "/mnt/data/sg-detail-bottom-right.png",
              created_at: 5,
            },
            { id: "cfile-source", path: "/mnt/data/diagram.tiff", created_at: 1 },
            { id: "cfile-overview", path: "/mnt/data/sg-overview.png", created_at: 6 },
            { id: "cfile-top-right", path: "/mnt/data/sg-detail-top-right.png", created_at: 3 },
            { id: "cfile-bottom-left", path: "/mnt/data/sg-detail-bottom-left.png", created_at: 4 },
            { id: "cfile-top-left", path: "/mnt/data/sg-detail-top-left.png", created_at: 2 },
          ],
          has_more: false,
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await pollOpenAiTiffBackground({
      fetchImpl,
      apiKey: "test-key",
      responseId: "resp-test",
      fileId: "file-test",
      containerId: "cntr-test",
    });

    expect(requestedUrls).toHaveLength(3);
    expect(requestedUrls[1]).toContain("include%5B%5D=code_interpreter_call.outputs");
    expect(requestedUrls[2]).toBe(
      "https://api.openai.com/v1/containers/cntr-test/files?limit=100&order=asc",
    );
    expect(result).toMatchObject({
      state: "completed",
      parsed,
      previewUrls: [
        "https://api.openai.com/v1/containers/cntr-test/files/cfile-overview/content",
        "https://api.openai.com/v1/containers/cntr-test/files/cfile-top-left/content",
        "https://api.openai.com/v1/containers/cntr-test/files/cfile-top-right/content",
        "https://api.openai.com/v1/containers/cntr-test/files/cfile-bottom-left/content",
        "https://api.openai.com/v1/containers/cntr-test/files/cfile-bottom-right/content",
      ],
    });
  });
});
