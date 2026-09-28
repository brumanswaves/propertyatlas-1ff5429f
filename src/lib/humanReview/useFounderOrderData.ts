import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  isFullFounderOrderId,
  readFounderOrder,
  readFounderQueue,
  type FounderOrderDetail,
  type FounderQueueSummary,
} from "./founderQueueData";

// undefined is unresolved; null alone explicitly selects the queue overview.
// Invalid strings fail closed, rather than becoming a broad queue request.
export function useFounderOrderData(selectedId: string | null | undefined, assignedOnly = false) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const lifetime = useMemo(
    () => ({ userId, assignedOnly, selectedId, authLoading }),
    [userId, assignedOnly, selectedId, authLoading],
  );
  const current = useRef(lifetime);
  current.current = lifetime;
  const [queue, setQueue] = useState<{
    lifetime: typeof lifetime;
    loading: boolean;
    error: boolean;
    orders: FounderQueueSummary[];
  } | null>(null);
  const [detail, setDetail] = useState<{
    lifetime: typeof lifetime;
    loading: boolean;
    error: boolean;
    order: FounderOrderDetail | null;
  } | null>(null);
  const queueRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const pendingDetailLifetime = useRef<typeof lifetime | null>(null);
  const mounted = useRef(false);
  const exact = typeof selectedId === "string" && isFullFounderOrderId(selectedId);

  const refreshQueue = useCallback(async () => {
    if (
      !mounted.current ||
      current.current !== lifetime ||
      authLoading ||
      !userId ||
      selectedId !== null
    )
      return;
    queueRequest.current?.abort();
    const request = new AbortController();
    queueRequest.current = request;
    setQueue({ lifetime, loading: true, error: false, orders: [] });
    const active = () =>
      mounted.current &&
      current.current === lifetime &&
      !request.signal.aborted &&
      queueRequest.current === request;
    try {
      const rows = await readFounderQueue(supabase, request.signal, assignedOnly);
      if (active()) setQueue({ lifetime, loading: false, error: false, orders: rows });
    } catch {
      if (!active()) return;
      setQueue({ lifetime, loading: false, error: true, orders: [] });
      toast.error("Could not load the done-for-you investigation queue.");
    }
  }, [lifetime, authLoading, userId, selectedId, assignedOnly]);

  const refreshDetail = useCallback(async () => {
    if (
      !mounted.current ||
      current.current !== lifetime ||
      authLoading ||
      !userId ||
      !exact ||
      typeof selectedId !== "string"
    )
      return;
    // Coalesce repeated clicks/callbacks before React renders the pending state.
    if (pendingDetailLifetime.current === lifetime && !detailRequest.current?.signal.aborted)
      return;
    detailRequest.current?.abort();
    const request = new AbortController();
    detailRequest.current = request;
    pendingDetailLifetime.current = lifetime;
    setDetail({ lifetime, loading: true, error: false, order: null });
    const active = () =>
      mounted.current &&
      current.current === lifetime &&
      !request.signal.aborted &&
      detailRequest.current === request;
    try {
      const order = await readFounderOrder(supabase, selectedId, request.signal, assignedOnly);
      if (active()) setDetail({ lifetime, loading: false, error: false, order });
    } catch {
      if (!active()) return;
      setDetail({ lifetime, loading: false, error: true, order: null });
      toast.error("Could not load this exact investigation. No other order was opened.");
    } finally {
      if (detailRequest.current === request) pendingDetailLifetime.current = null;
    }
  }, [lifetime, authLoading, userId, exact, selectedId, assignedOnly]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueRequest.current?.abort();
      detailRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (selectedId === null) void refreshQueue();
    else if (exact) void refreshDetail();
    return () => {
      queueRequest.current?.abort();
      detailRequest.current?.abort();
    };
  }, [selectedId, exact, refreshQueue, refreshDetail]);

  const refresh = useCallback(async () => {
    if (selectedId === null) await refreshQueue();
    else if (exact) await refreshDetail();
  }, [selectedId, exact, refreshQueue, refreshDetail]);
  const currentQueue = selectedId === null && queue?.lifetime === lifetime ? queue : null;
  const currentDetail = exact && detail?.lifetime === lifetime ? detail : null;
  const focusedOrder =
    !authLoading &&
    userId &&
    currentDetail &&
    !currentDetail.loading &&
    currentDetail?.order?.id.toLowerCase() === selectedId
      ? currentDetail.order
      : null;
  return {
    orders: currentQueue?.orders ?? [],
    loading:
      selectedId === null &&
      (authLoading || Boolean(userId && (!currentQueue || currentQueue.loading))),
    queueError: currentQueue?.error ?? false,
    focusedOrder,
    detailError: currentDetail?.error ?? false,
    detailLoading:
      exact && (authLoading || Boolean(userId && (!currentDetail || currentDetail.loading))),
    refresh,
  };
}
