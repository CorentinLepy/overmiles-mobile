import { ApiError } from "./api-error";

export type ApiRequestKind = "json" | "media_upload" | "media_download";

const TIMEOUTS_MS: Record<ApiRequestKind, number> = {
  json: 15_000,
  media_upload: 90_000,
  media_download: 90_000,
};

export function timeoutFor(kind: ApiRequestKind): number {
  return TIMEOUTS_MS[kind];
}

export function isIdempotentMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function shouldRetry(method: string, error: ApiError, attempt: number): boolean {
  if (!isIdempotentMethod(method) || attempt >= 2) return false;
  if (error.kind === "network" || error.kind === "timeout") return true;
  return error.kind === "server" && error.retryable;
}

export function retryDelayMs(attempt: number): number {
  const base = Math.min(500 * 2 ** attempt, 2_000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
