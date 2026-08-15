export type GoogleAuthTransport = "lovable" | "supabase";

export function googleAuthTransportFromFlag(
  founderSupabaseAuthFlag: string | boolean | undefined,
): GoogleAuthTransport {
  return founderSupabaseAuthFlag === true || founderSupabaseAuthFlag === "true" ? "supabase" : "lovable";
}

export function resolveGoogleAuthTransport(): GoogleAuthTransport {
  return googleAuthTransportFromFlag(import.meta.env.VITE_FOUNDER_SUPABASE_AUTH);
}
