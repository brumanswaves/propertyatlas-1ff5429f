import { createClient } from "npm:@supabase/supabase-js@2.108.0";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-founder-report-upload";
const REPORT_BUCKET = "erf-files";
const MAX_REPORT_BYTES = 25 * 1024 * 1024;

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

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
}

function statusOf(order: { status?: string | null; status_enum?: string | null }) {
  return (order.status_enum || order.status || "").toLowerCase();
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
    log("configuration_missing", requestId, {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return json({ ok: false, error: "Report upload is not configured.", requestId }, 503);
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
    log("auth_rejected", requestId, { hasUser: Boolean(user) });
    return json({ ok: false, error: "Authentication failed.", requestId }, 401);
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    log("admin_rejected", requestId, { userId: user.id, roleErrorCode: roleError?.code ?? null });
    return json({ ok: false, error: "Founder admin access is required.", requestId }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body.", requestId }, 400);
  }

  const orderId = body.orderId;
  const sizeBytes = body.sizeBytes;
  if (!isUuid(orderId)) {
    return json({ ok: false, error: "A valid orderId is required.", requestId }, 400);
  }
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_REPORT_BYTES) {
    return json({ ok: false, error: "Report PDF must be between 1 byte and 25 MB.", requestId }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: orderError } = await admin
    .from("report_orders")
    .select("id,user_id,status,status_enum,provider,payload")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    log("order_lookup_failed", requestId, { orderId, errorCode: orderError?.code ?? null });
    return json({ ok: false, error: "Report order not found.", requestId }, 404);
  }

  const payload = order.payload && typeof order.payload === "object" && !Array.isArray(order.payload)
    ? order.payload as Record<string, unknown>
    : {};

  if (order.provider !== "stripe" || payload.orderKind !== "easy_erf_investigation") {
    return json({ ok: false, error: "Order is not an Easy Erf Stripe investigation.", requestId }, 409);
  }
  if (statusOf(order) !== "processing") {
    return json({ ok: false, error: "Human review must be in progress before uploading the final report.", requestId }, 409);
  }
  if (!isUuid(order.user_id)) {
    return json({ ok: false, error: "A matched customer account is required before report delivery.", requestId }, 409);
  }

  const path = `${order.user_id}/paid-reports/${order.id}/report.pdf`;
  const { data: signedUpload, error: signedUploadError } = await admin.storage
    .from(REPORT_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (signedUploadError || !signedUpload?.token) {
    log("signed_upload_failed", requestId, {
      userId: user.id,
      orderId,
      error: signedUploadError?.message ?? null,
    });
    return json({ ok: false, error: "Could not prepare secure report upload.", requestId }, 500);
  }

  log("signed_upload_created", requestId, { userId: user.id, orderId, path });
  return json({
    ok: true,
    bucket: REPORT_BUCKET,
    path,
    token: signedUpload.token,
    maxBytes: MAX_REPORT_BYTES,
    requestId,
  });
});
