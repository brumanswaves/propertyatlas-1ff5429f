import { createFileRoute } from "@tanstack/react-router";
import {
  createSupabaseGenerationStore,
  openAiSitePotentialImageClient,
} from "@/lib/sitePotential/generationSupabaseWorker";
import { processSitePotentialGenerationQueue } from "@/lib/sitePotential/generationWorker";
import { createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Site-Potential-Worker-Secret",
} as const;

export const Route = createFileRoute("/api/site-potential/process")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleProcessSitePotentialRequest(request),
    },
  },
});

export async function handleProcessSitePotentialRequest(request: Request) {
  if (process.env.SITE_POTENTIAL_WORKER_ENABLED !== "true") {
    return json({ success: false, error: "Site Potential worker is disabled." }, 403);
  }
  if (!isAuthorizedWorker(request)) {
    return json({ success: false, error: "Worker authorization failed." }, 401);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { maxItems?: number };
    const maxItems = Math.min(6, Math.max(1, Number(body.maxItems ?? 1)));
    const workerId = `site-potential-worker:${crypto.randomUUID()}`;
    const serviceSupabase = createServiceRoleSupabaseClient();
    const result = await processSitePotentialGenerationQueue({
      store: createSupabaseGenerationStore(serviceSupabase),
      imageClient: openAiSitePotentialImageClient,
      workerId,
      maxItems,
    });
    return json({ success: true, result }, 200);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Site Potential worker failed.",
      },
      500,
    );
  }
}

function isAuthorizedWorker(request: Request) {
  const expected = process.env.SITE_POTENTIAL_WORKER_SECRET;
  if (!expected) return false;
  const explicit = request.headers.get("x-site-potential-worker-secret");
  const authorization = request.headers.get("authorization") ?? "";
  return explicit === expected || authorization === `Bearer ${expected}`;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
