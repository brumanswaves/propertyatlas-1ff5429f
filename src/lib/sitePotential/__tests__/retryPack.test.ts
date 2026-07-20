import { describe, expect, it } from "vitest";
import { retrySitePotentialPack } from "../betaServer";
import { SITE_POTENTIAL_MAX_ATTEMPTS } from "../generationJobs";

const now = new Date("2026-07-20T12:00:00Z");
const stale = "2026-07-20T11:55:00Z";
const fresh = "2026-07-20T11:59:30Z";
const expiredLease = "2026-07-20T11:59:00Z";
const activeLease = "2026-07-20T12:05:00Z";

interface RetryPackRows {
  projects: Array<Record<string, unknown>>;
  packs: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}

function baseRows(overrides: {
  item?: Partial<Record<string, unknown>>;
  pack?: Partial<Record<string, unknown>>;
  project?: Partial<Record<string, unknown>>;
} = {}): RetryPackRows {
  const rows: RetryPackRows = {
    projects: [
      {
        id: "project-1",
        user_id: "user-1",
        parcel_id: "parcel-1",
        generation_status: "generating",
        ...overrides.project,
      },
    ],
    packs: [
      {
        id: "pack-1",
        user_id: "user-1",
        parcel_id: "parcel-1",
        site_project_id: "project-1",
        payment_provider: "beta_credit",
        status: "queued",
        requested_count: 3,
        completed_count: 0,
        created_at: "2026-07-20T11:50:00Z",
        updated_at: stale,
        heartbeat_at: null,
        worker_id: null,
        lease_expires_at: null,
        next_attempt_at: null,
        ...overrides.pack,
      },
    ],
    items: [
      {
        id: "item-1",
        design_pack_id: "pack-1",
        user_id: "user-1",
        option_index: 1,
        status: "queued",
        generated_asset_id: null,
        attempt_count: 0,
        worker_id: null,
        lease_expires_at: null,
        next_attempt_at: null,
        heartbeat_at: null,
        updated_at: stale,
        failure_code: null,
        failure_message: null,
        ...overrides.item,
      },
    ],
  };
  return rows;
}

function createServiceClient(
  rows: ReturnType<typeof baseRows>,
  options: { beforeItemUpdate?: () => void; beforePackUpdate?: () => void } = {},
) {
  const calls: string[] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    erf_site_projects: rows.projects,
    erf_design_packs: rows.packs,
    erf_design_pack_items: rows.items,
  };
  return {
    calls,
    from(table: string) {
      calls.push(`from:${table}`);
      return createQuery(tables[table] ?? [], table, options);
    },
    rpc(name: string) {
      calls.push(`rpc:${name}`);
      return Promise.resolve({ data: null, error: null });
    },
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  } as unknown as { calls: string[] };
}

function createQuery(
  tableRows: Record<string, unknown>[],
  table: string,
  options: { beforeItemUpdate?: () => void; beforePackUpdate?: () => void },
) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  let updateData: Record<string, unknown> | null = null;
  let orderColumn: string | null = null;
  let ascending = true;
  let limitCount: number | null = null;

  const api = {
    select: () => api,
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return api;
    },
    in(column: string, values: unknown[]) {
      filters.push((row) => values.includes(row[column]));
      return api;
    },
    gte(column: string, value: unknown) {
      filters.push((row) => String(row[column]) >= String(value));
      return api;
    },
    lt(column: string, value: unknown) {
      filters.push((row) => Number(row[column]) < Number(value));
      return api;
    },
    lte(column: string, value: unknown) {
      filters.push((row) => String(row[column]) <= String(value));
      return api;
    },
    is(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return api;
    },
    order(column: string, opts?: Record<string, unknown>) {
      orderColumn = column;
      ascending = opts?.ascending !== false;
      return api;
    },
    limit(count: number) {
      limitCount = count;
      return api;
    },
    insert: () => api,
    update(value: Record<string, unknown>) {
      updateData = value;
      return api;
    },
    async maybeSingle() {
      const data = execute()[0] ?? null;
      return { data, error: null };
    },
    async single() {
      const data = execute()[0] ?? null;
      return { data, error: data ? null : { message: "No row" } };
    },
    then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
      return Promise.resolve({ data: execute(), error: null }).then(resolve);
    },
  };

  function execute() {
    if (updateData && table === "erf_design_pack_items") options.beforeItemUpdate?.();
    if (updateData && table === "erf_design_packs") options.beforePackUpdate?.();
    const matched = tableRows.filter((row) => filters.every((filter) => filter(row)));
    if (updateData) {
      for (const row of matched) Object.assign(row, updateData);
    }
    let data = [...matched];
    if (orderColumn) {
      data.sort((left, right) =>
        ascending
          ? String(left[orderColumn as string]).localeCompare(String(right[orderColumn as string]))
          : String(right[orderColumn as string]).localeCompare(String(left[orderColumn as string])),
      );
    }
    if (limitCount !== null) data = data.slice(0, limitCount);
    return data;
  }

  return api;
}

async function retry(
  rows: ReturnType<typeof baseRows>,
  options?: { beforeItemUpdate?: () => void; beforePackUpdate?: () => void },
) {
  return retrySitePotentialPack({
    serviceSupabase: createServiceClient(rows, options) as never,
    userId: "user-1",
    parcelId: "parcel-1",
    siteProjectId: "project-1",
    designPackId: "pack-1",
    now,
  });
}

describe("retrySitePotentialPack", () => {
  it("does not retry a newly queued pack", async () => {
    const rows = baseRows({ item: { updated_at: fresh }, pack: { updated_at: fresh } });
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.items[0].next_attempt_at).toBeNull();
  });

  it("uses the newest pack queue transition when deciding whether queued work is stalled", async () => {
    const rows = baseRows({ item: { updated_at: stale }, pack: { updated_at: fresh } });
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.items[0].next_attempt_at).toBeNull();
  });

  it("retries a stalled queued pack", async () => {
    const rows = baseRows();
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: true });
    expect(rows.items[0]).toMatchObject({ status: "queued", next_attempt_at: now.toISOString() });
    expect(rows.packs[0]).toMatchObject({ status: "queued", next_attempt_at: now.toISOString() });
    expect(rows.projects[0]).toMatchObject({ generation_status: "generating" });
  });

  it("does not touch active generating work", async () => {
    const rows = baseRows({ item: { status: "generating", lease_expires_at: activeLease } });
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.items[0]).toMatchObject({ status: "generating", lease_expires_at: activeLease });
  });

  it("does not retry a failed item while another item in the same pack has an active worker", async () => {
    const rows = baseRows({
      pack: {
        status: "generating",
        worker_id: "worker-live",
        heartbeat_at: fresh,
        lease_expires_at: activeLease,
      },
    });
    rows.items = [
      {
        ...rows.items[0],
        id: "item-1",
        option_index: 1,
        status: "generating",
        worker_id: "worker-live",
        lease_expires_at: activeLease,
        heartbeat_at: fresh,
      },
      {
        ...rows.items[0],
        id: "item-2",
        option_index: 2,
        status: "failed",
        attempt_count: 1,
      },
    ];

    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.items[0]).toMatchObject({
      status: "generating",
      worker_id: "worker-live",
      lease_expires_at: activeLease,
    });
    expect(rows.items[1]).toMatchObject({ status: "failed", next_attempt_at: null });
    expect(rows.packs[0]).toMatchObject({
      worker_id: "worker-live",
      heartbeat_at: fresh,
      lease_expires_at: activeLease,
    });
  });

  it("requeues expired generating leases", async () => {
    const rows = baseRows({ item: { status: "generating", lease_expires_at: expiredLease } });
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: true });
    expect(rows.items[0]).toMatchObject({ status: "queued", lease_expires_at: null });
  });

  it("requeues failed items below max attempts but not max-attempt failures", async () => {
    const retryable = baseRows({ item: { status: "failed", attempt_count: 1 } });
    const maxed = baseRows({
      item: { status: "failed", attempt_count: SITE_POTENTIAL_MAX_ATTEMPTS },
      pack: { status: "failed" },
    });

    await expect(retry(retryable)).resolves.toMatchObject({ ok: true, retried: true });
    await expect(retry(maxed)).resolves.toMatchObject({ ok: true, retried: false });
  });

  it("leaves complete packs unchanged", async () => {
    const rows = baseRows({
      item: { status: "complete", generated_asset_id: "asset-1" },
      pack: { status: "complete", completed_count: 3 },
    });
    const result = await retry(rows);

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.packs[0]).toMatchObject({ status: "complete" });
  });

  it("rejects cross-user, cross-parcel and cross-project retry requests", async () => {
    const crossUser = baseRows({ project: { user_id: "other" }, pack: { user_id: "other" } });
    const crossParcel = baseRows({
      project: { parcel_id: "other" },
      pack: { parcel_id: "other" },
    });
    const crossProject = baseRows({
      project: { id: "other" },
      pack: { site_project_id: "other" },
    });

    await expect(retry(crossUser)).resolves.toMatchObject({ ok: false, status: 404 });
    await expect(retry(crossParcel)).resolves.toMatchObject({ ok: false, status: 404 });
    await expect(retry(crossProject)).resolves.toMatchObject({ ok: false, status: 404 });
  });

  it("does not overwrite a cron claim between read and conditional update", async () => {
    const rows = baseRows();
    const result = await retry(rows, {
      beforeItemUpdate: () => {
        rows.items[0].status = "generating";
        (rows.items[0] as Record<string, unknown>).lease_expires_at = activeLease;
      },
    });

    expect(result).toMatchObject({ ok: true, retried: false });
    expect(rows.items[0]).toMatchObject({ status: "generating", lease_expires_at: activeLease });
    expect(rows.packs[0].next_attempt_at).toBeNull();
  });

  it("preserves a cron pack claim that happens between item requeue and pack update", async () => {
    const rows = baseRows({ item: { status: "failed", attempt_count: 1 } });
    let claimed = false;
    const result = await retry(rows, {
      beforePackUpdate: () => {
        if (claimed) return;
        claimed = true;
        rows.packs[0].status = "generating";
        rows.packs[0].worker_id = "cron-worker";
        rows.packs[0].heartbeat_at = fresh;
        rows.packs[0].lease_expires_at = activeLease;
        rows.packs[0].updated_at = fresh;
      },
    });

    expect(result).toMatchObject({ ok: true, retried: true });
    expect(rows.items[0]).toMatchObject({ status: "queued", next_attempt_at: now.toISOString() });
    expect(rows.packs[0]).toMatchObject({
      status: "generating",
      worker_id: "cron-worker",
      heartbeat_at: fresh,
      lease_expires_at: activeLease,
    });
    expect(rows.projects[0]).toMatchObject({ generation_status: "generating" });
  });

  it("uses the same pack and does not call entitlement redemption, beta credit redemption or worker secrets", async () => {
    const rows = baseRows();
    const client = createServiceClient(rows);
    const result = await retrySitePotentialPack({
      serviceSupabase: client as never,
      userId: "user-1",
      parcelId: "parcel-1",
      siteProjectId: "project-1",
      designPackId: "pack-1",
      now,
    });

    expect(result).toMatchObject({ ok: true, retried: true });
    expect(result.ok && result.pack.designPackId).toBe("pack-1");
    expect(client.calls.join(" ")).not.toMatch(
      /consumeSitePotentialEntitlement|consumeSitePotentialBetaCredit|redeem_site_potential_pack_v2|SITE_POTENTIAL_WORKER_SECRET/i,
    );
  });
});
