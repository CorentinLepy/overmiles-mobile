export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "validation"
  | "conflict"
  | "not_found"
  | "server"
  | "network"
  | "timeout";

export type ApiErrorDetails = Readonly<{
  kind: ApiErrorKind;
  status: number;
  code?: string | undefined;
  retryAfterMs?: number | undefined;
  retryable: boolean;
  userMessage: string;
}>;

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfterMs: number | undefined;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(details: ApiErrorDetails) {
    super(details.userMessage);
    this.name = "ApiError";
    this.kind = details.kind;
    this.status = details.status;
    this.code = details.code;
    this.retryAfterMs = details.retryAfterMs;
    this.retryable = details.retryable;
    this.userMessage = details.userMessage;
  }
}

export type ApiErrorBody = Readonly<{
  code?: unknown;
  message?: unknown;
}>;

export function mapHttpError(status: number, body: ApiErrorBody, retryAfterHeader?: string | null): ApiError {
  const code = typeof body.code === "string" && body.code.length <= 120 ? body.code : undefined;
  const retryAfterMs = status === 429 ? parseRetryAfter(retryAfterHeader) : undefined;

  if (status === 401) {
    return new ApiError({ kind: "unauthorized", status, code, retryable: false, userMessage: "Votre session doit être renouvelée." });
  }
  if (status === 403) {
    return new ApiError({ kind: "forbidden", status, code, retryable: false, userMessage: "Cette action n’est pas autorisée." });
  }
  if (status === 404) {
    return new ApiError({ kind: "not_found", status, code, retryable: false, userMessage: "La ressource demandée est introuvable." });
  }
  if (status === 409) {
    return new ApiError({ kind: "conflict", status, code, retryable: false, userMessage: "Les données ont changé. Actualisez puis réessayez." });
  }
  if (status === 422 || status === 400) {
    return new ApiError({ kind: "validation", status, code, retryable: false, userMessage: "Certaines données envoyées sont invalides." });
  }
  if (status === 429) {
    return new ApiError({ kind: "rate_limited", status, code, retryAfterMs, retryable: true, userMessage: "Trop de tentatives. Réessayez dans un instant." });
  }

  return new ApiError({
    kind: "server",
    status,
    code,
    retryable: status === 502 || status === 503 || status === 504,
    userMessage: "Le service OVERMILES est temporairement indisponible.",
  });
}

export function networkError(): ApiError {
  return new ApiError({ kind: "network", status: 0, retryable: true, userMessage: "Connexion réseau indisponible." });
}

export function timeoutError(): ApiError {
  return new ApiError({ kind: "timeout", status: 0, retryable: true, userMessage: "La requête a expiré. Réessayez." });
}

function parseRetryAfter(value?: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60 * 60 * 1000);

  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.min(date - Date.now(), 60 * 60 * 1000));
}
