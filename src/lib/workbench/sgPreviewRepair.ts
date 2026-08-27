import { supabase } from "@/integrations/supabase/client";

export const SG_PREVIEW_FUNCTION_NAME = "render-sg-preview";

export interface RepairSgPreviewResult {
  success: boolean;
  previewAvailable: boolean;
  code: string | null;
}

function functionsUrl() {
  const base =
    (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ??
    "";
  return `${base.replace(/\/+$/, "")}/functions/v1/${SG_PREVIEW_FUNCTION_NAME}`;
}

function publishableKey() {
  return (
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
    ""
  );
}

export async function repairSgPreview(
  assetId: string,
  expectedParcelId: string,
  deps: { fetchImpl?: typeof fetch; url?: string; apiKey?: string; accessToken?: string } = {},
): Promise<RepairSgPreviewResult> {
  let accessToken = deps.accessToken ?? "";
  if (!accessToken) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? "";
  }
  if (!accessToken) return { success: false, previewAvailable: false, code: "AUTH_REQUIRED" };

  try {
    const response = await (deps.fetchImpl ?? fetch)(deps.url ?? functionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: deps.apiKey ?? publishableKey(),
      },
      body: JSON.stringify({ assetId, expectedParcelId }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: unknown;
      previewAvailable?: unknown;
      code?: unknown;
    } | null;
    return {
      success: response.ok && payload?.success === true,
      previewAvailable: response.ok && payload?.previewAvailable === true,
      code: typeof payload?.code === "string" ? payload.code : null,
    };
  } catch {
    return { success: false, previewAvailable: false, code: "SERVER_UNAVAILABLE" };
  }
}
