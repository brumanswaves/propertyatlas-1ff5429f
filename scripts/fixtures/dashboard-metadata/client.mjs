import { createClient } from "@supabase/supabase-js";
import { owner } from "../workspace-scope/auth.jsx";
export const supabase = createClient("http://127.0.0.1:4191", "synthetic-no-access", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (...args) => window.fixture.fetch(...args) },
});
supabase.auth.getUser = async () => ({ data: { user: owner ? { id: owner } : null }, error: null });
supabase.auth.getSession = async () => ({
  data: { session: owner ? { user: { id: owner }, access_token: "synthetic" } : null },
  error: null,
});
