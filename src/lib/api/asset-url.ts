const API_PREFIX = "/api/v1";

export function resolveApiAssetUrl(
  value: string | null | undefined,
  apiBaseUrl: string | null,
): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  if (candidate.startsWith("/")) {
    if (!apiBaseUrl) return null;
    const relativePath = candidate.startsWith(API_PREFIX)
      ? candidate.slice(API_PREFIX.length) || "/"
      : candidate;
    return `${apiBaseUrl}${relativePath}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") return parsed.toString();
    if (parsed.protocol === "http:" && isLocalDevelopmentHost(parsed.hostname)) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "10.0.2.2" ||
    hostname.endsWith(".local")
  );
}
