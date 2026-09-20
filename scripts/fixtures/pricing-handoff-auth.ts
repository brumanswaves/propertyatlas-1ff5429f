type User = { id: string; email: string };
const listeners = new Set<(event: string, session: { user: User } | null) => void>();
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
  auth: {
    getSession: async () => { const user = fixtureUser(); return { data: { session: user ? { user } : null }, error: null }; },
    getUser: async () => ({ data: { user: fixtureUser() }, error: null }),
    onAuthStateChange: (listener: (event: string, session: { user: User } | null) => void) => {
      listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
  },
  functions: { invoke: async () => { throw new Error("Checkout is prohibited in this fixture"); } },
};
