import type { ApiClient } from "@/src/lib/api/api-client";

import type { TripSummary } from "./trips.types";

export type TripsRepository = Readonly<{
  list(): Promise<TripSummary[]>;
  getById(tripId: string): Promise<TripSummary>;
}>;

export function createTripsRepository(apiClient: ApiClient): TripsRepository {
  return {
    list() {
      return apiClient.request<TripSummary[]>({
        path: "/trips",
        kind: "json",
        auth: "required",
      });
    },

    getById(tripId: string) {
      return apiClient.request<TripSummary>({
        path: `/trips/${encodeURIComponent(tripId)}`,
        kind: "json",
        auth: "required",
      });
    },
  };
}
