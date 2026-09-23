import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Route as MapRoute } from "@/routes/index";
import { Route as RootRoute } from "@/routes/__root";
import {
  createEmptyErfWorkspaceState,
  writeErfWorkspaceState,
  readErfWorkspaceState,
  erfWorkspaceStateKey,
  browserScopedParcelKey,
} from "@/lib/workbench/erfWorkspaceState";
import {
  buildSavedInvestigationUserDataPatch,
  flushSavedInvestigation,
  mergeSavedInvestigationProjectionIntoWorkspace,
} from "@/lib/workbench/savedInvestigationProjection";
import {
  writeStoredBuildEnvelopeInputs,
  readStoredBuildEnvelopeInputs,
  buildEnvelopeStorageKey,
} from "@/lib/sitePotential/buildEnvelopeStore";
import { owner, setOwner, setLoading } from "./auth.jsx";
const params = new URLSearchParams(location.search);
if (params.has("authPending")) setLoading(true);
const copy = (value) => structuredClone(value);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (i) => `csg:lpi:synthetic-${i}`;
let records = Array.from({ length: 9 }, (_, i) => {
  const parcel_id = id(i + 1);
  const workspace = createEmptyErfWorkspaceState();
  workspace.planning.zoneCode = `SYNTHETIC-${i + 1}`;
  workspace.investigation.startedAt = "2026-01-01T00:00:00Z";
  return {
    id: `row-${i + 1}`,
    user_id: "synthetic-owner-A",
    parcel_id,
    user_data: {
      ...buildSavedInvestigationUserDataPatch(parcel_id, workspace),
      unrelated: { preserved: i + 1 },
      buildEnvelopeInputs: { maxCoveragePct: 35 },
    },
  };
});
if (sessionStorage.getItem("synthetic-database"))
  records = JSON.parse(sessionStorage.getItem("synthetic-database"));
if (params.has("legacy"))
  records[0].user_data.buildEnvelopeInputs = { maxCoveragePct: null, acceptedInputSignature: "" };
const fixture = (window.fixture = {
  records,
  requests: [],
  mutations: [],
  rules: [],
  flushes: [],
  route: params.get("route") || "map",
  Map: MapRoute.options.component,
  id,
  owner: setOwner,
  loading: setLoading,
  sessionDelay: 0,
  delay(table, parcel, ms, mode) {
    this.rules.push({ table, parcel: id(parcel), ms, mode });
  },
  async fetch(input, init) {
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    const query = Object.fromEntries(url.searchParams);
    const parcel =
      url.searchParams.get("parcel_id")?.slice(3) ??
      (init.body ? JSON.parse(init.body).p_parcel_id : undefined);
    const ruleIndex = this.rules.findIndex(
      (r) => r.table === table && (!r.parcel || r.parcel === parcel),
    );
    const rule = ruleIndex < 0 ? null : this.rules.splice(ruleIndex, 1)[0];
    let rows = [];
    if (table === "saved_properties")
      rows = records.filter((r) =>
        ["user_id", "parcel_id"].every(
          (k) => !url.searchParams.has(k) || url.searchParams.get(k) === `eq.${r[k]}`,
        ),
      );
    if (table === "erf_site_projects")
      rows = records
        .filter(
          (r) => query.user_id === `eq.${r.user_id}` && query.parcel_id === `eq.${r.parcel_id}`,
        )
        .map((r) => ({
          id: `project-${r.id}${this.projectVersion ? "-" + this.projectVersion : ""}`,
          user_id: r.user_id,
          parcel_id: r.parcel_id,
          mode: "new_build",
          generation_status: this.generationStatus || "not_started",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        }));
    if (rule?.mode === "wrong-owner")
      rows = rows.map((r) => ({ ...r, user_id: "synthetic-owner-B" }));
    if (rule?.mode === "wrong-parcel") rows = rows.map((r) => ({ ...r, parcel_id: id(9) }));
    if (rule?.mode === "duplicate") rows = [...rows, ...rows];
    if (rule?.mode === "wrong-projection")
      rows = rows.map((r) => ({
        ...r,
        user_data: {
          ...r.user_data,
          easyErfInvestigation: { ...r.user_data.easyErfInvestigation, parcelId: id(9) },
        },
      }));
    if (rule?.mode === "missing") rows = [];
    const result = copy(rows);
    const entry = {
      table,
      query,
      returned: result.map((r) => ({ owner: r.user_id, parcel: r.parcel_id })),
      bodyCount: table === "saved_properties" ? result.length : 0,
      method: init.method,
      aborted: false,
    };
    this.requests.push(entry);
    init.signal?.addEventListener(
      "abort",
      () => {
        entry.aborted = true;
      },
      { once: true },
    );
    // Deliberately deliver even after abort, to test continuation invalidation.
    if (rule?.ms) await pause(rule.ms);
    if (rule?.mode === "failure")
      return new Response(JSON.stringify({ message: "SYNTHETIC read failure", code: "fixture" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    if (table.startsWith("patch_saved_property")) {
      const body = JSON.parse(init.body);
      const headers = new Headers(init.headers);
      const authOwner = headers.get("Authorization")?.replace("Bearer synthetic-", "");
      const row = records.find((r) => r.user_id === authOwner && r.parcel_id === body.p_parcel_id);
      entry.target = { owner: authOwner, parcel: body.p_parcel_id };
      if (!row)
        return new Response(JSON.stringify({ message: "Wrong synthetic owner", code: "denied" }), {
          status: 403,
        });
      if (
        Object.entries(body.p_expected ?? {}).some(
          ([k, v]) => JSON.stringify(row.user_data[k]) !== JSON.stringify(v),
        )
      )
        return new Response(JSON.stringify({ message: "Conflict", code: "40001" }), {
          status: 409,
        });
      row.user_data = { ...row.user_data, ...body.p_user_data_patch };
      this.mutations.push(copy(entry.target));
      sessionStorage.setItem("synthetic-database", JSON.stringify(records));
      return new Response(JSON.stringify(row.user_data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify(
        new Headers(init.headers).get("Accept")?.includes("vnd.pgrst.object")
          ? (result[0] ?? null)
          : result,
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
  edit(i, zone) {
    const parcel = id(i);
    const workspace = readErfWorkspaceState(parcel, localStorage, owner);
    writeErfWorkspaceState(
      parcel,
      { ...workspace, planning: { ...workspace.planning, zoneCode: zone } },
      localStorage,
      owner,
    );
  },
  event(i) {
    window.dispatchEvent(
      new CustomEvent("erfstoep:workspace-updated", { detail: { parcelId: id(i), userId: owner } }),
    );
  },
  flush(i) {
    const result = { parcel: id(i), status: "pending" };
    this.flushes.push(result);
    void flushSavedInvestigation(id(i), owner).then(
      () => {
        result.status = "resolved";
      },
      (e) => {
        result.status = "rejected";
        result.error = e.message;
      },
    );
  },
  snapshot() {
    return {
      records: copy(records),
      requests: copy(this.requests),
      mutations: copy(this.mutations),
      flushes: copy(this.flushes),
      storage: Object.fromEntries(Object.entries(localStorage)),
    };
  },
  workspace(i, user = owner) {
    return readErfWorkspaceState(id(i), localStorage, user);
  },
  inputs(i) {
    return readStoredBuildEnvelopeInputs(id(i), owner);
  },
  baseline(i, user = owner) {
    return localStorage.getItem(browserScopedParcelKey("investigation-sync-baseline", id(i), user));
  },
});
if (!sessionStorage.getItem("synthetic-seeded")) {
  for (const row of records.slice(1)) {
    writeErfWorkspaceState(
      row.parcel_id,
      mergeSavedInvestigationProjectionIntoWorkspace(
        row.parcel_id,
        createEmptyErfWorkspaceState(),
        row.user_data.easyErfInvestigation,
      ),
      localStorage,
      row.user_id,
    );
    writeStoredBuildEnvelopeInputs(row.parcel_id, row.user_data.buildEnvelopeInputs, row.user_id);
  }
  sessionStorage.setItem("synthetic-seeded", "yes");
}
fixture.initial = fixture.snapshot();
const Root = RootRoute.options.component;
function App() {
  const [, refresh] = useState(0);
  fixture.routeTo = (value) => {
    fixture.route = value;
    refresh((n) => n + 1);
  };
  return (
    <>
      <h1>SYNTHETIC selected-property lifecycle</h1>
      <Root />
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
