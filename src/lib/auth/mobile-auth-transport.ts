import { fetch } from "expo/fetch";
import {
  ApiError,
  mapHttpError,
  networkError,
  timeoutError,
  type ApiErrorBody,
} from "../api/api-error";
import type {
  LogoutTransport,
  MobileSessionTokens,
  RefreshTransport,
} from "./auth-session-manager";

const AUTH_TIMEOUT_MS = 10_000;

export type MobileLoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type MobileAuthUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationalityCode: string | null;
  role: string;
}>;

export type MobileLoginResponse = MobileSessionTokens &
  Readonly<{
    user: MobileAuthUser;
    accessTokenExpiresIn: number;
    refreshTokenExpiresAt: string;
    sessionId: string;
  }>;

export type MobileRefreshResponse = MobileSessionTokens &
  Readonly<{
    accessTokenExpiresIn: number;
    refreshTokenExpiresAt: string;
    sessionId: string;
  }>;

export interface MobileAuthTransport {
  login(input: MobileLoginInput): Promise<MobileLoginResponse>;
  refresh: RefreshTransport;
  logout: LogoutTransport;
}

export function createMobileAuthTransport(baseUrl: string): MobileAuthTransport {
  const normalizedBaseUrl = validateBaseUrl(baseUrl);

  return {
    login(input) {
      return postJson<MobileLoginResponse>(normalizedBaseUrl, "/auth/mobile/login", input);
    },
    refresh(refreshToken) {
      return postJson<MobileRefreshResponse>(normalizedBaseUrl, "/auth/mobile/refresh", {
        refreshToken,
      });
    },
    logout(accessToken) {
      return postNoContentWithBearer(normalizedBaseUrl, "/auth/mobile/logout", accessToken);
    },
  };
}

async function postJson<TResponse>(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<TResponse> {
  const response = await authFetch(baseUrl, path, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return (await response.json()) as TResponse;
}

async function postNoContentWithBearer(
  baseUrl: string,
  path: string,
  accessToken: string,
): Promise<void> {
  if (!accessToken) throw new Error("Access Token manquant pour le logout mobile.");

  await authFetch(baseUrl, path, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function authFetch(
  baseUrl: string,
  path: string,
  init: Readonly<{
    headers: Readonly<Record<string, string>>;
    body?: string;
  }>,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw mapHttpError(response.status, errorBody, response.headers.get("retry-after"));
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw timeoutError();
    }
    throw networkError();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return {};
  return response.json().catch(() => ({})) as Promise<ApiErrorBody>;
}

function validateBaseUrl(value: string): string {
  const parsed = new URL(value);
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "10.0.2.2" ||
      parsed.hostname.endsWith(".local"));

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "Le transport d’authentification refuse une API non HTTPS hors développement local.",
    );
  }

  return parsed.toString().replace(/\/$/, "");
}
