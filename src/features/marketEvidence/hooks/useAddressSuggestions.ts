import { useEffect, useRef, useState } from "react";
import {
  ADDRESS_SUGGESTION_MIN_QUERY_LENGTH,
  forwardGeocodeAddressCandidates,
} from "../addressIntelligence";
import type { AddressCandidate } from "../types";

export const ADDRESS_SUGGESTION_DEBOUNCE_MS = 350;

interface UseAddressSuggestionsOptions {
  near?: { lat: number; lng: number } | null;
  enabled?: boolean;
  debounceMs?: number;
}

export function useAddressSuggestions(
  query: string,
  options: UseAddressSuggestionsOptions = {},
) {
  const { near = null, enabled = true, debounceMs = ADDRESS_SUGGESTION_DEBOUNCE_MS } = options;
  const [suggestions, setSuggestions] = useState<AddressCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const lat = near?.lat ?? null;
  const lng = near?.lng ?? null;

  useEffect(() => {
    const text = query.trim();
    if (!enabled || text.length < ADDRESS_SUGGESTION_MIN_QUERY_LENGTH) {
      requestId.current += 1;
      setLoading(false);
      setSuggestions([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const id = (requestId.current += 1);
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      void forwardGeocodeAddressCandidates(text, {
        near: lat != null && lng != null ? { lat, lng } : null,
        signal: controller.signal,
      })
        .then((next) => {
          if (id !== requestId.current) return;
          setSuggestions(next);
        })
        .catch((requestError: unknown) => {
          if (id !== requestId.current || controller.signal.aborted) return;
          setSuggestions([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Address suggestions are temporarily unavailable.",
          );
        })
        .finally(() => {
          if (id !== requestId.current) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, enabled, lat, lng, query]);

  return { suggestions, loading, error };
}

export default useAddressSuggestions;
