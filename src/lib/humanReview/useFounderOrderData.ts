import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  readFounderOrder,
  readFounderQueue,
  type FounderOrderDetail,
  type FounderQueueSummary,
} from "./founderQueueData";

export function useFounderOrderData(selectedId: string | null) {
  const [orders, setOrders] = useState<FounderQueueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ id: string | null; loading: boolean; order: FounderOrderDetail | null }>({ id: null, loading: false, order: null });
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const queueRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refreshQueue = useCallback(async () => {
    queueRequest.current?.abort();
    const request = new AbortController();
    queueRequest.current = request;
    setLoading(true);
    try {
      const rows = await readFounderQueue(supabase, request.signal);
      if (!mounted.current || request.signal.aborted || queueRequest.current !== request) return;
      setOrders(rows);
    } catch {
      if (!mounted.current || request.signal.aborted || queueRequest.current !== request) return;
      setOrders([]);
      toast.error("Could not load the done-for-you investigation queue.");
    } finally {
      if (mounted.current && !request.signal.aborted && queueRequest.current === request) setLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async (id: string) => {
    if (selectedRef.current !== id) return;
    detailRequest.current?.abort();
    const request = new AbortController();
    detailRequest.current = request;
    setDetail({ id, loading: true, order: null });
    try {
      const order = await readFounderOrder(supabase, id, request.signal);
      if (!mounted.current || request.signal.aborted || detailRequest.current !== request || selectedRef.current !== id) return;
      setDetail({ id, loading: false, order });
    } catch {
      if (!mounted.current || request.signal.aborted || detailRequest.current !== request || selectedRef.current !== id) return;
      setDetail({ id, loading: false, order: null });
      toast.error("Could not load this exact investigation. No other order was opened.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshQueue();
    return () => {
      mounted.current = false;
      queueRequest.current?.abort();
      detailRequest.current?.abort();
    };
  }, [refreshQueue]);

  useEffect(() => {
    detailRequest.current?.abort();
    setDetail({ id: selectedId, loading: Boolean(selectedId), order: null });
    if (selectedId) void refreshDetail(selectedId);
    return () => { detailRequest.current?.abort(); };
  }, [selectedId, refreshDetail]);

  const refresh = useCallback(async () => {
    const id = selectedRef.current;
    await Promise.all([refreshQueue(), ...(id ? [refreshDetail(id)] : [])]);
  }, [refreshQueue, refreshDetail]);

  // A stale result is never renderable, including the render before an effect
  // aborts the previous request. No report body is stored in the queue state.
  const focusedOrder = selectedId && detail.id === selectedId && !detail.loading
    && detail.order?.id.toLowerCase() === selectedId ? detail.order : null;
  const detailLoading = Boolean(selectedId && (detail.id !== selectedId || detail.loading));
  return { orders, loading, focusedOrder, detailLoading, refresh };
}
