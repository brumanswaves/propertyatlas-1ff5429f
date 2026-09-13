import type {
  FounderInvestigatorDirectoryResponse,
  FounderInvestigatorOnboardingResponse,
  FounderSupportSearchResponse,
  FounderSupportUserResponse,
} from "./founderSupportTypes";

async function supportRequest<T>(accessToken: string | null, path: string, body?: Record<string, string>): Promise<T> {
  if (!accessToken) throw new Error("Your session has ended. Sign in again.");

  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

export type AccountAccess = { userId: string; email: string | null; suspended: boolean; protectedAccount: boolean };

export function readFounderAccountAccess(accessToken: string | null, userId: string) {
  return supportRequest<{ success: true; account: AccountAccess }>(
    accessToken, `/api/admin/support?mode=account-access&userId=${encodeURIComponent(userId)}`,
  );
}

export function changeFounderAccountAccess(accessToken: string | null, userId: string, email: string, action: "suspend" | "restore", reason: string) {
  return supportRequest<{ success: true; account: Pick<AccountAccess, "userId" | "suspended"> }>(
    accessToken, "/api/admin/support", { userId, email, action, reason },
  );
}

export async function searchFounderSupportUsers(accessToken: string | null, query: string) {
  return supportRequest<FounderSupportSearchResponse>(
    accessToken, `/api/admin/support?mode=search&q=${encodeURIComponent(query.trim())}`,
  );
}

export async function readFounderSupportUser(accessToken: string | null, userId: string) {
  return supportRequest<FounderSupportUserResponse>(
    accessToken, `/api/admin/support?mode=user&userId=${encodeURIComponent(userId)}`,
  );
}

export async function listFounderInvestigators(accessToken: string | null) {
  return supportRequest<FounderInvestigatorDirectoryResponse>(
    accessToken, "/api/admin/support?mode=investigators",
  );
}

export async function searchFounderInvestigators(accessToken: string | null, query: string) {
  return supportRequest<FounderInvestigatorDirectoryResponse>(
    accessToken, `/api/admin/support?mode=investigator-search&q=${encodeURIComponent(query.trim())}`,
  );
}

export async function inviteFounderInvestigator(accessToken: string | null, name: string, email: string) {
  return supportRequest<FounderInvestigatorOnboardingResponse>(accessToken, "/api/admin/support", {
    action: "invite-investigator",
    name,
    email,
  });
}

export async function grantExistingFounderInvestigator(accessToken: string | null, userId: string, email: string) {
  return supportRequest<FounderInvestigatorOnboardingResponse>(accessToken, "/api/admin/support", {
    action: "grant-existing-investigator",
    userId,
    email,
  });
}
