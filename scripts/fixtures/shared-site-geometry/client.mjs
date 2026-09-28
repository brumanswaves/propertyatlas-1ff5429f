import { owner } from "../workspace-scope/auth.jsx";
export const ring = [
  [24.83, -34.17],
  [24.8303, -34.17],
  [24.8303, -34.1703],
  [24.83, -34.1703],
  [24.83, -34.17],
];
export const orders = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const lp = ["c00000000000990100000", "c00000000000990200000"];
export const records = Object.fromEntries(
  orders.map((orderId, i) => [
    orderId,
    {
      schemaVersion: 1,
      orderId,
      customerId: `33333333-3333-4333-8333-33333333333${i}`,
      parcelId: `csg:lpi:${lp[i]}`,
      revision: 7,
      canWork: true,
      canApprove: true,
      assets: [],
      siteProject: null,
      processingSources: [],
      userData: {
        erfNumber: 9901 + i,
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        ...(window.fixtureOptions?.saved
          ? {
              parcelRing: ring,
              normalizedParcel: {
                id: `csg:lpi:${lp[i]}`,
                source: "csg",
                sourceLabel: "Synthetic public source",
                lpi: lp[i],
                erfNumber: 9901 + i,
                municipality: "Kouga Local Municipality",
                knownFields: [],
                missingFields: [],
              },
            }
          : {}),
        easyErfInvestigation: {
          version: 1,
          parcelId: `csg:lpi:${lp[i]}`,
          identityStatus: "looks_correct",
          planning: { zoneCode: "RES1", userConfirmedZoneCode: "RES1" },
          sitePotential: { progressState: "concepts_ready", conceptCount: 0 },
          investigation: { currentStepId: "site-potential" },
        },
        buildEnvelopeInputs: {
          boundaryConfirmed: false,
          streetFrontageConfirmedByUser: false,
          ruleSource: "manual",
          streetSetbackM: 3,
          sideSetbackM: 1.5,
          rearSetbackM: 1.5,
          maxCoveragePercent: 50,
          maxHeightM: 8.5,
          recordedAreaM2: 900,
        },
      },
    },
  ]),
);
export const calls = [];
export const mutations = [];
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) },
  rpc(name, args) {
    return {
      abortSignal: async (signal) => {
        calls.push({ name, args: structuredClone(args), actor: owner });
        if (signal.aborted) throw new Error("cancelled");
        const row = records[args.p_order_id];
        if (name === "read_order_investigation") return { data: structuredClone(row), error: null };
        if (name === "read_investigation_review") return { data: null, error: null };
        if (name === "patch_order_investigation") {
          if (window.fixtureOptions?.conflict) return { data: null, error: { code: "40001" } };
          if (args.p_expected_revision !== row.revision)
            return { data: null, error: { code: "40001" } };
          mutations.push({
            orderId: row.orderId,
            customerId: row.customerId,
            parcelId: row.parcelId,
            revision: row.revision,
            actor: owner,
            patch: structuredClone(args.p_patch),
          });
          Object.assign(row.userData, structuredClone(args.p_patch));
          row.revision++;
          if (window.fixtureOptions?.badReadback) delete row.userData.parcelRing;
          return { data: structuredClone(row), error: null };
        }
        throw new Error(`Unexpected fixture RPC ${name}`);
      },
    };
  },
  from() {
    throw new Error("Unexpected table access in isolated fixture");
  },
};
