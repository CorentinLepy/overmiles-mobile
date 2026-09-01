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

import { localMapStore, type MapSnapshotMetadata } from "./local-map-store";
import {
  createAllMapSources,
  selectStaleMapSources,
  type MapSourceRefresh,
} from "./map-snapshot-freshness";
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
  accountUserId: string | null;
  data: MapDataState;
  loadedTripsKey: string | null;
  inFlightTripsKey: string | null;
  isRefreshing: boolean;
}>;

type MapRuntimeAction =
  | Readonly<{
      type: "load-started";
      accountUserId: string;
      tripsKey: string;
      refreshing: boolean;
    }>
  | Readonly<{ type: "cache-loaded"; tripsKey: string; points: readonly TripMapPoint[] }>
  | Readonly<{ type: "load-finished"; tripsKey: string; result: MapLoadResult }>
  | Readonly<{ type: "load-offline"; tripsKey: string; result: MapLoadResult }>
  | Readonly<{ type: "load-empty"; tripsKey: string; offline: boolean }>
  | Readonly<{ type: "reset" }>;

type MapSourceLoadTask = Readonly<{
  tripId: string;
  kind: "stop" | "timeline";
  load(): Promise<readonly TripMapPoint[]>;
}>;

const initialRuntimeState: MapRuntimeState = {
  accountUserId: null,
  data: { status: "idle" },
  loadedTripsKey: null,
  inFlightTripsKey: null,
  isRefreshing: false,
};

const MapDataContext = createContext<MapDataContextValue | null>(null);

export function MapDataProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isMapActive = pathname === "/map" || pathname.startsWith("/map/");
  const { apiClient, status, user, retryRestore } = useAuth();
  const { trips, isLoading: tripsLoading } = useTripsData();
  const hasLocalContentSession =
    status === "authenticated" || (status === "offline_auth_pending" && user !== null);
  const repositories = useMemo<MapRepositories | null>(
    () =>
      apiClient && user
        ? {
            stops: createMapStopsRepository(apiClient, user.id),
            timeline: createMapTimelineRepository(apiClient, user.id),
          }
        : null,
    [apiClient, user],
  );
  const tripsKey = useMemo(() => createTripsKey(trips), [trips]);
  const loadKey = `${user?.id ?? "anonymous"}:${status}:${tripsKey}`;
  const [runtime, dispatch] = useReducer(mapRuntimeReducer, initialRuntimeState);

  useEffect(() => {
    if (status === "anonymous" || status === "mfa_required") {
      dispatch({ type: "reset" });
    }
  }, [status]);

  useEffect(() => {
    if (!isMapActive || !hasLocalContentSession || !repositories || !user || tripsLoading) return;
    if (runtime.loadedTripsKey === loadKey || runtime.inFlightTripsKey === loadKey) return;

    const activeRepositories = repositories;
    const activeTrips = trips;
    const activeLoadKey = loadKey;
    const activeAccountUserId = user.id;
    const offlineOnly = status === "offline_auth_pending";
    dispatch({
      type: "load-started",
      accountUserId: activeAccountUserId,
      tripsKey: activeLoadKey,
      refreshing: false,
    });

    async function loadActiveMapData() {
      if (activeTrips.length === 0) {
        dispatch({ type: "load-empty", tripsKey: activeLoadKey, offline: offlineOnly });
        return;
      }

      const cachedResult = await collectCachedMapData(activeRepositories, activeTrips);
      if (offlineOnly) {
        dispatch({ type: "load-offline", tripsKey: activeLoadKey, result: cachedResult });
        return;
      }

      if (cachedResult.successfulPoints.length > 0) {
        dispatch({
          type: "cache-loaded",
          tripsKey: activeLoadKey,
          points: cachedResult.successfulPoints,
        });
      }

      const snapshots = await listMapSnapshotsSafe(activeAccountUserId);
      const staleSources = selectStaleMapSources(activeTrips, snapshots);
      const result = await collectRemoteMapData(
        activeRepositories,
        staleSources,
        cachedResult.successfulPoints,
      );
      dispatch({ type: "load-finished", tripsKey: activeLoadKey, result });
    }

    void loadActiveMapData();
  }, [
    hasLocalContentSession,
    isMapActive,
    loadKey,
    repositories,
    runtime.inFlightTripsKey,
    runtime.loadedTripsKey,
    status,
    trips,
    tripsLoading,
    user,
  ]);

  const refresh = useCallback(async () => {
    if (!isMapActive || !hasLocalContentSession || !repositories || !user || tripsLoading) return;
    if (runtime.inFlightTripsKey === loadKey) return;

    const activeTrips = trips;
    const activeLoadKey = loadKey;
    dispatch({
      type: "load-started",
      accountUserId: user.id,
      tripsKey: activeLoadKey,
      refreshing: true,
    });

    if (activeTrips.length === 0) {
      dispatch({
        type: "load-empty",
        tripsKey: activeLoadKey,
        offline: status === "offline_auth_pending",
      });
      if (status === "offline_auth_pending") await retryRestore();
      return;
    }

    const cachedResult = await collectCachedMapData(repositories, activeTrips);
    if (status === "offline_auth_pending") {
      dispatch({ type: "load-offline", tripsKey: activeLoadKey, result: cachedResult });
      await retryRestore();
      return;
    }

    const fallbackPoints = deduplicatePoints([
      ...pointsFromState(runtime.data),
      ...cachedResult.successfulPoints,
    ]);
    const result = await collectRemoteMapData(
      repositories,
      createAllMapSources(activeTrips),
      fallbackPoints,
    );
    dispatch({ type: "load-finished", tripsKey: activeLoadKey, result });
  }, [
    hasLocalContentSession,
    isMapActive,
    loadKey,
    repositories,
    retryRestore,
    runtime.data,
    runtime.inFlightTripsKey,
    status,
    trips,
    tripsLoading,
    user,
  ]);

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
  if (action.type === "reset") return initialRuntimeState;

  if (action.type === "load-started") {
    const sameAccount = state.accountUserId === action.accountUserId;
    return {
      accountUserId: action.accountUserId,
      data: sameAccount && state.data.status !== "idle" ? state.data : { status: "loading" },
      loadedTripsKey: sameAccount ? state.loadedTripsKey : null,
      inFlightTripsKey: action.tripsKey,
      isRefreshing: action.refreshing,
    };
  }

  if (state.inFlightTripsKey !== action.tripsKey) {
    return state;
  }

  if (action.type === "cache-loaded") {
    return {
      ...state,
      data: { status: "ready", points: action.points },
    };
  }

  if (action.type === "load-empty") {
    return {
      ...state,
      data: action.offline ? { status: "offline", points: [] } : { status: "ready", points: [] },
      loadedTripsKey: action.tripsKey,
      inFlightTripsKey: null,
      isRefreshing: false,
    };
  }

  if (action.type === "load-offline") {
    return {
      ...state,
      data: stateFromOfflineCache(action.result),
      loadedTripsKey: action.tripsKey,
      inFlightTripsKey: null,
      isRefreshing: false,
    };
  }

  return {
    ...state,
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

function createCachedTasks(
  repositories: MapRepositories,
  trips: readonly TripSummary[],
): MapSourceLoadTask[] {
  return trips.flatMap((trip) => [
    {
      tripId: trip.id,
      kind: "stop" as const,
      load: () => repositories.stops.listCachedTripStops(trip),
    },
    {
      tripId: trip.id,
      kind: "timeline" as const,
      load: () => repositories.timeline.listCachedTripEvents(trip),
    },
  ]);
}

function createRemoteTasks(
  repositories: MapRepositories,
  sources: readonly MapSourceRefresh[],
): MapSourceLoadTask[] {
  return sources.map(({ trip, kind }) =>
    kind === "stop"
      ? {
          tripId: trip.id,
          kind,
          load: () => repositories.stops.listTripStops(trip),
        }
      : {
          tripId: trip.id,
          kind,
          load: () => repositories.timeline.listTripEvents(trip),
        },
  );
}

function collectCachedMapData(
  repositories: MapRepositories,
  trips: readonly TripSummary[],
): Promise<MapLoadResult> {
  return collectMapTasks(createCachedTasks(repositories, trips), []);
}

async function collectRemoteMapData(
  repositories: MapRepositories,
  sources: readonly MapSourceRefresh[],
  fallbackPoints: readonly TripMapPoint[],
): Promise<MapLoadResult> {
  if (sources.length === 0) {
    return { successfulPoints: fallbackPoints, failures: [] };
  }

  const sourceKeys = new Set(sources.map(({ trip, kind }) => `${trip.id}:${kind}`));
  const retainedFreshPoints = fallbackPoints.filter(
    (point) => !sourceKeys.has(`${point.tripId}:${point.kind}`),
  );
  const refreshed = await collectMapTasks(createRemoteTasks(repositories, sources), fallbackPoints);
  return {
    successfulPoints: deduplicatePoints([...retainedFreshPoints, ...refreshed.successfulPoints]),
    failures: refreshed.failures,
  };
}

async function collectMapTasks(
  tasks: readonly MapSourceLoadTask[],
  fallbackPoints: readonly TripMapPoint[],
): Promise<MapLoadResult> {
  const results = await Promise.all(
    tasks.map(async (task) => {
      try {
        return {
          points: await task.load(),
          failure: null,
        } as const;
      } catch (error) {
        return {
          points: fallbackPoints.filter(
            (point) => point.tripId === task.tripId && point.kind === task.kind,
          ),
          failure: error as unknown,
        } as const;
      }
    }),
  );

  return {
    successfulPoints: deduplicatePoints(results.flatMap((result) => result.points)),
    failures: results.flatMap((result) => (result.failure === null ? [] : [result.failure])),
  };
}

async function listMapSnapshotsSafe(accountUserId: string): Promise<MapSnapshotMetadata[]> {
  try {
    return await localMapStore.listSnapshots(accountUserId);
  } catch {
    return [];
  }
}

function stateFromOfflineCache(result: MapLoadResult): MapDataState {
  if (result.failures.length > 0 && result.successfulPoints.length === 0) {
    return {
      status: "error",
      message: "Les données cartographiques enregistrées sur cet appareil sont indisponibles.",
      points: [],
    };
  }

  return { status: "offline", points: result.successfulPoints };
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
