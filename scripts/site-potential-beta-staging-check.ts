/**
 * Staging-only smoke checker for the Easy Erf Site Potential private beta.
 *
 * This intentionally calls the real beta redemption endpoint and can consume one beta credit.
 * Run only against a staging user/project that has been granted a disposable beta credit.
 *
 * Required env:
 * - EASY_ERF_BASE_URL
 * - EASY_ERF_AUTH_TOKEN
 * - PARCEL_ID
 * - SITE_PROJECT_ID
 *
 * Optional env:
 * - DESIGN_PACK_ID to poll an existing pack without redeeming another credit
 */

const baseUrl = process.env.EASY_ERF_BASE_URL;
const token = process.env.EASY_ERF_AUTH_TOKEN;
const parcelId = process.env.PARCEL_ID;
const siteProjectId = process.env.SITE_PROJECT_ID;
let designPackId = process.env.DESIGN_PACK_ID;

if (!baseUrl || !token || !parcelId || !siteProjectId) {
  throw new Error(
    "Set EASY_ERF_BASE_URL, EASY_ERF_AUTH_TOKEN, PARCEL_ID and SITE_PROJECT_ID before running.",
  );
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${response.status} ${payload?.error ?? response.statusText}`);
  }
  return payload;
}

if (!designPackId) {
  const redeem = await request("/api/site-potential/beta-redeem", {
    method: "POST",
    body: JSON.stringify({ parcelId, siteProjectId }),
  });
  designPackId = redeem.designPackId;
  console.log("Redeemed beta pack:", designPackId, redeem.status, redeem.completedCount);
}

for (;;) {
  const params = new URLSearchParams({ parcelId, siteProjectId, designPackId: designPackId ?? "" });
  const status = await request(`/api/site-potential/pack-status?${params.toString()}`);
  console.log(
    `[${new Date().toISOString()}] ${status.status}: ${status.completedCount}/${status.requestedCount}`,
  );
  if (
    status.status === "complete" ||
    status.status === "failed" ||
    (status.status === "partial_failed" &&
      !status.items?.some(
        (item: { status: string; generatedAssetId?: string | null; attemptCount?: number }) =>
          !item.generatedAssetId &&
          (item.status === "queued" ||
            item.status === "generating" ||
            (item.status === "failed" && Number(item.attemptCount ?? 0) < 3)),
      ))
  ) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
