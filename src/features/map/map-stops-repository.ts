import type { ApiClient } from "@/src/lib/api/api-client";

import { projectTripMapPoints } from "./map-projection";
import type { TripMapPoint } from "./map.types";

type TripIdentity = Readonly<{
  id: string;
  name: string;
}>;

type TripStopResponse = Readonly<{
  id: string;
  tripId: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  startsAt?: string | null;
}>;

export type MapStopsRepository = Readonly<{
  listTripStops(trip: TripIdentity): Promise<readonly TripMapPoint[]>;
}>;

export function createMapStopsRepository(apiClient: ApiClient): MapStopsRepository {
  return {
    async listTripStops(trip: TripIdentity): Promise<readonly TripMapPoint[]> {
      const stops = await apiClient.request<TripStopResponse[]>({
        path: `/trips/${encodeURIComponent(trip.id)}/stops`,
        kind: "json",
        auth: "required",
      });

      return projectTripMapPoints(
        stops
          .filter((stop) => stop.tripId === trip.id)
          .map((stop) => ({
            id: stop.id,
            tripId: trip.id,
            tripName: trip.name,
            label: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            kind: "stop" as const,
            occurredAt: stop.startsAt ?? null,
          })),
      );
    },
  };
}
