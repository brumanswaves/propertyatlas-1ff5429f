export type SitePotentialApiRoute =
  | "beta-status"
  | "beta-redeem"
  | "pack-status"
  | "retry-pack";

export interface SitePotentialApiEnvironment {
  edgeEnabled: boolean;
  supabaseUrl: string;
  publishableKey: string;
}

export interface BuildSitePotentialApiRequestInput {
  route: SitePotentialApiRoute;
  token: string;
  searchParams?: URLSearchParams;
  init?: RequestInit;
}

function browserEnvironment(): SitePotentialApiEnvironment {
  return {
    edgeEnabled: import.meta.env.VITE_SITE_POTENTIAL_EDGE_API === "true",
    supabaseUrl: String(import.meta.env.VITE_SUPABASE_URL ?? ""),
    publishableKey: String(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    ),
  };
}

function withSearchParams(base: string, searchParams?: URLSearchParams) {
  const query = searchParams?.toString();
  return query ? `${base}?${query}` : base;
}

export function buildSitePotentialApiRequest(
  input: BuildSitePotentialApiRequestInput,
  environment: SitePotentialApiEnvironment = browserEnvironment(),
) {
  const headers = new Headers(input.init?.headers);
  headers.set("Authorization", `Bearer ${input.token}`);

  if (!environment.edgeEnabled) {
    return {
      url: withSearchParams(`/api/site-potential/${input.route}`, input.searchParams),
      init: { ...input.init, headers },
      transport: "legacy" as const,
    };
  }

  const supabaseUrl = environment.supabaseUrl.trim().replace(/\/+$/, "");
  const publishableKey = environment.publishableKey.trim();
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Founder-owned Site Potential API is not configured for this deployment.");
  }

  headers.set("apikey", publishableKey);
  return {
    url: withSearchParams(
      `${supabaseUrl}/functions/v1/site-potential-api/${input.route}`,
      input.searchParams,
    ),
    init: { ...input.init, headers },
    transport: "edge" as const,
  };
}

export async function fetchSitePotentialApi(
  input: BuildSitePotentialApiRequestInput,
  fetchImpl: typeof fetch = fetch,
) {
  const request = buildSitePotentialApiRequest(input);
  return fetchImpl(request.url, request.init);
}
