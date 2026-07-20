export interface ReportPrintLifecycleOptions {
  frameWindow: ReportPrintLifecycleWindow;
  parentWindow: ReportPrintLifecycleEventTarget;
  emergencyCleanupMs: number;
  focusMinimumHoldMs: number;
  now?: () => number;
  onFinish: () => void;
}

export type ReportPrintLifecycleEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export interface ReportPrintLifecycleWindow extends ReportPrintLifecycleEventTarget {
  matchMedia?: Window["matchMedia"];
  setTimeout: Window["setTimeout"];
  clearTimeout: Window["clearTimeout"];
}

export interface ReportPrintLifecycleController {
  register: () => void;
  markPrintStarted: () => void;
  dispose: () => void;
  hasEnteredPrintMedia: () => boolean;
}

type PrintMediaQuery = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

export function createReportPrintLifecycleController({
  frameWindow,
  parentWindow,
  emergencyCleanupMs,
  focusMinimumHoldMs,
  now = () => Date.now(),
  onFinish,
}: ReportPrintLifecycleOptions): ReportPrintLifecycleController {
  const printMedia = frameWindow.matchMedia?.("print") as PrintMediaQuery | null;
  let disposed = false;
  let printStartedAt = 0;
  let printMediaEntered = false;
  let emergencyTimeoutId: number | undefined;

  const finish = () => {
    if (disposed) return;
    onFinish();
  };

  const handleAfterPrint = () => finish();
  const handlePrintMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
    if (event.matches) {
      printMediaEntered = true;
      return;
    }
    if (printMediaEntered) finish();
  };
  const handleParentFocus = () => {
    if (!printStartedAt) return;
    if (printMediaEntered) {
      finish();
      return;
    }
    if (now() - printStartedAt >= focusMinimumHoldMs) finish();
  };

  const addPrintMediaListener = () => {
    if (printMedia?.addEventListener) {
      printMedia.addEventListener("change", handlePrintMediaChange);
    } else {
      printMedia?.addListener?.(handlePrintMediaChange);
    }
  };

  const removePrintMediaListener = () => {
    if (printMedia?.removeEventListener) {
      printMedia.removeEventListener("change", handlePrintMediaChange);
    } else {
      printMedia?.removeListener?.(handlePrintMediaChange);
    }
  };

  return {
    register() {
      addPrintMediaListener();
      frameWindow.addEventListener("afterprint", handleAfterPrint, { once: true });
      parentWindow.addEventListener("focus", handleParentFocus);
      emergencyTimeoutId = frameWindow.setTimeout(finish, emergencyCleanupMs);
    },
    markPrintStarted() {
      printStartedAt = now();
      if (printMedia?.matches) printMediaEntered = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (emergencyTimeoutId !== undefined) frameWindow.clearTimeout(emergencyTimeoutId);
      frameWindow.removeEventListener("afterprint", handleAfterPrint);
      parentWindow.removeEventListener("focus", handleParentFocus);
      removePrintMediaListener();
    },
    hasEnteredPrintMedia() {
      return printMediaEntered;
    },
  };
}
