import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "./runtimeEnv";

export function createServiceRoleSupabaseClient() {
  const supabaseUrl = readServerEnv("SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Trusted Supabase service role is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
