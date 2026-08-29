import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTripsData } from "@/src/features/trips/trips-data-provider";
import type { TripSummary } from "@/src/features/trips/trips.types";
import { ApiError } from "@/src/lib/api/api-error";
import { useAuth } from "@/src/providers/auth-provider";

import { createMapStopsRepository } from "./map-stops-repository";
import { createMapTimelineRepository } from "./map-timeline-repository";
import type { MapDataState, TripMapPoint } from "./map.types";

type MapRepositories = Readonly<{
  stops: ReturnType<typeof createMapStopsRepository>;
  timeline: ReturnType<typeof createMapTimelineRepository>;
}>;

type MapLoadResult = Readonly<{
  successfulPoints: readonly TripMapPoint[];
  failures: readonly unknown[];
}>;

type UseMapDataResult = Readonly<{
  state: MapDataState;
  isRefreshing: boolean;
  refresh(): Promise<void>;
}>;

export function useMapData(): UseMapDataResult {
  const { apiClient, status } = useAuth();
  const { trips, isLoading: tripsLoading } = useTripsData();
  const repositories = useMemo<MapRepositories | null>(
    () =>
      apiClient
        ? {
            stops: createMapStopsRepository(apiClient),
            timeline: createMapTimelineRepository(apiClient),
          }
        : null,
    [apiClient],
  );
  const tripsRef = useRef(trips);
  const tripsKey = useMemo(() => createTripsKey(trips), [trips]);
  const loadedTripsKeyRef = useRef<string | null>(null);
  const inFlightTripsKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<MapDataState>({ status: "idle" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  useFocusEffect(
    useCallback(() => {
      if (status !== "authenticated" || !repositories || tripsLoading) return undefined;

      const activeRepositories = repositories;
      const activeTrips = tripsRef.current;
      const activeTripsKey = tripsKey;

      if (
        loadedTripsKeyRef.current === activeTripsKey ||
        inFlightTripsKeyRef.current === activeTripsKey
      ) {
        return undefined;
      }

      let active = true;
      inFlightTripsKeyRef.current = activeTripsKey;
      setState((current) => (current.status === "idle" ? { status: "loading" } : current));

      async function loadFocusedMapData() {
        try {
          if (activeTrips.length === 0) {
            if (active) {
              setState({ status: "ready", points: [] });
              loadedTripsKeyRef.current = activeTripsKey;
            }
            return;
          }

          const result = await collectMapData(activeRepositories, activeTrips);
          if (!active) return;
          setState((current) => stateFromLoadResult(result, current));
          loadedTripsKeyRef.current = activeTripsKey;
        } finally {
          if (inFlightTripsKeyRef.current === activeTripsKey) {
            inFlightTripsKeyRef.current = null;
          }
        }
      }

      void loadFocusedMapData();

      return () => {
        active = false;
      };
    }, [repositories, status, tripsKey, tripsLoading]),
  );

  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !repositories || tripsLoading) return;
    if (inFlightTripsKeyRef.current === tripsKey) return;

    const activeTrips = tripsRef.current;
    const activeTripsKey = tripsKey;
    inFlightTripsKeyRef.current = activeTripsKey;
    setIsRefreshing(true);
    try {
      if (activeTrips.length === 0) {
        setState({ status: "ready", points: [] });
        loadedTripsKeyRef.current = activeTripsKey;
        return;
      }

      const result = await collectMapData(repositories, activeTrips);
      setState((current) => stateFromLoadResult(result, current));
      loadedTripsKeyRef.current = activeTripsKey;
    } finally {
      if (inFlightTripsKeyRef.current === activeTripsKey) {
        inFlightTripsKeyRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, [repositories, status, tripsKey, tripsLoading]);

  return { state, isRefreshing, refresh };
}

function createTripsKey(trips: readonly TripSummary[]): string {
  return trips
    .map((trip) => `${trip.id}:${trip.updatedAt}:${trip.version ?? ""}`)
    .sort()
    .join("|");
}

async function collectMapData(
  repositories: MapRepositories,
  trips: readonly TripSummary[],
): Promise<MapLoadResult> {
  const results = await Promise.allSettled(
    trips.map(async (trip) => {
      const [stops, events] = await Promise.all([
        repositories.stops.listTripStops(trip),
        repositories.timeline.listTripEvents(trip),
      ]);
      return [...stops, ...events] as readonly TripMapPoint[];
    }),
  );

  return {
    successfulPoints: deduplicatePoints(
      results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    ),
    failures: results.flatMap((result) =>
      result.status === "rejected" ? [result.reason as unknown] : [],
    ),
  };
}

function stateFromLoadResult(result: MapLoadResult, current: MapDataState): MapDataState {
  if (result.failures.length === 0) {
    return { status: "ready", points: result.successfulPoints };
  }

  const retained =
    result.successfulPoints.length > 0 ? result.successfulPoints : pointsFromState(current);
  return result.failures.every(isOfflineFailure)
    ? { status: "offline", points: retained }
    : {
        status: "error",
        message: userMessageForFailures(result.failures),
        points: retained,
      };
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
