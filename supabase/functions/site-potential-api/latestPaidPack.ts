export const NO_PAID_DESIGN_PACK_ID = "00000000-0000-0000-0000-000000000000";

export type LatestPaidDesignPackResolver = (
  parcelId: string,
  siteProjectId: string,
) => Promise<string | null>;

export async function pinLatestPaidDesignPackRequest(
  request: Request,
  resolveLatestPaidDesignPackId: LatestPaidDesignPackResolver,
) {
  if (request.method !== "GET") return request;

  const url = new URL(request.url);
  if (!url.pathname.endsWith("/pack-status")) return request;
  if (url.searchParams.get("designPackId")) return request;

  const parcelId = url.searchParams.get("parcelId");
  const siteProjectId = url.searchParams.get("siteProjectId");
  if (!parcelId || !siteProjectId) return request;

  const designPackId =
    (await resolveLatestPaidDesignPackId(parcelId, siteProjectId)) ?? NO_PAID_DESIGN_PACK_ID;
  url.searchParams.set("designPackId", designPackId);

  return new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
    signal: request.signal,
  });
}
