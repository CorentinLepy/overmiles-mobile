import type { ApiClient } from "@/src/lib/api/api-client";
import { localDataSessionGuard } from "@/src/lib/storage/local-data-session-guard";

import { localMapStore, type LocalMapStore } from "./local-map-store";
import { projectTripMapPoints } from "./map-projection";
import { runMapSourceFlight } from "./map-source-flight";
import type { TripMapPoint } from "./map.types";

type TripIdentity = Readonly<{
  id: string;
  name: string;
  version?: number;
  updatedAt?: string;
}>;

type TimelineEventResponse = Readonly<{
  id: string;
  tripId: string;
  title: string;
  occurredAt: string;
  latitude: number | string | null;
  longitude: number | string | null;
}>;

export type MapTimelineRepository = Readonly<{
  listCachedTripEvents(trip: TripIdentity): Promise<readonly TripMapPoint[]>;
  listTripEvents(trip: TripIdentity): Promise<readonly TripMapPoint[]>;
}>;

export function createMapTimelineRepository(
  apiClient: ApiClient,
  accountUserId: string,
  localStore: LocalMapStore = localMapStore,
): MapTimelineRepository {
  return {
    listCachedTripEvents(trip: TripIdentity) {
      return localStore.list(accountUserId, trip.id, "timeline");
    },

    listTripEvents(trip: TripIdentity): Promise<readonly TripMapPoint[]> {
      return runMapSourceFlight(
        {
          accountUserId,
          tripId: trip.id,
          kind: "timeline",
          tripVersion: trip.version ?? null,
          tripUpdatedAt: trip.updatedAt ?? null,
        },
        async () => {
          const writeToken = localDataSessionGuard.capture();
          const canPersist = () => localDataSessionGuard.canCommit(writeToken);
          const events = await apiClient.request<TimelineEventResponse[]>({
            path: `/trips/${encodeURIComponent(trip.id)}/events`,
            kind: "json",
            auth: "required",
          });

          const points = projectTripMapPoints(
            events.flatMap((event) => {
              if (event.tripId !== trip.id || event.latitude === null || event.longitude === null) {
                return [];
              }

              return [
                {
                  id: event.id,
                  tripId: trip.id,
                  tripName: trip.name,
                  label: event.title,
                  latitude: event.latitude,
                  longitude: event.longitude,
                  kind: "timeline" as const,
                  occurredAt: event.occurredAt,
                },
              ];
            }),
          );

          await localStore.replaceTripKind(accountUserId, trip.id, "timeline", points, canPersist, {
            tripVersion: trip.version ?? null,
            tripUpdatedAt: trip.updatedAt ?? null,
          });
          return points;
        },
      );
    },
  };
}
