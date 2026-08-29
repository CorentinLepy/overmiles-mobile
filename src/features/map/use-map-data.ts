import { usePathname } from "expo-router";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from "react";

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

type MapDataContextValue = Readonly<{
  state: MapDataState;
  isRefreshing: boolean;
  refresh(): Promise<void>;
}>;

type MapRuntimeState = Readonly<{
  data: MapDataState;
  loadedTripsKey: string | null;
  inFlightTripsKey: string | null;
  isRefreshing: boolean;
}>;

type MapRuntimeAction =
  | Readonly<{ type: "load-started"; tripsKey: string; refreshing: boolean }>
  | Readonly<{ type: "load-finished"; tripsKey: string; result: MapLoadResult }>
  | Readonly<{ type: "load-empty"; tripsKey: string }>;

const initialRuntimeState: MapRuntimeState = {
  data: { status: "idle" },
  loadedTripsKey: null,
  inFlightTripsKey: null,
  isRefreshing: false,
};

const MapDataContext = createContext<MapDataContextValue | null>(null);

export function MapDataProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isMapActive = pathname === "/map" || pathname.startsWith("/map/");
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
  const tripsKey = useMemo(() => createTripsKey(trips), [trips]);
  const [runtime, dispatch] = useReducer(mapRuntimeReducer, initialRuntimeState);

  useEffect(() => {
    if (!isMapActive || status !== "authenticated" || !repositories || tripsLoading) return;
    if (runtime.loadedTripsKey === tripsKey || runtime.inFlightTripsKey === tripsKey) return;

    const activeRepositories = repositories;
    const activeTrips = trips;
    const activeTripsKey = tripsKey;
    dispatch({ type: "load-started", tripsKey: activeTripsKey, refreshing: false });

    async function loadActiveMapData() {
      if (activeTrips.length === 0) {
        dispatch({ type: "load-empty", tripsKey: activeTripsKey });
        return;
      }

      const result = await collectMapData(activeRepositories, activeTrips);
      dispatch({ type: "load-finished", tripsKey: activeTripsKey, result });
    }

    void loadActiveMapData();
  }, [
    isMapActive,
    repositories,
    runtime.inFlightTripsKey,
    runtime.loadedTripsKey,
    status,
    trips,
    tripsKey,
    tripsLoading,
  ]);

  const refresh = useCallback(async () => {
    if (!isMapActive || status !== "authenticated" || !repositories || tripsLoading) return;
    if (runtime.inFlightTripsKey === tripsKey) return;

    const activeTrips = trips;
    const activeTripsKey = tripsKey;
    dispatch({ type: "load-started", tripsKey: activeTripsKey, refreshing: true });

    if (activeTrips.length === 0) {
      dispatch({ type: "load-empty", tripsKey: activeTripsKey });
      return;
    }

    const result = await collectMapData(repositories, activeTrips);
    dispatch({ type: "load-finished", tripsKey: activeTripsKey, result });
  }, [isMapActive, repositories, runtime.inFlightTripsKey, status, trips, tripsKey, tripsLoading]);

  const value = useMemo<MapDataContextValue>(
    () => ({ state: runtime.data, isRefreshing: runtime.isRefreshing, refresh }),
    [refresh, runtime.data, runtime.isRefreshing],
  );

  return createElement(MapDataContext.Provider, { value }, children);
}

export function useMapData(): MapDataContextValue {
  const context = useContext(MapDataContext);
  if (!context) {
    throw new Error("useMapData doit être utilisé sous MapDataProvider.");
  }
  return context;
}

function mapRuntimeReducer(state: MapRuntimeState, action: MapRuntimeAction): MapRuntimeState {
  if (action.type === "load-started") {
    return {
      data: state.data.status === "idle" ? { status: "loading" } : state.data,
      loadedTripsKey: state.loadedTripsKey,
      inFlightTripsKey: action.tripsKey,
      isRefreshing: action.refreshing,
    };
  }

  if (state.inFlightTripsKey !== action.tripsKey) {
    return state;
  }

  if (action.type === "load-empty") {
    return {
      data: { status: "ready", points: [] },
      loadedTripsKey: action.tripsKey,
      inFlightTripsKey: null,
      isRefreshing: false,
    };
  }

  return {
    data: stateFromLoadResult(action.result, state.data),
    loadedTripsKey: action.tripsKey,
    inFlightTripsKey: null,
    isRefreshing: false,
  };
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
