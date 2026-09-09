import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { investigationClient, requireInvestigationResult } from "@/lib/investigation/investigationClient";
import { investigationReviewVersionSchema, type InvestigationReviewVersion } from "@/lib/investigation/investigationReviewVersion";
import { SharedInvestigationReport } from "./SharedInvestigationReport";

export function DeliveredInvestigationReport({ orderId, versionId }: { orderId: string; versionId: string }) {
  const { user } = useAuth();
  return user ? <CustomerVersion key={`${user.id}:${orderId}:${versionId}`} orderId={orderId} versionId={versionId} userId={user.id} /> : null;
}

function CustomerVersion({ orderId, versionId, userId }: { orderId: string; versionId: string; userId: string }) {
  const [version, setVersion] = useState<InvestigationReviewVersion | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = requireInvestigationResult(await investigationClient.rpc("read_investigation_review", {
          p_order_id: orderId, p_version_id: versionId,
        }).abortSignal(controller.signal));
        const result = investigationReviewVersionSchema.parse(data);
        if (result.id !== versionId || result.order_id !== orderId || result.customer_id !== userId || !result.delivered_at || !result.approved_at) {
          throw new Error("Report version unavailable");
        }
        if (!controller.signal.aborted) setVersion(result);
      } catch { if (!controller.signal.aborted) { setVersion(null); setError(true); } }
    }
    void load();
    return () => controller.abort();
  }, [orderId, versionId, userId]);
  if (error) return <p role="alert">This delivered investigation version could not be loaded. No other report has been opened.</p>;
  if (!version) return <p role="status">Loading your reviewed investigation...</p>;
  return <SharedInvestigationReport version={version} assembly={version.report_assembly} />;
}
