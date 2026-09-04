import { createClient } from "npm:@supabase/supabase-js@2.108.0";

import {
  isHumanReviewInvestigationChecklistResolved,
  validateHumanReviewInvestigationChecklist,
  validateHumanReviewReportContent,
} from "../_shared/easyErfHumanReviewContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-founder-fulfillment";
const ALLOWED_ACTIONS = new Set(["start_review", "reopen_review", "mark_ready", "mark_failed"]);

type AutomaticCustomerEmailResult = {
  ok: boolean;
  status: number;
  code: string | null;
  error: string | null;
  receipt: unknown;
  emailAccepted: boolean;
  requestId: string;
};

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

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function triggerAutomaticCustomerEmail(input: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  orderId: string;
  requestId: string;
}): Promise<AutomaticCustomerEmailResult> {
  try {
    const response = await fetch(
      `${input.supabaseUrl}/functions/v1/easy-erf-founder-customer-notification`,
      {
        method: "POST",
        headers: {
          Authorization: input.authorization,
          apikey: input.anonKey,
          "Content-Type": "application/json",
          "x-request-id": input.requestId,
        },
        body: JSON.stringify({ orderId: input.orderId, action: "send" }),
      },
    );

    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      payload = isRecord(parsed) ? parsed : {};
    } catch {
      payload = {};
    }

    return {
      ok: response.ok && payload.ok === true,
      status: response.status,
      code: typeof payload.code === "string" ? payload.code : null,
      error: typeof payload.error === "string" ? payload.error : null,
      receipt: payload.receipt ?? null,
      emailAccepted: payload.emailAccepted === true,
      requestId: typeof payload.requestId === "string" ? payload.requestId : input.requestId,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      code: "EMAIL_FUNCTION_UNREACHABLE",
      error: "The report is ready, but Easy Erf could not reach the customer email service.",
      receipt: null,
      emailAccepted: false,
      requestId: input.requestId,
    };
  }
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
    return json({ ok: false, error: "Founder fulfillment is not configured.", requestId }, 503);
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
  const action = body.action;
  const pdfStoragePath = typeof body.pdfStoragePath === "string" ? body.pdfStoragePath.trim() : null;
  const failureReason = typeof body.failureReason === "string" ? body.failureReason.trim() : null;

  if (!isUuid(orderId)) {
    return json({ ok: false, error: "A valid orderId is required.", requestId }, 400);
  }
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: "Unsupported fulfillment action.", requestId }, 400);
  }
  if (action === "mark_failed" && !failureReason) {
    return json({ ok: false, error: "failureReason is required for mark_failed.", requestId }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "mark_ready") {
    const { data: readinessOrder, error: readinessError } = await admin
      .from("report_orders")
      .select("review_content")
      .eq("id", orderId)
      .maybeSingle();

    if (readinessError || !readinessOrder) {
      return json({ ok: false, error: "Report order was not found.", requestId }, 404);
    }

    const reportValidation = validateHumanReviewReportContent(readinessOrder.review_content);
    if (!reportValidation.ok) {
      return json(
        {
          ok: false,
          error:
            "Complete and save the reviewed bottom line plus all five report sections before delivery.",
          requestId,
        },
        409,
      );
    }

    const reviewContent = isRecord(readinessOrder.review_content)
      ? readinessOrder.review_content
      : {};
    const checklistValidation = validateHumanReviewInvestigationChecklist(
      reviewContent.investigationChecklist,
    );
    if (!checklistValidation.ok) {
      return json(
        {
          ok: false,
          error:
            "Save a status for every standard investigation checklist item before delivery.",
          requestId,
        },
        409,
      );
    }
    if (!isHumanReviewInvestigationChecklistResolved(checklistValidation.checklist)) {
      return json(
        {
          ok: false,
          error:
            "Resolve every standard investigation checklist item as Complete or Not applicable before delivery. Pending or Blocked items keep the order in review.",
          requestId,
        },
        409,
      );
    }
  }

  const { data: order, error: transitionError } = await admin.rpc(
    "transition_easy_erf_report_order",
    {
      p_order_id: orderId,
      p_action: action,
      p_actor_user_id: user.id,
      p_pdf_storage_path: pdfStoragePath,
      p_failure_reason: failureReason,
    },
  );

  if (transitionError || !order) {
    log("transition_failed", requestId, {
      userId: user.id,
      orderId,
      action,
      errorCode: transitionError?.code ?? null,
    });
    return json(
      {
        ok: false,
        error: transitionError?.message ?? "Fulfillment transition failed.",
        requestId,
      },
      409,
    );
  }

  let notification: AutomaticCustomerEmailResult | null = null;
  if (action === "mark_ready") {
    notification = await triggerAutomaticCustomerEmail({
      supabaseUrl,
      anonKey,
      authorization,
      orderId,
      requestId,
    });
    log(notification.ok ? "automatic_email_succeeded" : "automatic_email_incomplete", requestId, {
      userId: user.id,
      orderId,
      code: notification.code,
      emailAccepted: notification.emailAccepted,
    });
  }

  log("transition_succeeded", requestId, { userId: user.id, orderId, action });
  return json({ ok: true, order, notification, requestId });
});
