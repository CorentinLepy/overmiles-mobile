import type { TripMapPoint } from "./map.types";

export type VisitedPointsFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: {
      id: string;
      tripId: string;
      tripName: string;
      label: string;
      kind: TripMapPoint["kind"];
      occurredAt: string | null;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }[];
};

export function createVisitedPointsFeatureCollection(
  points: readonly TripMapPoint[],
): VisitedPointsFeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      id: point.id,
      properties: {
        id: point.id,
        tripId: point.tripId,
        tripName: point.tripName,
        label: point.label,
        kind: point.kind,
        occurredAt: point.occurredAt ?? null,
      },
      geometry: {
        type: "Point",
        coordinates: [point.coordinate.longitude, point.coordinate.latitude],
      },
    })),
  };
}
