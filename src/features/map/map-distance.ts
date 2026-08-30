import type { MapCoordinate } from "./map.types";

const EARTH_RADIUS_METERS = 6_371_008.8;

export function calculateMapDistanceMeters(
  from: MapCoordinate,
  to: MapCoordinate,
): number | null {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) return null;

  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  return EARTH_RADIUS_METERS * angularDistance;
}

export function formatMapDistance(distanceMeters: number): string | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;

  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const distanceKilometers = distanceMeters / 1_000;
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: distanceKilometers < 10 ? 1 : 0,
  }).format(distanceKilometers)} km`;
}

function isValidCoordinate(coordinate: MapCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
