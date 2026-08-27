import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/src/lib/api/api-error";
import { useAuth } from "@/src/providers/auth-provider";
import { useTripsData } from "@/src/features/trips/trips-data-provider";

import { createMapStopsRepository } from "./map-stops-repository";
import { createMapTimelineRepository } from "./map-timeline-repository";
import type { MapDataState, TripMapPoint } from "./map.types";

type UseMapDataResult = Readonly<{
  state: MapDataState;
  isRefreshing: boolean;
  refresh(): Promise<void>;
}>;

export function useMapData(): UseMapDataResult {
  const { apiClient, status } = useAuth();
  const { trips, isLoading: tripsLoading } = useTripsData();
  const repositories = useMemo(
    () =>
      apiClient
        ? {
            stops: createMapStopsRepository(apiClient),
            timeline: createMapTimelineRepository(apiClient),
          }
        : null,
    [apiClient],
  );
  const [state, setState] = useState<MapDataState>({ status: "idle" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (refreshing: boolean) => {
      if (status !== "authenticated" || !repositories || tripsLoading) return;

      if (trips.length === 0) {
        setState({ status: "ready", points: [] });
        setIsRefreshing(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setState((current) =>
          current.status === "ready" || current.status === "offline" || current.status === "error"
            ? current
            : { status: "loading" },
        );
      }

      const results = await Promise.allSettled(
        trips.map(async (trip) => {
          const [stops, events] = await Promise.all([
            repositories.stops.listTripStops(trip),
            repositories.timeline.listTripEvents(trip),
          ]);
          return [...stops, ...events] as readonly TripMapPoint[];
        }),
      );

      const successfulPoints = deduplicatePoints(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : [],
      );

      if (failures.length === 0) {
        setState({ status: "ready", points: successfulPoints });
        setIsRefreshing(false);
        return;
      }

      const offline = failures.every(isOfflineFailure);
      setState((current) => {
        const retained = successfulPoints.length > 0 ? successfulPoints : pointsFromState(current);
        return offline
          ? { status: "offline", points: retained }
          : {
              status: "error",
              message: userMessageForFailures(failures),
              points: retained,
            };
      });
      setIsRefreshing(false);
    },
    [repositories, status, trips, tripsLoading],
  );

  useEffect(() => {
    if (status !== "authenticated" || tripsLoading) return;
    void load(false);
  }, [load, status, tripsLoading]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { state, isRefreshing, refresh };
}

function deduplicatePoints(points: readonly TripMapPoint[]): readonly TripMapPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.kind}:${point.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pointsFromState(state: MapDataState): readonly TripMapPoint[] {
  return state.status === "ready" || state.status === "offline" || state.status === "error"
    ? state.points
    : [];
}

function isOfflineFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
}

function userMessageForFailures(errors: readonly unknown[]): string {
  const apiError = errors.find((error): error is ApiError => error instanceof ApiError);
  return apiError?.userMessage ?? "Certaines données de la carte n’ont pas pu être chargées.";
}
