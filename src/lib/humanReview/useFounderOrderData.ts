import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  readFounderOrder,
  readFounderQueue,
  type FounderOrderDetail,
  type FounderQueueSummary,
} from "./founderQueueData";

export function useFounderOrderData(selectedId: string | null) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [queue, setQueue] = useState<{ userId: string | null; loading: boolean; error: boolean; orders: FounderQueueSummary[] }>({ userId: null, loading: true, error: false, orders: [] });
  const [detail, setDetail] = useState<{ userId: string | null; id: string | null; loading: boolean; order: FounderOrderDetail | null }>({ userId: null, id: null, loading: false, order: null });
  const userRef = useRef(userId);
  userRef.current = userId;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const queueRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refreshQueue = useCallback(async () => {
    if (!userId || userRef.current !== userId) return;
    queueRequest.current?.abort();
    const request = new AbortController();
    queueRequest.current = request;
    setQueue({ userId, loading: true, error: false, orders: [] });
    try {
      const rows = await readFounderQueue(supabase, request.signal);
      if (!mounted.current || request.signal.aborted || queueRequest.current !== request || userRef.current !== userId) return;
      setQueue({ userId, loading: false, error: false, orders: rows });
    } catch {
      if (!mounted.current || request.signal.aborted || queueRequest.current !== request || userRef.current !== userId) return;
      setQueue({ userId, loading: false, error: true, orders: [] });
      detailRequest.current?.abort();
      setDetail({ userId, id: selectedRef.current, loading: false, order: null });
      toast.error("Could not load the done-for-you investigation queue.");
    }
  }, [userId]);

  const refreshDetail = useCallback(async (id: string) => {
    if (!userId || userRef.current !== userId || selectedRef.current !== id) return;
    detailRequest.current?.abort();
    const request = new AbortController();
    detailRequest.current = request;
    setDetail({ userId, id, loading: true, order: null });
    try {
      const order = await readFounderOrder(supabase, id, request.signal);
      if (!mounted.current || request.signal.aborted || detailRequest.current !== request || selectedRef.current !== id || userRef.current !== userId) return;
      setDetail({ userId, id, loading: false, order });
    } catch {
      if (!mounted.current || request.signal.aborted || detailRequest.current !== request || selectedRef.current !== id || userRef.current !== userId) return;
      setDetail({ userId, id, loading: false, order: null });
      toast.error("Could not load this exact investigation. No other order was opened.");
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    setQueue({ userId, loading: Boolean(userId), error: false, orders: [] });
    void refreshQueue();
    return () => {
      mounted.current = false;
      queueRequest.current?.abort();
      detailRequest.current?.abort();
    };
  }, [refreshQueue, userId]);

  useEffect(() => {
    detailRequest.current?.abort();
    setDetail({ userId, id: selectedId, loading: Boolean(userId && selectedId), order: null });
    if (selectedId) void refreshDetail(selectedId);
    return () => { detailRequest.current?.abort(); };
  }, [selectedId, refreshDetail, userId]);

  const refresh = useCallback(async () => {
    const id = selectedRef.current;
    await Promise.all([refreshQueue(), ...(id ? [refreshDetail(id)] : [])]);
  }, [refreshQueue, refreshDetail]);

  // A stale result is never renderable, including the render before an effect
  // aborts the previous request. No report body is stored in the queue state.
  const focusedOrder = userId && detail.userId === userId && selectedId && detail.id === selectedId && !detail.loading
    && detail.order?.id.toLowerCase() === selectedId ? detail.order : null;
  const detailLoading = Boolean(selectedId && (authLoading || (userId && (detail.userId !== userId || detail.id !== selectedId || detail.loading))));
  const orders = userId && queue.userId === userId ? queue.orders : [];
  const loading = authLoading || Boolean(userId && (queue.userId !== userId || queue.loading));
  const queueError = Boolean(userId && queue.userId === userId && queue.error);
  return { orders, loading, queueError, focusedOrder: queueError ? null : focusedOrder, detailLoading, refresh };
}
