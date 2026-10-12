type User = {id: string; email: string};
let user: User | null = {id: "owner-a", email: "owner-a@example.invalid"};
const listeners = new Set<(event: string, session: {user: User} | null) => void>();
type Gate = { promise: Promise<any>; resolve: (value: any) => void };
const gates: Record<string, Gate[]> = {auth: [], checkout: [], errorBody: [], navigation: []};
const held = new Set<string>();
const calls: unknown[] = [];
function defer(kind: string, fallback: unknown) {
  if (!held.has(kind)) return Promise.resolve(fallback);
  let resolve!: (value: any) => void;
  const promise = new Promise(r => {resolve = r;});
  gates[kind].push({promise, resolve});
  return promise;
}
export const controls = {
  calls, gates,
  navigation: () => defer("navigation", null),
  hold: (kind: string) => held.add(kind),
  unhold: (kind: string) => held.delete(kind),
  release: (kind: string, index: number, value: unknown) => gates[kind][index].resolve(value),
  emit: (id: string | null) => {
    user = id ? {id, email: `${id}@example.invalid`} : null;
    listeners.forEach(listener => listener(id ? "SIGNED_IN" : "SIGNED_OUT", user ? {user} : null));
  },
};
export const supabase = {
  auth: {
    getUser: () => defer("auth", {data: {user}, error: null}),
    onAuthStateChange: (listener: (event: string, session: {user: User} | null) => void) => {
      listeners.add(listener);
      return {data: {subscription: {unsubscribe: () => listeners.delete(listener)}}};
    },
  },
  functions: {invoke: (name: string, args: unknown) => {
    calls.push({name, args, actor: user?.id});
    return defer("checkout", {data: {ok: false, error: "Synthetic unavailable"}, error: null});
  }},
};
export function errorResponse() {
  const response = new Response("{}", {status: 503});
  response.json = () => defer("errorBody", {error: "Synthetic late error"});
  return {data: null, error: {context: response}};
}
