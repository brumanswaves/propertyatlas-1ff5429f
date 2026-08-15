export type GoogleAuthTransport = "lovable" | "supabase";

export function resolveGoogleAuthTransport(
  founderSupabaseAuthFlag: string | boolean | undefined = import.meta.env.VITE_FOUNDER_SUPABASE_AUTH,
): GoogleAuthTransport {
  return founderSupabaseAuthFlag === true || founderSupabaseAuthFlag === "true" ? "supabase" : "lovable";
}
