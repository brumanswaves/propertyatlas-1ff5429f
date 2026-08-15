import { CircleDashed, Clock3, Gift, UserRound } from "lucide-react";
import type { FounderSupportBetaCreditGrant } from "@/lib/admin/founderSupportTypes";

export function EntitlementGrantHistory({ grants }: { grants: FounderSupportBetaCreditGrant[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-accent">
          <Clock3 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Complimentary grant history</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Previous Site Potential beta-credit interventions for this customer, including who made
            the grant and the recorded support reason.
          </p>
        </div>
      </div>

      {grants.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Granted</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Granted by</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grants.map((grant) => (
                <tr key={grant.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Gift className="h-3.5 w-3.5 text-accent" />
                      {grant.creditsGranted} generation{grant.creditsGranted === 1 ? "" : "s"}
                    </div>
                    {grant.isExpired ? (
                      <div className="mt-1 text-[10px] font-semibold text-warning">Expired</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    <div>{grant.creditsUsed} used</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {grant.remainingCredits} remaining
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                      {grant.grantedByLabel ?? "System / not recorded"}
                    </div>
                    {grant.grantedBy ? (
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {shortId(grant.grantedBy)}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-sm px-4 py-3 leading-relaxed text-foreground">
                    {grant.reason ?? "No reason recorded on this historical grant."}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{formatDate(grant.createdAt)}</div>
                    {grant.expiresAt ? (
                      <div className="mt-1 text-[10px]">Expires {formatDate(grant.expiresAt)}</div>
                    ) : (
                      <div className="mt-1 text-[10px]">No expiry recorded</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-5 text-xs text-muted-foreground">
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" />
          No complimentary Site Potential grants are recorded for this customer yet.
        </div>
      )}
    </section>
  );
}

function shortId(value: string) {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
