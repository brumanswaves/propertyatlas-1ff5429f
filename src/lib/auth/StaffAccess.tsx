import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type StaffRole = "founder" | "investigator" | "customer";
export function staffRoleFromRows(rows: Array<{ role: string }>): StaffRole {
  return rows.some(({ role }) => role === "admin") ? "founder"
    : rows.some(({ role }) => role === "moderator") ? "investigator" : "customer";
}

type AuthState = ReturnType<typeof useAuth>;
type StaffAccess = AuthState & { role: StaffRole | null; retainedRole: StaffRole | null; checking: boolean; unavailable: boolean };
const StaffContext = createContext<StaffAccess>({ user: null, session: null, loading: true, role: null, retainedRole: null, checking: true, unavailable: false });
export function useStaffAccess() { return useContext(StaffContext); }

// Navigation hints use existing Auth + self-readable roles. Order/API/RLS checks
// remain authoritative; neither an assignment count nor user metadata grants entry.
export function StaffAccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const token = auth.session?.access_token;
  const userId = auth.user?.id;
  const expiresAt = auth.session?.expires_at;
  const [generation, setGeneration] = useState(0);
  const [resolved, setResolved] = useState<{ token: string; userId: string; expiresAt: number | undefined; pathname: string; generation: number; role: StaffRole | null; unavailable: boolean } | null>(null);

  useEffect(() => {
    const refresh = () => setGeneration((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    const request = new AbortController();
    if (!token || !userId || auth.loading) return;
    const current = () => !request.signal.aborted;
    const publish = (role: StaffRole | null, unavailable: boolean) => {
      if (current()) setResolved({ token, userId, expiresAt, pathname, generation, role, unavailable });
    };
    const expired = () => Boolean(expiresAt && expiresAt * 1000 <= Date.now());
    if (expired()) { publish(null, true); return; }
    let expiryTimer: number | undefined;
    const watchExpiry = () => {
      if (!expiresAt || !current()) return;
      if (expired()) { publish(null, true); return; }
      expiryTimer = window.setTimeout(watchExpiry, Math.min(2_147_483_647, expiresAt * 1000 - Date.now()));
    };
    watchExpiry();
    void (async () => {
      try {
        const identity = await supabase.auth.getUser(token);
        if (!current()) return;
        if (identity.error || identity.data.user?.id !== userId || expired()) { publish(null, true); return; }
        const roles = await supabase.from("user_roles").select("role").eq("user_id", userId).abortSignal(request.signal);
        if (!current()) return;
        if (roles.error || !Array.isArray(roles.data) || expired()) { publish(null, true); return; }
        publish(staffRoleFromRows(roles.data), false);
      } catch { publish(null, true); }
    })();
    return () => { request.abort(); window.clearTimeout(expiryTimer); };
  }, [token, userId, expiresAt, auth.loading, pathname, generation]);

  // Retention is only a mounted-draft hint, never validated access. The guard
  // hides/inerts it until the new credential passes identity AND role checks.
  const current = !auth.loading && token && resolved?.token === token && resolved.userId === userId &&
    resolved.expiresAt === expiresAt && resolved.pathname === pathname ? resolved : null;
  const retainedRole = !auth.loading && token && !current && resolved && resolved.userId === userId &&
    resolved.pathname === pathname && !resolved.unavailable && (!expiresAt || expiresAt * 1000 > Date.now())
    ? resolved.role : null;
  return <StaffContext.Provider value={{ ...auth, role: current?.role ?? null,
    retainedRole,
    checking: auth.loading || Boolean(token && !current), unavailable: current?.unavailable ?? false }}>{children}</StaffContext.Provider>;
}
