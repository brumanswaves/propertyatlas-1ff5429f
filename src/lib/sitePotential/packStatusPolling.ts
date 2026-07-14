export interface SitePotentialPackStatusPollerOptions<TStatus> {
  intervalMs: number;
  readStatus: (signal: AbortSignal) => Promise<TStatus | null>;
  shouldContinue: (status: TStatus | null) => boolean;
  onStatus?: (status: TStatus) => void;
  onError?: (error: unknown) => void;
}

export function createSitePotentialPackStatusPoller<TStatus>(
  options: SitePotentialPackStatusPollerOptions<TStatus>,
) {
  let interval: ReturnType<typeof setInterval> | null = null;
  let controller: AbortController | null = null;
  let inFlight = false;
  let stopped = true;

  const stop = () => {
    stopped = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    controller?.abort();
    controller = null;
  };

  const tick = () => {
    if (stopped || inFlight) return;
    controller = new AbortController();
    inFlight = true;
    void options
      .readStatus(controller.signal)
      .then((status) => {
        if (stopped || !status) return;
        options.onStatus?.(status);
        if (!options.shouldContinue(status)) stop();
      })
      .catch((error) => {
        if (!controller?.signal.aborted) options.onError?.(error);
      })
      .finally(() => {
        inFlight = false;
        controller = null;
      });
  };

  const start = (immediate = true) => {
    if (!stopped) return;
    stopped = false;
    if (immediate) tick();
    interval = setInterval(tick, options.intervalMs);
  };

  return { start, stop };
}
