import { createClient } from "@supabase/supabase-js";
import { owner } from "./auth.jsx";
// Real PostgREST builder. Only the transport and Auth responses are synthetic.
export const supabase = createClient("http://127.0.0.1:4190", "synthetic-no-access", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (...args) => window.fixture.fetch(...args) },
});
supabase.auth.getUser = async () => ({ data: { user: owner ? { id: owner } : null }, error: null });
supabase.auth.getSession = async () => {
  if (window.fixture?.sessionDelay)
    await new Promise((r) => setTimeout(r, window.fixture.sessionDelay));
  return {
    data: { session: owner ? { user: { id: owner }, access_token: `synthetic-${owner}` } : null },
    error: null,
  };
};
