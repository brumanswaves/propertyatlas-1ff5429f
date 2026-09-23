import { useSyncExternalStore } from "react";
export let owner = "synthetic-owner-A";
let snapshot = { owner, loading: false };
const listeners = new Set();
export function setOwner(value) {
  owner = value;
  snapshot = { owner, loading: false };
  listeners.forEach((fn) => fn());
}
export function setLoading(loading) {
  snapshot = { owner, loading };
  listeners.forEach((fn) => fn());
}
export function useAuth() {
  const state = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshot,
  );
  return { user: state.owner ? { id: state.owner } : null, loading: state.loading };
}
