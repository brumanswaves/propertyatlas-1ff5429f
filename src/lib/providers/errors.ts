// Standardized provider error envelope. Every adapter should throw / return
// ProviderError instead of raw exceptions so the UI can reason about retries.

import type { ProviderId } from "./types";

export type ProviderErrorCode =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "upstream_unavailable"
  | "timeout"
  | "invalid_input"
  | "parse_error"
  | "compliance_blocked"
  | "unknown";

export interface ProviderErrorShape {
  name: "ProviderError";
  provider: ProviderId;
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
  cause?: unknown;
}

export class ProviderError extends Error implements ProviderErrorShape {
  readonly name = "ProviderError" as const;
  readonly provider: ProviderId;
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(init: Omit<ProviderErrorShape, "name">) {
    super(init.message);
    this.provider = init.provider;
    this.code = init.code;
    this.retryable = init.retryable;
    this.status = init.status;
    this.cause = init.cause;
  }

  toJSON(): ProviderErrorShape {
    return {
      name: this.name,
      provider: this.provider,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      status: this.status,
    };
  }
}

const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  "rate_limited",
  "upstream_unavailable",
  "timeout",
]);

export function isProviderError(value: unknown): value is ProviderError {
  return (
    value instanceof ProviderError ||
    (typeof value === "object" &&
      value !== null &&
      (value as { name?: unknown }).name === "ProviderError" &&
      typeof (value as { code?: unknown }).code === "string")
  );
}

export function notConnected(provider: ProviderId, name: string): ProviderError {
  return new ProviderError({
    provider,
    code: "not_configured",
    message: `${name} integration is not configured.`,
    retryable: false,
  });
}

export function defaultRetryable(code: ProviderErrorCode): boolean {
  return RETRYABLE.has(code);
}
