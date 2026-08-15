import { supabase } from "@/integrations/supabase/client";
import type {
  FounderSupportSearchResponse,
  FounderSupportUserResponse,
} from "./founderSupportTypes";

async function supportRequest<T>(path: string): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in is required.");

  const response = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
    },
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Founder Operations request failed.");
  }
  return payload as T;
}

export async function searchFounderSupportUsers(query: string) {
  return supportRequest<FounderSupportSearchResponse>(
    `/api/admin/support?mode=search&q=${encodeURIComponent(query.trim())}`,
  );
}

export async function readFounderSupportUser(userId: string) {
  return supportRequest<FounderSupportUserResponse>(
    `/api/admin/support?mode=user&userId=${encodeURIComponent(userId)}`,
  );
}
