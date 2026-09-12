import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import { authenticateFounderSupportRequest } from "./founderSupportServer";
import type {
  FounderInvestigatorOnboardingResponse,
  FounderInvestigatorSummary,
} from "./founderSupportTypes";

const INVESTIGATOR_ROLE = "moderator" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AUTH_USER_PAGES = 20;

type FounderContext = Awaited<ReturnType<typeof authenticateFounderSupportRequest>>;

export interface InvestigatorOnboardingDependencies {
  authenticate(request: Request): Promise<FounderContext>;
}

const productionDependencies: InvestigatorOnboardingDependencies = {
  authenticate: authenticateFounderSupportRequest,
};

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ApiRequestError("Enter a valid investigator email address.", 400);
  }
  return email;
}

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) {
    throw new ApiRequestError("Enter the investigator's name.", 400);
  }
  return name;
}

function userActivatedAt(user: User) {
  return user.confirmed_at ?? user.email_confirmed_at ?? null;
}

function userFullName(user: User, profileName?: string | null) {
  const profile = String(profileName ?? "").trim();
  if (profile) return profile;
  const metadataName = String(user.user_metadata?.full_name ?? "").trim();
  return metadataName || null;
}

async function listAuthUsers(serviceSupabase: SupabaseClient<Database>) {
  const users: User[] = [];
  let page = 1;
  for (let read = 0; read < MAX_AUTH_USER_PAGES; read += 1) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new ApiRequestError("Could not inspect Easy Erf accounts.", 500);
    users.push(...data.users);
    if (!data.nextPage) return users;
    page = data.nextPage;
  }
  throw new ApiRequestError("The account directory is too large to inspect safely.", 503);
}

async function findAuthUserByEmail(
  serviceSupabase: SupabaseClient<Database>,
  email: string,
) {
  const users = await listAuthUsers(serviceSupabase);
  return users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;
}

async function readRoles(serviceSupabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await serviceSupabase
    .from("user_roles")
    .select("role,created_at")
    .eq("user_id", userId);
  if (error) throw new ApiRequestError("Could not verify this account's access.", 500);
  return data ?? [];
}

async function investigatorSummary(
  user: User,
  roleGrantedAt: string | null,
  profileName?: string | null,
): Promise<FounderInvestigatorSummary> {
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new ApiRequestError("The investigator account has no email address.", 409);
  const activatedAt = userActivatedAt(user);
  return {
    id: user.id,
    email,
    fullName: userFullName(user, profileName),
    status: activatedAt ? "active" : "invited",
    invitedAt: user.invited_at ?? null,
    activatedAt,
    roleGrantedAt,
  };
}

async function grantInvestigatorRole(
  context: FounderContext,
  targetUserId: string,
  action: "invite_sent" | "existing_customer_role_granted",
) {
  const { error } = await context.serviceSupabase.rpc("founder_grant_investigator_role", {
    p_actor_user_id: context.actor.id,
    p_target_user_id: targetUserId,
    p_action: action,
  });
  if (error) throw new ApiRequestError("Investigator access could not be recorded.", 500);
}

export async function listFounderInvestigators(
  request: Request,
  dependencies: InvestigatorOnboardingDependencies = productionDependencies,
) {
  const context = await dependencies.authenticate(request);
  const { data: accessRows, error } = await context.serviceSupabase
    .from("user_roles")
    .select("user_id,role,created_at")
    .in("role", [INVESTIGATOR_ROLE, "admin"])
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new ApiRequestError("Could not load investigators.", 500);

  const adminIds = new Set(
    (accessRows ?? [])
      .filter((row) => row.role === "admin")
      .map((row) => row.user_id),
  );
  const roleRows = (accessRows ?? []).filter(
    (row) => row.role === INVESTIGATOR_ROLE && !adminIds.has(row.user_id),
  );
  const ids = roleRows.map((row) => row.user_id);
  if (!ids.length) return [] as FounderInvestigatorSummary[];

  const { data: profiles, error: profileError } = await context.serviceSupabase
    .from("profiles")
    .select("id,full_name")
    .in("id", ids)
    .limit(200);
  if (profileError) throw new ApiRequestError("Could not load investigator profiles.", 500);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const grantedAt = new Map(roleRows.map((row) => [row.user_id, row.created_at]));

  const investigators = await Promise.all(ids.map(async (id) => {
    const { data, error: userError } = await context.serviceSupabase.auth.admin.getUserById(id);
    if (userError || !data.user) return null;
    return investigatorSummary(
      data.user,
      grantedAt.get(id) ?? null,
      names.get(id),
    );
  }));

  return investigators
    .filter((entry): entry is FounderInvestigatorSummary => Boolean(entry))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "active" ? -1 : 1;
      return (left.fullName ?? left.email).localeCompare(right.fullName ?? right.email);
    });
}

export async function searchFounderInvestigators(
  request: Request,
  rawQuery: string,
  dependencies: InvestigatorOnboardingDependencies = productionDependencies,
) {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) throw new ApiRequestError("Enter at least 2 characters to search investigators.", 400);
  const investigators = await listFounderInvestigators(request, dependencies);
  return investigators.filter((investigator) =>
    investigator.status === "active"
    && `${investigator.fullName ?? ""} ${investigator.email}`.toLowerCase().includes(query)
  ).slice(0, 20);
}

export async function initiateFounderInvestigatorOnboarding(
  request: Request,
  input: { name: string; email: string },
  dependencies: InvestigatorOnboardingDependencies = productionDependencies,
): Promise<FounderInvestigatorOnboardingResponse> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const context = await dependencies.authenticate(request);
  const existing = await findAuthUserByEmail(context.serviceSupabase, email);

  if (existing) {
    const roles = await readRoles(context.serviceSupabase, existing.id);
    if (roles.some((row) => row.role === "admin")) {
      throw new ApiRequestError("This founder/admin account is managed separately.", 409);
    }
    const investigatorRole = roles.find((row) => row.role === INVESTIGATOR_ROLE);
    if (investigatorRole) {
      return {
        success: true,
        outcome: "already_investigator",
        investigator: await investigatorSummary(
          existing,
          investigatorRole.created_at,
        ),
      };
    }
    return {
      success: true,
      outcome: "existing_customer",
      customer: {
        id: existing.id,
        email,
        fullName: userFullName(existing),
        accessKind: "customer",
      },
    };
  }

  const { data, error } = await context.serviceSupabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
  });
  if (error || !data.user) {
    throw new ApiRequestError("The investigator invitation could not be created.", 502);
  }
  await grantInvestigatorRole(context, data.user.id, "invite_sent");
  const role = await readRoles(context.serviceSupabase, data.user.id);
  return {
    success: true,
    outcome: "invited",
    investigator: await investigatorSummary(
      data.user,
      role.find((entry) => entry.role === INVESTIGATOR_ROLE)?.created_at ?? null,
      name,
    ),
  };
}

export async function grantExistingFounderInvestigator(
  request: Request,
  input: { userId: string; email: string },
  dependencies: InvestigatorOnboardingDependencies = productionDependencies,
): Promise<FounderInvestigatorOnboardingResponse> {
  if (!UUID_PATTERN.test(input.userId)) throw new ApiRequestError("A valid customer account is required.", 400);
  const email = normalizeEmail(input.email);
  const context = await dependencies.authenticate(request);
  const { data, error } = await context.serviceSupabase.auth.admin.getUserById(input.userId);
  if (error || !data.user || data.user.email?.trim().toLowerCase() !== email) {
    throw new ApiRequestError("The selected customer account no longer matches this email.", 409);
  }
  const roles = await readRoles(context.serviceSupabase, data.user.id);
  if (roles.some((row) => row.role === "admin")) {
    throw new ApiRequestError("This founder/admin account is managed separately.", 409);
  }
  await grantInvestigatorRole(context, data.user.id, "existing_customer_role_granted");
  const refreshedRoles = await readRoles(context.serviceSupabase, data.user.id);
  return {
    success: true,
    outcome: "already_investigator",
    investigator: await investigatorSummary(
      data.user,
      refreshedRoles.find((entry) => entry.role === INVESTIGATOR_ROLE)?.created_at ?? null,
    ),
  };
}
