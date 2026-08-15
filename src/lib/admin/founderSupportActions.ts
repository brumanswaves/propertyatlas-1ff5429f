import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import { grantBetaCredits, readBetaCreditStatus } from "@/lib/sitePotential/betaServer";
import { authenticateFounderSupportRequest } from "./founderSupportServer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_REASON_LENGTH = 8;
const MAX_REASON_LENGTH = 500;

export interface ComplimentarySitePotentialGrantResult {
  targetUserId: string;
  creditId: string;
  creditsGranted: 1;
  previousBetaCreditsRemaining: number;
  betaCreditsRemaining: number;
  reason: string;
  grantedBy: string;
  createdAt: string | null;
}

export async function grantComplimentarySitePotentialCredit(input: {
  request: Request;
  targetUserId: string;
  reason: string;
}): Promise<ComplimentarySitePotentialGrantResult> {
  if (!UUID_PATTERN.test(input.targetUserId)) {
    throw new ApiRequestError("A valid target user id is required.", 400);
  }

  const reason = input.reason.trim().replace(/\s+/g, " ").slice(0, MAX_REASON_LENGTH);
  if (reason.length < MIN_REASON_LENGTH) {
    throw new ApiRequestError(
      `Enter a support reason of at least ${MIN_REASON_LENGTH} characters.`,
      400,
    );
  }

  const { actor, serviceSupabase } = await authenticateFounderSupportRequest(input.request);
  const before = await readBetaCreditStatus({
    serviceSupabase,
    userId: input.targetUserId,
  });

  const granted = await grantBetaCredits({
    serviceSupabase,
    targetUserId: input.targetUserId,
    grantedBy: actor.id,
    credits: 1,
    reason,
    expiresAt: null,
  });

  if (!granted.ok) {
    throw new ApiRequestError(granted.error, granted.status);
  }

  const after = await readBetaCreditStatus({
    serviceSupabase,
    userId: input.targetUserId,
  });

  const credit = granted.credit as Record<string, unknown>;
  return {
    targetUserId: input.targetUserId,
    creditId: String(credit.id ?? ""),
    creditsGranted: 1,
    previousBetaCreditsRemaining: before.creditsRemaining,
    betaCreditsRemaining: after.creditsRemaining,
    reason,
    grantedBy: actor.id,
    createdAt: credit.created_at ? String(credit.created_at) : null,
  };
}
