import type { MapCoordinate } from "./map.types";

export type ExternalNavigationPlatform = "ios" | "android";
export type ExternalNavigationProvider = "apple" | "google" | "waze";

export type ExternalNavigationTarget = Readonly<{
  provider: ExternalNavigationProvider;
  label: string;
  probeUrl: string | null;
  appUrl: string | null;
  fallbackUrl: string;
}>;

type ExternalNavigationInput = Readonly<{
  coordinate: MapCoordinate;
  destinationLabel?: string | null;
  platform: ExternalNavigationPlatform;
}>;

export function createExternalNavigationTargets(
  input: ExternalNavigationInput,
): readonly ExternalNavigationTarget[] {
  const coordinate = assertNavigationCoordinate(input.coordinate);
  const coordinateValue = `${coordinate.latitude},${coordinate.longitude}`;
  const encodedCoordinate = encodeURIComponent(coordinateValue);
  const encodedLabel = encodeURIComponent(normalizeDestinationLabel(input.destinationLabel));

  const googleFallback =
    `https://www.google.com/maps/dir/?api=1&destination=${encodedCoordinate}` +
    "&travelmode=driving";
  const wazeFallback =
    `https://waze.com/ul?ll=${encodedCoordinate}` + "&navigate=yes&utm_source=overmiles";

  if (input.platform === "android") {
    return Object.freeze([
      Object.freeze({
        provider: "google" as const,
        label: "Google Maps",
        probeUrl: null,
        appUrl: null,
        fallbackUrl: googleFallback,
      }),
      Object.freeze({
        provider: "waze" as const,
        label: "Waze",
        probeUrl: null,
        appUrl: null,
        fallbackUrl: wazeFallback,
      }),
    ]);
  }

  const appleLabelQuery = encodedLabel ? `&q=${encodedLabel}` : "";

  return Object.freeze([
    Object.freeze({
      provider: "apple" as const,
      label: "Apple Plans",
      probeUrl: "maps://",
      appUrl: `maps://?daddr=${encodedCoordinate}&dirflg=d${appleLabelQuery}`,
      fallbackUrl: `https://maps.apple.com/?daddr=${encodedCoordinate}&dirflg=d${appleLabelQuery}`,
    }),
    Object.freeze({
      provider: "google" as const,
      label: "Google Maps",
      probeUrl: "comgooglemaps://",
      appUrl: `comgooglemaps://?daddr=${encodedCoordinate}&directionsmode=driving`,
      fallbackUrl: googleFallback,
    }),
    Object.freeze({
      provider: "waze" as const,
      label: "Waze",
      probeUrl: "waze://",
      appUrl: `waze://?ll=${encodedCoordinate}&navigate=yes`,
      fallbackUrl: wazeFallback,
    }),
  ]);
}

function assertNavigationCoordinate(coordinate: MapCoordinate): MapCoordinate {
  const { latitude, longitude } = coordinate;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Les coordonnées de navigation sont invalides.");
  }

  return coordinate;
}

function normalizeDestinationLabel(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
