import {
  createSupabaseGenerationStore,
  openAiSitePotentialImageClient,
} from "./generationSupabaseWorker";
import { processSitePotentialGenerationQueue } from "./generationWorker";
import { sanitizedGenerationError } from "./generationJobs";
import { createServiceRoleSupabaseClient } from "./serverAuth";

export const SITE_POTENTIAL_WORKER_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Site-Potential-Worker-Secret",
} as const;

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
    console.error("Site Potential worker failed", error);
    return json(
      {
        success: false,
        error: publicWorkerError(error),
      },
      500,
    );
  }
}

function publicWorkerError(error: unknown) {
  const sanitized = sanitizedGenerationError(error);
  if (/sql|postgres|supabase|service[_-]?role|authorization|secret|api[_-]?key/i.test(sanitized)) {
    return "Site Potential worker failed. Check private worker logs for details.";
  }
  return sanitized || "Site Potential worker failed. Check private worker logs for details.";
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
    headers: { "Content-Type": "application/json", ...SITE_POTENTIAL_WORKER_CORS_HEADERS },
  });
}
