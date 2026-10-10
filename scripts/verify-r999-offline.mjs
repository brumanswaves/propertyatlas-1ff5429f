// Execute the actual Edge handlers with synthetic SDK boundaries; no Deno/provider runtime.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import { createHash, webcrypto } from "node:crypto";
import ts from "typescript";
import "./verify-mobile-network.mjs";

const OWNER = "11111111-1111-4111-8111-111111111111";
const BRIEF = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const PARCEL = "csg:lpi:synthetic-offline-parcel";
const checks = [];
const sources = {};
let state;
let handler;
const settings = {
  STRIPE_SECRET_KEY: "synthetic-key",
  STRIPE_WEBHOOK_SECRET: "synthetic-signature-secret",
  SUPABASE_URL: "http://127.0.0.1:55433",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
  EASY_ERF_R999_PAYMENT_LINK_IDS: "plink_fixture",
  EASY_ERF_R999_CHECKOUT_MODE: "test",
};
const brief = {
  focus: "property_check",
  scopeAcknowledged: true,
  parcelId: PARCEL,
  propertyReferenceHint: "Synthetic parcel",
  context: "Synthetic research question",
};
function reset() {
  delete settings.EASY_ERF_R999_LIVE_ENABLED;
  settings.EASY_ERF_R999_CHECKOUT_MODE = "test";
  state = {
    calls: [],
    inserts: [],
    rpcs: [],
    quantity: 1,
    hasMore: false,
    amount: 99900,
    currency: "zar",
    mode: false,
    active: true,
    auth: true,
    signature: true,
    insertError: false,
    attachError: false,
    recordError: false,
    lookupError: false,
  };
}
class SyntheticStripe {
  static createSubtleCryptoProvider() {
    return {};
  }
  paymentLinks = {
    retrieve: async (id) => {
      state.calls.push(["retrieve", id]);
      return {
        active: state.active,
        livemode: state.mode,
        url: "https://buy.stripe.com/synthetic",
      };
    },
    listLineItems: async (id) => {
      state.calls.push(["lineItems", id]);
      return {
        has_more: state.hasMore,
        data: [
          {
            quantity: state.quantity,
            price: { unit_amount: state.amount, currency: state.currency, type: "one_time" },
          },
        ],
      };
    },
  };
  webhooks = {
    constructEventAsync: async (raw, signature) => {
      assert.equal(
        raw,
        state.rawBody,
        "Handler must pass the exact raw body to signature verification",
      );
      if (!state.signature || signature !== "synthetic-valid")
        throw new Error("Synthetic invalid signature");
      return state.event;
    },
  };
}
const admin = {
  auth: {
    getUser: async () => ({
      data: { user: state.auth ? { id: OWNER, email: "owner@example.invalid" } : null },
      error: null,
    }),
  },
  from(table) {
    assert.equal(table, "human_review_requests", "No unrelated/private source reads");
    let inserted;
    const query = {
      insert(row) {
        inserted = row;
        state.inserts.push(row);
        return query;
      },
      select() {
        return query;
      },
      eq(key, value) {
        assert.equal(key, "id");
        assert.equal(value, BRIEF);
        return query;
      },
      async single() {
        assert.ok(inserted);
        return {
          data: state.insertError ? null : { id: BRIEF },
          error: state.insertError ? {} : null,
        };
      },
      async maybeSingle() {
        return {
          data: state.lookupError
            ? null
            : {
                id: BRIEF,
                user_id: OWNER,
                parcel_id: PARCEL,
                property_reference_hint: "Synthetic parcel",
              },
          error: state.lookupError ? { code: "SYNTHETIC" } : null,
        };
      },
    };
    return query;
  },
  async rpc(name, args) {
    state.rpcs.push({ name, args });
    assert.ok(
      ["record_easy_erf_stripe_payment", "attach_easy_erf_human_review_request"].includes(name),
    );
    const error = (name.startsWith("record_") ? state.recordError : state.attachError)
      ? { code: "SYNTHETIC" }
      : null;
    return { data: ORDER, error };
  },
};
function load(path) {
  const filename = resolve(path);
  const source = readFileSync(filename, "utf8");
  sources[path] = createHash("sha256").update(source).digest("hex");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      Request,
      Response,
      URL,
      Date,
      Error,
      Set,
      crypto: webcrypto,
      console: { log() {} },
      Deno: {
        env: { get: (name) => settings[name] },
        serve: (value) => {
          handler = value;
        },
      },
      require: (name) => {
        if (name.startsWith("npm:@supabase/")) return { createClient: () => admin };
        if (name.startsWith("npm:stripe@")) return { __esModule: true, default: SyntheticStripe };
        assert.ok(name.startsWith("../_shared/"), `Unexpected dependency ${name}`);
        return load(resolve(dirname(filename), name));
      },
    },
    { filename },
  );
  return module.exports;
}
async function check(name, action) {
  reset();
  await action();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function checkout(body = brief, authorization = "Bearer synthetic-owner") {
  const response = await handler(
    new Request("http://127.0.0.1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}
load("supabase/functions/easy-erf-r999-checkout/index.ts");
await check(
  "authenticated checkout retains owner/parcel/context internally and exports only opaque ID",
  async () => {
    const result = await checkout();
    assert.equal(result.status, 200);
    assert.equal(result.body.mode, "test");
    assert.equal(state.inserts.length, 1);
    assert.equal(state.inserts[0].user_id, OWNER);
    assert.equal(state.inserts[0].parcel_id, PARCEL);
    assert.equal(state.inserts[0].context, brief.context);
    const url = new URL(result.body.url);
    assert.equal(url.searchParams.get("client_reference_id"), BRIEF);
    assert.ok(!url.toString().includes(PARCEL));
    assert.ok(!url.toString().includes("research"));
  },
);
await check("scope/parcel/identity gates reject before any brief write", async () => {
  for (const [body, auth, status] of [
    [{ ...brief, scopeAcknowledged: false }, "Bearer synthetic", 400],
    [{ ...brief, parcelId: "1570" }, "Bearer synthetic", 400],
    [brief, "", 401],
  ]) {
    assert.equal((await checkout(body, auth)).status, status);
  }
  state.auth = false;
  assert.equal((await checkout()).status, 401);
  assert.equal(state.inserts.length, 0);
  assert.equal(state.calls.length, 0);
});
for (const [name, change] of [
  [
    "quantity two",
    () => {
      state.quantity = 2;
    },
  ],
  [
    "missing quantity",
    () => {
      state.quantity = null;
    },
  ],
  [
    "truncated item list",
    () => {
      state.hasMore = true;
    },
  ],
  [
    "wrong price",
    () => {
      state.amount = 199800;
    },
  ],
  [
    "wrong currency",
    () => {
      state.currency = "usd";
    },
  ],
  [
    "wrong mode",
    () => {
      state.mode = true;
    },
  ],
  [
    "inactive link",
    () => {
      state.active = false;
    },
  ],
])
  await check(`checkout rejects ${name} without writing`, async () => {
    change();
    assert.equal((await checkout()).status, 503);
    assert.equal(state.inserts.length, 0);
  });
await check("unarmed/invalid mode cannot contact synthetic Stripe or write", async () => {
  for (const mode of ["live", "invalid"]) {
    settings.EASY_ERF_R999_CHECKOUT_MODE = mode;
    assert.equal((await checkout()).status, 503);
  }
  assert.equal(state.calls.length, 0);
  assert.equal(state.inserts.length, 0);
});
await check("brief persistence failure never returns a checkout URL", async () => {
  state.insertError = true;
  const result = await checkout();
  assert.equal(result.status, 500);
  assert.equal(result.body.url, undefined);
});
load("supabase/functions/easy-erf-stripe-webhook/index.ts");
async function webhook(
  overrides = {},
  eventType = "checkout.session.completed",
  signature = "synthetic-valid",
) {
  state.event = {
    id: "evt_fixture",
    type: eventType,
    data: {
      object: {
        id: "cs_fixture",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        payment_link: "plink_fixture",
        amount_total: 99900,
        currency: "zar",
        livemode: false,
        client_reference_id: BRIEF,
        customer_details: { email: "different@example.invalid" },
        ...overrides,
      },
    },
  };
  state.rawBody = JSON.stringify(state.event);
  const response = await handler(
    new Request("http://127.0.0.1/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: state.rawBody,
    }),
  );
  return { status: response.status, body: await response.json() };
}
for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"])
  await check(
    `${type} records exact authenticated brief owner/parcel before attachment`,
    async () => {
      const result = await webhook({}, type);
      assert.equal(result.status, 200);
      assert.equal(result.body.recorded, true);
      assert.equal(state.rpcs.length, 2);
      assert.equal(state.rpcs[0].args.p_matched_user_id, OWNER);
      assert.equal(state.rpcs[0].args.p_matched_parcel_id, PARCEL);
      assert.equal(state.rpcs[0].args.p_amount_total, 99900);
      assert.equal(state.rpcs[1].args.p_report_order_id, ORDER);
      assert.equal(state.rpcs[1].args.p_review_request_id, BRIEF);
    },
  );
await check("unsigned/invalid signature cannot record payment", async () => {
  assert.equal((await webhook({}, undefined, "")).status, 400);
  state.signature = false;
  assert.equal((await webhook()).status, 400);
  assert.equal(state.rpcs.length, 0);
});
await check("unpaid/unrelated events never record or grant delivery", async () => {
  for (const [overrides, type] of [
    [{ payment_status: "unpaid" }, undefined],
    [{ payment_link: "plink_other" }, undefined],
    [{}, "payment_intent.created"],
  ]) {
    assert.equal((await webhook(overrides, type)).body.recorded, false);
  }
  assert.equal(state.rpcs.length, 0);
});
await check("wrong total/currency fails closed before order recording", async () => {
  for (const override of [{ amount_total: 199800 }, { currency: "usd" }])
    assert.equal((await webhook(override)).status, 400);
  assert.equal(state.rpcs.length, 0);
});
await check("attachment failure reports recorded payment honestly for retry", async () => {
  state.attachError = true;
  const result = await webhook();
  assert.equal(result.status, 500);
  assert.equal(result.body.recorded, true);
});
await check("payment persistence failure cannot claim recorded order", async () => {
  state.recordError = true;
  const result = await webhook();
  assert.equal(result.status, 500);
  assert.equal(result.body.recorded, false);
  assert.equal(state.rpcs.length, 1);
});
const output = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/r999-offline");
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, "edge-handlers.json"),
  JSON.stringify(
    {
      checks,
      sources,
      providerRequests: 0,
      databaseWrites: 0,
      result: "synthetic handler checks passed",
      limitations:
        "Actual source transpiled to Node; SDK/auth/signature/database boundaries synthetic. Not Stripe cryptographic verification, Deno integration, SQL/RLS, payment, email, human-review usefulness or live acceptance.",
    },
    null,
    2,
  ),
);
