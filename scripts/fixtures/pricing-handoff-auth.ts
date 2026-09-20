type User = { id: string; email: string };
const listeners = new Set<(event: string, session: { user: User } | null) => void>();
let releaseDashboard: (() => void) | null = null;
let dashboardGate: Promise<void> | null = null;
export function holdDashboardRead() {
  dashboardGate = new Promise<void>((resolve) => { releaseDashboard = resolve; });
}
export function completeDashboardRead() {
  releaseDashboard?.();
  dashboardGate = null;
}
export function fixtureUser(): User | null {
  const actor = sessionStorage.getItem("pricing-fixture-actor");
  return actor ? { id: actor, email: `${actor}@example.invalid` } : null;
}
export function fixtureSignIn(actor: string | null) {
  if (actor) sessionStorage.setItem("pricing-fixture-actor", actor);
  else sessionStorage.removeItem("pricing-fixture-actor");
  const user = fixtureUser();
  listeners.forEach((listener) => listener("SIGNED_IN", user ? { user } : null));
}
export const supabase = {
  from: (table: string) => {
    if (["saved_properties", "property_notes", "user_roles"].includes(table)) {
      let owner: unknown = null;
      const read = async () => {
        if (table === "user_roles") return { data: [], error: null };
        const gate = dashboardGate;
        if (gate) await gate;
        if (sessionStorage.getItem("fixture-dashboard-fail") === "yes") throw new Error("Synthetic dashboard offline");
        const parcel = `manual:synthetic-${owner}`;
        return { error: null, data: table === "property_notes"
          ? [{ parcel_id: parcel, updated_at: "2026-09-20T09:00:00Z" }]
          : [{ parcel_id: parcel, created_at: "2026-09-20T08:00:00Z", research_status: null, status: null, tags: [], user_data: { displayTitle: `Private synthetic property for ${owner}` } }] };
      };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { if (column === "user_id") owner = value; return query; },
        order: () => query,
        abortSignal: () => query,
        then: (resolve: (value: Awaited<ReturnType<typeof read>>) => unknown, reject: (error: unknown) => unknown) => read().then(resolve, reject),
      };
      return query;
    }
    if (table !== "report_orders") throw new Error("Only synthetic report reads are supported");
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      abortSignal: async (signal: AbortSignal) => {
        if (signal.aborted) throw new Error("Aborted synthetic read");
        return sessionStorage.getItem("fixture-report-read") === "allow"
          ? { data: [], error: null }
          : { data: null, error: { message: "Synthetic report service unavailable" } };
      },
    };
    return query;
  },
  auth: {
    getSession: async () => { const user = fixtureUser(); return { data: { session: user ? { user } : null }, error: null }; },
    getUser: async () => ({ data: { user: fixtureUser() }, error: null }),
    onAuthStateChange: (listener: (event: string, session: { user: User } | null) => void) => {
      listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
  },
  functions: { invoke: async () => { throw new Error("Checkout is prohibited in this fixture"); } },
};
