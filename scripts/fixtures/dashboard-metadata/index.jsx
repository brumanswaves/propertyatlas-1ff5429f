import React from "react";
import { createRoot } from "react-dom/client";
import { Route } from "@/routes/dashboard";
import { Route as MapRoute } from "@/routes/index";
import {
  createEmptyErfWorkspaceState,
  writeErfWorkspaceState,
  erfWorkspaceStateKey,
} from "@/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";
import { setOwner, setLoading } from "../workspace-scope/auth.jsx";
import "@/styles.css";
const id = (i) => `csg:lpi:synthetic-${i}`;
const make = (i, user_id = "synthetic-owner-A") => {
  const state = createEmptyErfWorkspaceState();
  state.investigation.startedAt = "2026-01-01T00:00:00Z";
  state.investigation.currentStepId = "confirm-property";
  state.reportStarted = i % 2 === 0;
  state.strategyScenarioCount = i === 1 ? 0 : 2;
  return {
    id: `row-${user_id}-${i}`,
    user_id,
    parcel_id: id(i),
    created_at: `2026-01-${String(i).padStart(2, "0")}T00:00:00Z`,
    research_status: null,
    status: null,
    tags: [],
    user_data: {
      displayTitle: `Synthetic ${user_id.endsWith("A") ? "A" : "B"} property ${i}`,
      erfNumber: i,
      portion: 0,
      municipality: "Synthetic town",
      province: "Eastern Cape",
      lat: -34,
      lng: 25,
      ...buildSavedInvestigationUserDataPatch(id(i), state),
      reportBody: `FORBIDDEN_REPORT_${i}`,
      documentText: `FORBIDDEN_DOCUMENT_${i}`,
      unrelated: { text: `FORBIDDEN_OTHER_${i}` },
      savedMarketEvidence: [
        { id: `market-${i}`, sourceUrl: "https://example.invalid", notes: `FORBIDDEN_MARKET_${i}` },
      ],
    },
  };
};
const options = window.fixtureOptions || {};
const records = sessionStorage.getItem("dashboard-records")
  ? JSON.parse(sessionStorage.getItem("dashboard-records"))
  : [
      ...Array.from({ length: options.size || 9 }, (_, i) => make(i + 1)),
      make(1, "synthetic-owner-B"),
    ];
if (options.missing) delete records[0].user_data.easyErfInvestigation;
if (options.empty) records.splice(0);
sessionStorage.setItem("dashboard-records", JSON.stringify(records));
for (const r of records) {
  const s = createEmptyErfWorkspaceState();
  s.planning.zoneCode = `LOCAL_DRAFT_${r.id}`;
  if (!localStorage.getItem(erfWorkspaceStateKey(r.parcel_id, r.user_id)))
    writeErfWorkspaceState(r.parcel_id, s, undefined, r.user_id);
}
// Generic projection emulator, driven only by the actual builder's request.
// Never adds owner/parcel filters or repairs a broad SELECT.
function project(row, select) {
  return Object.fromEntries(
    select.split(",").map((field) => {
      const [alias, expression] = field.includes(":") ? field.split(":") : [field, field];
      const path = expression.split(/->>?/);
      let value = row;
      for (const key of path) value = value?.[key];
      return [alias, value ?? null];
    }),
  );
}
const fixture = (window.fixture = {
  records,
  requests: [],
  mutations: [],
  rules: options.rules || [],
  owner: setOwner,
  loading: setLoading,
  id,
  snapshot() {
    return {
      records,
      requests: this.requests,
      mutations: this.mutations,
      drafts: Object.fromEntries(
        Object.entries(localStorage).filter(([k]) => !k.includes("supabase")),
      ),
    };
  },
  async fetch(input, init) {
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    const query = Object.fromEntries(url.searchParams);
    const ruleIndex = this.rules.findIndex((r) => !r.table || r.table === table);
    const rule = ruleIndex < 0 ? {} : this.rules.splice(ruleIndex, 1)[0];
    if (init.method !== "GET") {
      this.mutations.push({ table, method: init.method });
      throw new Error("Fixture forbids mutations");
    }
    let source =
      table === "saved_properties"
        ? records
        : table === "property_notes"
          ? records.map((r) => ({
              user_id: r.user_id,
              parcel_id: r.parcel_id,
              updated_at: r.created_at,
              created_at: r.created_at,
              personal: `FORBIDDEN_NOTE_${r.id}`,
            }))
          : [];
    for (const key of ["user_id", "parcel_id"])
      if (query[key]) source = source.filter((r) => `eq.${r[key]}` === query[key]);
    if (query.order)
      source = [...source].sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || a.parcel_id.localeCompare(b.parcel_id),
      );
    if (rule.mode === "empty") source = [];
    const total = source.length;
    const offset = Number(query.offset || 0),
      limit = Number(query.limit || total || 1);
    let body = source
      .slice(offset, offset + Math.min(limit, rule.cap || options.cap || limit))
      .map((r) => project(r, query.select || "*"));
    if (rule.mode === "wrong-owner") body = body.map((r) => ({ ...r, user_id: "wrong-owner" }));
    if (rule.mode === "duplicate" && body.length) body[body.length - 1] = body[0];
    if (rule.mode === "wrong-projection")
      body = body.map((r) => ({ ...r, projectionParcelId: id(99) }));
    if (rule.mode === "bad-scalar") body = body.map((r) => ({ ...r, displayTitle: { bad: true } }));
    if (rule.mode === "malformed") body = { invalid: true };
    if (rule.mode === "missing-page") body = [];
    const entry = { table, query, body: structuredClone(body), aborted: false };
    this.requests.push(entry);
    init.signal?.addEventListener("abort", () => (entry.aborted = true));
    if (rule.delay) await new Promise((r) => setTimeout(r, rule.delay)); // Ignores abort deliberately.
    if (rule.mode === "failure")
      return Response.json({ message: "Synthetic failure" }, { status: 400 });
    return Response.json(body, {
      headers:
        rule.mode === "missing-count"
          ? {}
          : {
              "Content-Range": `${offset}-${offset + body.length - 1}/${rule.mode === "changed-count" ? total + 1 : total}`,
            },
    });
  },
});
const Component = location.pathname === "/" ? MapRoute.options.component : Route.options.component;
createRoot(document.getElementById("root")).render(<Component />);
