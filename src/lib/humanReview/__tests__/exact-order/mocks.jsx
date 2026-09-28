import React from "react";
export const useAuth = () => ({
  user: window.fixture.user ? { id: window.fixture.user } : null,
  loading: window.fixture.loading,
});
export const useOperationsAccess = () => ({ isAdmin: window.fixture.admin });
export const AdminGuard = ({ children }) => children;
export const TopNav = () => null;
export const Footer = () => null;
export const FounderHumanReviewEditor = () => null;
export const OrderInvestigationWorkspace = ({ orderId, onApproved }) => (
  <button onClick={onApproved}>Synthetic post-save readback {orderId}</button>
);
export const createFileRoute = () => (x) => x;
export const Link = ({ children }) => <span>{children}</span>;
export const toast = { error: (message) => window.fixture.errors.push(message), success: () => {} };
function mutation(kind) {
  window.fixture.mutations.push(kind);
  throw new Error("Unexpected mutation in read-only fixture");
}
export function request(kind, id, signal) {
  const f = window.fixture;
  return new Promise((resolve, reject) => {
    const r = { kind, id, actor: f.user, assigned: !f.admin, signal, resolve, reject };
    f.requests.push(r);
    f.pending.push(r);
  });
}
export const supabase = {
  functions: { invoke: () => mutation("function") },
  storage: { from: () => mutation("storage") },
  rpc(name, args) {
    if (
      ![
        "list_easy_erf_founder_queue",
        "list_assigned_investigation_queue",
        "read_assigned_investigation_header",
      ].includes(name)
    )
      return mutation(name);
    return {
      abortSignal(signal) {
        return request(name, args?.p_order_id ?? null, signal).then((data) => ({
          data,
          error: null,
        }));
      },
    };
  },
  from(table) {
    const filters = {};
    return {
      insert: () => mutation("insert"),
      update: () => mutation("update"),
      delete: () => mutation("delete"),
      upsert: () => mutation("upsert"),
      select() {
        return this;
      },
      eq(k, v) {
        filters[k] = v;
        return this;
      },
      abortSignal(signal) {
        this.signal = signal;
        return this;
      },
      maybeSingle() {
        return request(table, filters.id, this.signal).then((data) => ({ data, error: null }));
      },
    };
  },
};
