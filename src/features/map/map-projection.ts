import type { MapCoordinate, MapSourcePoint, TripMapPoint, VisitedPlace } from "./map.types";

export function createMapCoordinate(
  latitude: number | string,
  longitude: number | string,
): MapCoordinate | null {
  const normalizedLatitude = normalizeCoordinateValue(latitude);
  const normalizedLongitude = normalizeCoordinateValue(longitude);

  if (
    normalizedLatitude === null ||
    normalizedLongitude === null ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90 ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    return null;
  }

  return Object.freeze({
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
  });
}

export function projectTripMapPoints(points: readonly MapSourcePoint[]): readonly TripMapPoint[] {
  return points.flatMap((point) => {
    const coordinate = createMapCoordinate(point.latitude, point.longitude);
    if (!coordinate) return [];

    return [
      Object.freeze({
        id: point.id,
        tripId: point.tripId,
        tripName: point.tripName,
        label: point.label,
        coordinate,
        kind: point.kind,
        occurredAt: point.occurredAt ?? null,
        visited: true as const,
      }),
    ];
  });
}

export function groupVisitedPlaces(
  points: readonly TripMapPoint[],
  precision = 3,
): readonly VisitedPlace[] {
  const safePrecision = Math.max(1, Math.min(Math.trunc(precision), 6));
  const grouped = new Map<
    string,
    {
      coordinate: MapCoordinate;
      label: string;
      latestVisitAt: string | null;
      count: number;
      tripIds: Set<string>;
    }
  >();

  for (const point of points) {
    const key = coordinateBucketKey(point.coordinate, safePrecision);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        coordinate: point.coordinate,
        label: point.label,
        latestVisitAt: point.occurredAt ?? null,
        count: 1,
        tripIds: new Set([point.tripId]),
      });
      continue;
    }

    existing.count += 1;
    existing.tripIds.add(point.tripId);
    existing.latestVisitAt = latestIso(existing.latestVisitAt, point.occurredAt ?? null);
  }

  return [...grouped.entries()].map(([id, value]) =>
    Object.freeze({
      id,
      label: value.label,
      coordinate: value.coordinate,
      visitCount: value.count,
      latestVisitAt: value.latestVisitAt,
      tripIds: Object.freeze([...value.tripIds]),
    }),
  );
}

function normalizeCoordinateValue(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.trim();
  if (!normalized) return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function coordinateBucketKey(coordinate: MapCoordinate, precision: number): string {
  return `${coordinate.latitude.toFixed(precision)},${coordinate.longitude.toFixed(precision)}`;
}

function latestIso(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
}
