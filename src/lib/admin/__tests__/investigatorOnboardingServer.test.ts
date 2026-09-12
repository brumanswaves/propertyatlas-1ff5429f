import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import {
  grantExistingFounderInvestigator,
  initiateFounderInvestigatorOnboarding,
  listFounderInvestigators,
  searchFounderInvestigators,
  type InvestigatorOnboardingDependencies,
} from "../investigatorOnboardingServer";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "22222222-2222-4222-8222-222222222222";
const INVESTIGATOR = "55555555-5555-4555-8555-555555555555";

function authUser(input: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-12T10:00:00.000Z",
    user_metadata: {},
    ...input,
  } as User;
}

function fakeDependencies(input?: {
  users?: User[];
  roles?: Array<{ user_id: string; role: "admin" | "moderator" | "user"; created_at: string }>;
  profiles?: Array<{ id: string; full_name: string | null }>;
}) {
  const users = [...(input?.users ?? [])];
  const roles = [...(input?.roles ?? [])];
  const profiles = [...(input?.profiles ?? [])];
  const invitations: Array<{ email: string; data: object | undefined }> = [];
  const grants: Array<Record<string, string>> = [];

  class Query {
    private filters: Array<[string, unknown]> = [];
    private max = Number.POSITIVE_INFINITY;

    constructor(private readonly table: string) {}
    select() { return this; }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
    in(column: string, values: unknown[]) { this.filters.push([column, values]); return this; }
    order() { return this; }
    limit(value: number) { this.max = value; return this; }
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      const source = this.table === "user_roles" ? roles : profiles;
      const data = source.filter((row) => this.filters.every(([column, value]) => {
        const rowValue = (row as Record<string, unknown>)[column];
        return Array.isArray(value) ? value.includes(rowValue) : rowValue === value;
      })).slice(0, this.max);
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  }

  const serviceSupabase = {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users, nextPage: null }, error: null })),
        getUserById: vi.fn(async (id: string) => ({
          data: { user: users.find((user) => user.id === id) ?? null },
          error: null,
        })),
        inviteUserByEmail: vi.fn(async (email: string, options: { data?: object }) => {
          invitations.push({ email, data: options.data });
          const user = authUser({
            id: INVESTIGATOR,
            email,
            invited_at: "2026-09-12T11:00:00.000Z",
            user_metadata: options.data ?? {},
          });
          users.push(user);
          return { data: { user }, error: null };
        }),
      },
    },
    from: (table: string) => new Query(table),
    rpc: vi.fn(async (_name: string, args: Record<string, string>) => {
      grants.push(args);
      if (!roles.some((role) => role.user_id === args.p_target_user_id && role.role === "moderator")) {
        roles.push({
          user_id: args.p_target_user_id,
          role: "moderator",
          created_at: "2026-09-12T11:01:00.000Z",
        });
      }
      return { data: null, error: null };
    }),
  } as unknown as SupabaseClient<Database>;

  const dependencies: InvestigatorOnboardingDependencies = {
    authenticate: vi.fn(async () => ({
      actor: authUser({ id: ADMIN, email: "founder@example.com" }),
      serviceSupabase,
    })),
  };

  return { dependencies, users, roles, invitations, grants, serviceSupabase };
}

const request = new Request("http://localhost/api/admin/support", {
  headers: { Authorization: "Bearer fixture" },
});

describe("Founder investigator onboarding", () => {
  it("lets an authenticated founder invite the intended email through Supabase Auth", async () => {
    const fixture = fakeDependencies();
    const result = await initiateFounderInvestigatorOnboarding(request, {
      name: "  Synthetic   Investigator ",
      email: "Investigator@Example.com",
    }, fixture.dependencies);

    expect(result.success && result.outcome).toBe("invited");
    expect(fixture.invitations).toEqual([{
      email: "investigator@example.com",
      data: { full_name: "Synthetic Investigator" },
    }]);
    expect(fixture.grants).toEqual([{
      p_actor_user_id: ADMIN,
      p_target_user_id: INVESTIGATOR,
      p_action: "invite_sent",
    }]);
    expect(JSON.stringify(result)).not.toMatch(/service.role|service_role|secret/i);
  });

  it("does not reach Auth Admin when founder authorization fails", async () => {
    const fixture = fakeDependencies();
    const dependencies: InvestigatorOnboardingDependencies = {
      authenticate: vi.fn(async () => {
        throw new ApiRequestError("Founder Operations access is required.", 403);
      }),
    };

    await expect(initiateFounderInvestigatorOnboarding(request, {
      name: "Blocked User",
      email: "blocked@example.com",
    }, dependencies)).rejects.toMatchObject({ status: 403 });
    expect(fixture.invitations).toEqual([]);
    expect(fixture.grants).toEqual([]);
  });

  it("does not silently promote an email that already belongs to a customer", async () => {
    const fixture = fakeDependencies({
      users: [authUser({
        id: CUSTOMER,
        email: "customer@example.com",
        email_confirmed_at: "2026-09-01T08:00:00.000Z",
        user_metadata: { full_name: "Existing Customer" },
      })],
    });

    const result = await initiateFounderInvestigatorOnboarding(request, {
      name: "Existing Customer",
      email: "customer@example.com",
    }, fixture.dependencies);

    expect(result).toMatchObject({ success: true, outcome: "existing_customer" });
    expect(fixture.invitations).toEqual([]);
    expect(fixture.grants).toEqual([]);
  });

  it("requires a separate email-bound action before granting an existing customer the role", async () => {
    const fixture = fakeDependencies({
      users: [authUser({
        id: CUSTOMER,
        email: "customer@example.com",
        email_confirmed_at: "2026-09-01T08:00:00.000Z",
        user_metadata: { full_name: "Existing Customer" },
      })],
    });

    await expect(grantExistingFounderInvestigator(request, {
      userId: CUSTOMER,
      email: "different@example.com",
    }, fixture.dependencies)).rejects.toMatchObject({ status: 409 });
    expect(fixture.grants).toEqual([]);

    const result = await grantExistingFounderInvestigator(request, {
      userId: CUSTOMER,
      email: "customer@example.com",
    }, fixture.dependencies);
    expect(result.success && result.outcome).toBe("already_investigator");
    expect(fixture.grants).toEqual([{
      p_actor_user_id: ADMIN,
      p_target_user_id: CUSTOMER,
      p_action: "existing_customer_role_granted",
    }]);
  });

  it("lists pending and active roles separately and assignment search returns only active investigators", async () => {
    const pending = authUser({
      id: INVESTIGATOR,
      email: "pending@example.com",
      invited_at: "2026-09-12T11:00:00.000Z",
    });
    const activeId = "66666666-6666-4666-8666-666666666666";
    const active = authUser({
      id: activeId,
      email: "active@example.com",
      email_confirmed_at: "2026-09-12T11:30:00.000Z",
    });
    const fixture = fakeDependencies({
      users: [pending, active],
      roles: [
        { user_id: INVESTIGATOR, role: "moderator", created_at: "2026-09-12T11:01:00.000Z" },
        { user_id: activeId, role: "moderator", created_at: "2026-09-12T11:31:00.000Z" },
      ],
      profiles: [
        { id: INVESTIGATOR, full_name: "Pending Reviewer" },
        { id: activeId, full_name: "Active Reviewer" },
      ],
    });

    const directory = await listFounderInvestigators(request, fixture.dependencies);
    expect(directory.map((entry) => [entry.fullName, entry.status])).toEqual([
      ["Active Reviewer", "active"],
      ["Pending Reviewer", "invited"],
    ]);
    await expect(searchFounderInvestigators(request, "pending", fixture.dependencies)).resolves.toEqual([]);
    await expect(searchFounderInvestigators(request, "active", fixture.dependencies)).resolves.toMatchObject([
      { id: activeId, status: "active" },
    ]);
  });

  it("keeps founder/admin accounts out of the investigator directory even if a stale moderator role remains", async () => {
    const founder = authUser({
      id: ADMIN,
      email: "founder@example.com",
      email_confirmed_at: "2026-09-01T08:00:00.000Z",
    });
    const fixture = fakeDependencies({
      users: [founder],
      roles: [
        { user_id: ADMIN, role: "admin", created_at: "2026-09-01T08:00:00.000Z" },
        { user_id: ADMIN, role: "moderator", created_at: "2026-09-01T08:01:00.000Z" },
      ],
    });

    await expect(listFounderInvestigators(request, fixture.dependencies)).resolves.toEqual([]);
    await expect(searchFounderInvestigators(request, "founder", fixture.dependencies)).resolves.toEqual([]);
  });
});
