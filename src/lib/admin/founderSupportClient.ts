import { supabase } from "@/integrations/supabase/client";
import type {
  FounderInvestigatorDirectoryResponse,
  FounderInvestigatorOnboardingResponse,
  FounderSupportSearchResponse,
  FounderSupportUserResponse,
} from "./founderSupportTypes";

async function supportRequest<T>(path: string, body?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in is required.");

  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
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

export async function listFounderInvestigators() {
  return supportRequest<FounderInvestigatorDirectoryResponse>(
    "/api/admin/support?mode=investigators",
  );
}

export async function searchFounderInvestigators(query: string) {
  return supportRequest<FounderInvestigatorDirectoryResponse>(
    `/api/admin/support?mode=investigator-search&q=${encodeURIComponent(query.trim())}`,
  );
}

export async function inviteFounderInvestigator(name: string, email: string) {
  return supportRequest<FounderInvestigatorOnboardingResponse>("/api/admin/support", {
    action: "invite-investigator",
    name,
    email,
  });
}

export async function grantExistingFounderInvestigator(userId: string, email: string) {
  return supportRequest<FounderInvestigatorOnboardingResponse>("/api/admin/support", {
    action: "grant-existing-investigator",
    userId,
    email,
  });
}
