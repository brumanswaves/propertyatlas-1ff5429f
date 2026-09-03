import { createClient } from "npm:@supabase/supabase-js@2.108.0";

import {
  validateHumanReviewInvestigationChecklist,
  validateHumanReviewReportContent,
} from "../_shared/easyErfHumanReviewContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-founder-review-content";
const ALLOWED_ACTIONS = new Set(["save_report", "save_checklist"]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed.", requestId }, 405);
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "Founder review authoring is not configured.", requestId }, 503);
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "Authorization is required.", requestId }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return json({ ok: false, error: "Authentication failed.", requestId }, 401);
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    return json({ ok: false, error: "Founder admin access is required.", requestId }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body.", requestId }, 400);
  }

  if (!isUuid(body.orderId)) {
    return json({ ok: false, error: "A valid orderId is required.", requestId }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "save_report";
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: "Unsupported review-content action.", requestId }, 400);
  }

  const reportValidation = action === "save_report"
    ? validateHumanReviewReportContent(body.content)
    : null;
  if (reportValidation && !reportValidation.ok) {
    return json({ ok: false, error: reportValidation.error, requestId }, 400);
  }

  const checklistValidation = action === "save_checklist"
    ? validateHumanReviewInvestigationChecklist(body.checklist)
    : null;
  if (checklistValidation && !checklistValidation.ok) {
    return json({ ok: false, error: checklistValidation.error, requestId }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: orderError } = await admin
    .from("report_orders")
    .select("id,provider,payload,status,status_enum,review_content")
    .eq("id", body.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return json({ ok: false, error: "Report order was not found.", requestId }, 404);
  }
  const payload = order.payload && typeof order.payload === "object" && !Array.isArray(order.payload)
    ? order.payload as Record<string, unknown>
    : {};
  if (order.provider !== "stripe" || payload.orderKind !== "easy_erf_investigation") {
    return json({ ok: false, error: "Order is not an Easy Erf Human Review investigation.", requestId }, 409);
  }

  const status = String(order.status_enum || order.status || "").toLowerCase();
  if (!["paid", "fulfilling", "processing", "complete", "ready"].includes(status)) {
    return json({ ok: false, error: "This order is not in a reviewable state.", requestId }, 409);
  }

  const existingContent = isRecord(order.review_content) ? order.review_content : {};
  let nextContent: Record<string, unknown>;

  if (action === "save_checklist" && checklistValidation?.ok) {
    nextContent = {
      ...existingContent,
      investigationChecklist: checklistValidation.checklist,
    };
  } else if (reportValidation?.ok) {
    nextContent = {
      ...existingContent,
      ...reportValidation.content,
    };
  } else {
    return json({ ok: false, error: "No review content was supplied.", requestId }, 400);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("report_orders")
    .update({
      review_content: nextContent,
      reviewed_by: user.id,
      review_content_updated_at: now,
      updated_at: now,
    })
    .eq("id", body.orderId);

  if (updateError) {
    log("review_content_update_failed", requestId, {
      orderId: body.orderId,
      userId: user.id,
      action,
      errorCode: updateError.code ?? null,
    });
    return json({ ok: false, error: "Human Review content could not be saved.", requestId }, 500);
  }

  log("review_content_saved", requestId, {
    orderId: body.orderId,
    userId: user.id,
    action,
  });
  return json({ ok: true, content: nextContent, updatedAt: now, requestId });
});
