export type AppEnvironment = "development" | "preview" | "production";

const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type PublicRuntimeConfig = Readonly<{
  appEnvironment: AppEnvironment;
  apiBaseUrl: string | null;
  mapStyleUrl: string;
  isValid: boolean;
  errors: readonly string[];
}>;

const VALID_ENVIRONMENTS = new Set<AppEnvironment>(["development", "preview", "production"]);

function isAllowedDevelopmentHost(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "10.0.2.2" ||
    url.hostname.endsWith(".local")
  );
}

export function readPublicRuntimeConfig(): PublicRuntimeConfig {
  const errors: string[] = [];
  const rawEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
  const appEnvironment = VALID_ENVIRONMENTS.has(rawEnvironment as AppEnvironment)
    ? (rawEnvironment as AppEnvironment)
    : "development";

  if (!VALID_ENVIRONMENTS.has(rawEnvironment as AppEnvironment)) {
    errors.push(`EXPO_PUBLIC_APP_ENV non supporté: ${rawEnvironment}`);
  }

  const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  let apiBaseUrl: string | null = null;

  if (!rawApiBaseUrl) {
    errors.push("EXPO_PUBLIC_API_BASE_URL est absente.");
  } else {
    try {
      const parsed = new URL(rawApiBaseUrl);
      const secure = parsed.protocol === "https:";
      const developmentException =
        appEnvironment === "development" &&
        parsed.protocol === "http:" &&
        isAllowedDevelopmentHost(parsed);

      if (!secure && !developmentException) {
        errors.push("L’API doit utiliser HTTPS hors hôte local de développement.");
      } else {
        apiBaseUrl = parsed.toString().replace(/\/$/, "");
      }
    } catch {
      errors.push("EXPO_PUBLIC_API_BASE_URL n’est pas une URL valide.");
    }
  }

  if (appEnvironment === "production" && apiBaseUrl !== "https://overmiles.app/api/v1") {
    errors.push("La production doit cibler https://overmiles.app/api/v1.");
  }

  const mapStyleUrl = readMapStyleUrl(process.env.EXPO_PUBLIC_MAP_STYLE_URL, errors);

  return Object.freeze({
    appEnvironment,
    apiBaseUrl,
    mapStyleUrl,
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

function readMapStyleUrl(rawValue: string | undefined, errors: string[]): string {
  const candidate = rawValue?.trim() || DEFAULT_MAP_STYLE_URL;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") {
      errors.push("Le style cartographique mobile doit utiliser HTTPS.");
      return DEFAULT_MAP_STYLE_URL;
    }
    return parsed.toString();
  } catch {
    errors.push("EXPO_PUBLIC_MAP_STYLE_URL n’est pas une URL valide.");
    return DEFAULT_MAP_STYLE_URL;
  }
}
