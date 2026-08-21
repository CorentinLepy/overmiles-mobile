import { fetch } from "expo/fetch";
import {
  ApiError,
  mapHttpError,
  networkError,
  timeoutError,
  type ApiErrorBody,
} from "./api-error";
import {
  isIdempotentMethod,
  retryDelayMs,
  shouldRetry,
  sleep,
  timeoutFor,
  type ApiRequestKind,
} from "./request-policy";
import { safeNetworkLogger, type NetworkLogger } from "./safe-network-logger";
import type { AuthSessionManager } from "../auth/auth-session-manager";

export type ApiMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiAuthMode = "required" | "optional" | "none";

export type ApiRequest = Readonly<{
  path: string;
  method?: ApiMethod;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  kind?: ApiRequestKind;
  auth?: ApiAuthMode;
  /** Explicit opt-in for replay after a 401 on non-GET/HEAD requests. */
  allowAuthReplay?: boolean;
}>;

export interface ApiClient {
  request<TResponse>(request: ApiRequest): Promise<TResponse>;
}

export type ApiClientOptions = Readonly<{
  baseUrl: string;
  auth: AuthSessionManager;
  logger?: NetworkLogger;
}>;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const logger = options.logger ?? safeNetworkLogger;

  return {
    request<TResponse>(request: ApiRequest): Promise<TResponse> {
      return execute<TResponse>(request, false, 0);
    },
  };

  async function execute<TResponse>(
    request: ApiRequest,
    authReplayed: boolean,
    retryAttempt: number,
  ): Promise<TResponse> {
    const method = request.method ?? "GET";
    const authMode = request.auth ?? "required";
    const url = buildUrl(baseUrl, request.path);
    const controller = new AbortController();
    const timeoutMs = timeoutFor(request.kind ?? "json");
    const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
    const startedAt = Date.now();
    const abortFromCaller = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const accessToken = await resolveAccessToken(authMode, options.auth);
      const headers = new Headers(request.headers);
      headers.set("Accept", "application/json");
      if (request.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

      const body = request.body === undefined ? null : JSON.stringify(request.body);
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;
      const requestId = response.headers.get("x-request-id") ?? undefined;

      if (response.ok) {
        logger.log({
          method,
          route: url,
          status: response.status,
          durationMs,
          requestId,
          outcome: "success",
        });
        if (response.status === 204) return undefined as TResponse;
        return (await readJson(response)) as TResponse;
      }

      if (
        response.status === 401 &&
        authMode === "required" &&
        !authReplayed &&
        (isIdempotentMethod(method) || request.allowAuthReplay === true)
      ) {
        await options.auth.refresh();
        return execute<TResponse>(request, true, retryAttempt);
      }

      const errorBody = (await readJson(response)) as ApiErrorBody;
      const error = mapHttpError(
        response.status,
        errorBody,
        response.headers.get("retry-after"),
      );
      logger.log({
        method,
        route: url,
        status: response.status,
        durationMs,
        requestId,
        outcome: "http_error",
      });

      if (shouldRetry(method, error, retryAttempt)) {
        await sleep(retryDelayMs(retryAttempt));
        return execute<TResponse>(request, authReplayed, retryAttempt + 1);
      }
      throw error;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const timedOut = controller.signal.aborted && controller.signal.reason === "timeout";
      const mapped = timedOut ? timeoutError() : networkError();
      logger.log({
        method,
        route: url,
        durationMs: Date.now() - startedAt,
        outcome: timedOut ? "timeout" : "network_error",
      });

      if (shouldRetry(method, mapped, retryAttempt)) {
        await sleep(retryDelayMs(retryAttempt));
        return execute<TResponse>(request, authReplayed, retryAttempt + 1);
      }
      throw mapped;
    } finally {
      clearTimeout(timeoutId);
      request.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

async function resolveAccessToken(
  mode: ApiAuthMode,
  auth: AuthSessionManager,
): Promise<string | null> {
  if (mode === "none") return null;
  if (mode === "optional") return auth.getAccessToken();
  return auth.getOrRefreshAccessToken();
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return {};
  return response.json().catch(() => ({}));
}

function buildUrl(baseUrl: string, path: string): string {
  if (!path.startsWith("/")) throw new Error("ApiRequest.path doit commencer par '/'.");
  if (/^\/\//.test(path)) throw new Error("ApiRequest.path ne peut pas redéfinir l’hôte API.");
  return `${baseUrl}${path}`;
}

function validateBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !isLocalDevelopmentUrl(parsed)) {
    throw new Error("La couche réseau refuse une API non HTTPS hors développement local.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function isLocalDevelopmentUrl(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "10.0.2.2" ||
      url.hostname.endsWith(".local"))
  );
}
