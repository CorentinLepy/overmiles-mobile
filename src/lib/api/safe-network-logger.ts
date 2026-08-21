export type NetworkLogEvent = Readonly<{
  method: string;
  route: string;
  status?: number | undefined;
  durationMs: number;
  requestId?: string | undefined;
  outcome: "success" | "http_error" | "network_error" | "timeout";
}>;

export interface NetworkLogger {
  log(event: NetworkLogEvent): void;
}

export const safeNetworkLogger: NetworkLogger = {
  log(event) {
    const normalized = {
      method: event.method,
      route: normalizeRoute(event.route),
      status: event.status,
      durationMs: Math.max(0, Math.round(event.durationMs)),
      requestId: sanitizeRequestId(event.requestId),
      outcome: event.outcome,
    };

    if (__DEV__) {
      console.info("[network]", normalized);
    }
  },
};

export function normalizeRoute(value: string): string {
  try {
    const url = new URL(value, "https://overmiles.invalid");
    return url.pathname.replace(/\/{2,}/g, "/");
  } catch {
    const route = value.split(/[?#]/, 1)[0] ?? "";
    return route.slice(0, 300);
  }
}

function sanitizeRequestId(value?: string): string | undefined {
  if (!value) return undefined;
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
}
