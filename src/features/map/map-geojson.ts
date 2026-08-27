import type { TripMapPoint } from "./map.types";

export type VisitedPointsFeatureCollection = Readonly<{
  type: "FeatureCollection";
  features: readonly Readonly<{
    type: "Feature";
    id: string;
    properties: Readonly<{
      id: string;
      tripId: string;
      tripName: string;
      label: string;
      kind: TripMapPoint["kind"];
      occurredAt: string | null;
    }>;
    geometry: Readonly<{
      type: "Point";
      coordinates: readonly [number, number];
    }>;
  }>[];
}>;

export function createVisitedPointsFeatureCollection(
  points: readonly TripMapPoint[],
): VisitedPointsFeatureCollection {
  return Object.freeze({
    type: "FeatureCollection" as const,
    features: Object.freeze(
      points.map((point) =>
        Object.freeze({
          type: "Feature" as const,
          id: point.id,
          properties: Object.freeze({
            id: point.id,
            tripId: point.tripId,
            tripName: point.tripName,
            label: point.label,
            kind: point.kind,
            occurredAt: point.occurredAt ?? null,
          }),
          geometry: Object.freeze({
            type: "Point" as const,
            coordinates: Object.freeze([
              point.coordinate.longitude,
              point.coordinate.latitude,
            ]) as readonly [number, number],
          }),
        }),
      ),
    ),
  });
}
