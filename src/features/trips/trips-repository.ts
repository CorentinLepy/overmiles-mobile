import type { ApiClient } from "@/src/lib/api/api-client";

import { localTripsStore, type LocalTripsStore } from "./local-trips-store";
import type { TripSummary } from "./trips.types";

export type TripsRepository = Readonly<{
  listCached(): Promise<TripSummary[]>;
  refresh(): Promise<TripSummary[]>;
  getCachedById(tripId: string): Promise<TripSummary | null>;
  getById(tripId: string): Promise<TripSummary>;
}>;

export function createTripsRepository(
  apiClient: ApiClient,
  accountUserId: string,
  localStore: LocalTripsStore = localTripsStore,
): TripsRepository {
  return {
    listCached() {
      return localStore.list(accountUserId);
    },

    async refresh() {
      const remoteTrips = await apiClient.request<TripSummary[]>({
        path: "/trips",
        method: "GET",
        kind: "json",
        auth: "required",
      });
      await localStore.replaceAll(accountUserId, remoteTrips);
      return localStore.list(accountUserId);
    },

    getCachedById(tripId: string) {
      return localStore.getById(accountUserId, tripId);
    },

    async getById(tripId: string) {
      const remoteTrip = await apiClient.request<TripSummary>({
        path: `/trips/${encodeURIComponent(tripId)}`,
        method: "GET",
        kind: "json",
        auth: "required",
      });
      await localStore.upsert(accountUserId, remoteTrip);
      return (await localStore.getById(accountUserId, tripId)) ?? remoteTrip;
    },
  };
}
