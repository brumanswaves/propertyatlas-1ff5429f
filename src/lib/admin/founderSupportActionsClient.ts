import { supabase } from "@/integrations/supabase/client";
import type { ComplimentarySitePotentialGrantResult } from "./founderSupportActions";

export type ComplimentarySitePotentialGrantResponse =
  | { success: true; grant: ComplimentarySitePotentialGrantResult }
  | { success: false; error: string };

export async function grantComplimentarySitePotentialCredit(input: {
  targetUserId: string;
  reason: string;
}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in is required.");

  const response = await fetch("/api/admin/support", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      action: "grant-complimentary-site-potential",
      targetUserId: input.targetUserId,
      reason: input.reason.trim(),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ComplimentarySitePotentialGrantResponse
    | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload && "error" in payload ? payload.error : "Could not grant Site Potential access.");
  }
  return payload;
}
