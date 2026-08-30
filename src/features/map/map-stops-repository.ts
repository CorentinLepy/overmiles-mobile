import type { ApiClient } from "@/src/lib/api/api-client";
import { localDataSessionGuard } from "@/src/lib/storage/local-data-session-guard";

import { localMapStore, type LocalMapStore } from "./local-map-store";
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
  listCachedTripStops(trip: TripIdentity): Promise<readonly TripMapPoint[]>;
  listTripStops(trip: TripIdentity): Promise<readonly TripMapPoint[]>;
}>;

export function createMapStopsRepository(
  apiClient: ApiClient,
  accountUserId: string,
  localStore: LocalMapStore = localMapStore,
): MapStopsRepository {
  return {
    listCachedTripStops(trip: TripIdentity) {
      return localStore.list(accountUserId, trip.id, "stop");
    },

    async listTripStops(trip: TripIdentity): Promise<readonly TripMapPoint[]> {
      const writeToken = localDataSessionGuard.capture();
      const canPersist = () => localDataSessionGuard.canCommit(writeToken);
      const stops = await apiClient.request<TripStopResponse[]>({
        path: `/trips/${encodeURIComponent(trip.id)}/stops`,
        kind: "json",
        auth: "required",
      });

      const points = projectTripMapPoints(
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

      await localStore.replaceTripKind(accountUserId, trip.id, "stop", points, canPersist);
      return points;
    },
  };
}
