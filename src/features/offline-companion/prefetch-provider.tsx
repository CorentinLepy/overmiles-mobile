import { usePathname } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { localMapStore, type MapSnapshotMetadata } from "@/src/features/map/local-map-store";
import { createMapStopsRepository } from "@/src/features/map/map-stops-repository";
import { createMapTimelineRepository } from "@/src/features/map/map-timeline-repository";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import type { TripSummary } from "@/src/features/trips/trips.types";
import { useAuth } from "@/src/providers/auth-provider";

import { deriveCompanionAvailability, type CompanionAvailability } from "./availability";
import { CompanionPrefetchFlightRegistry } from "./prefetch-flight-registry";
import { createCompanionPrefetchKey, selectCompanionTrips } from "./selection";

type CompanionContextValue = Readonly<{
  snapshots: readonly MapSnapshotMetadata[];
  preparingTripIds: ReadonlySet<string>;
}>;

const CompanionContext = createContext<CompanionContextValue | null>(null);
const EMPTY_PREPARING_TRIPS: ReadonlySet<string> = new Set();

export function CompanionPrefetchProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isMapActive = pathname === "/map" || pathname.startsWith("/map/");
  const { apiClient, status, user } = useAuth();
  const { trips, isLoading, isRefreshing } = useTripsData();
  const repositories = useMemo(
    () =>
      apiClient && user
        ? {
            stops: createMapStopsRepository(apiClient, user.id),
            timeline: createMapTimelineRepository(apiClient, user.id),
          }
        : null,
    [apiClient, user],
  );
  const priorityTrips = useMemo(() => selectCompanionTrips(trips), [trips]);
  const prefetchKey = user ? createCompanionPrefetchKey(user.id, priorityTrips) : null;
  const prefetchFlightsRef = useRef(new CompanionPrefetchFlightRegistry());
  const mountedRef = useRef(false);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const [snapshots, setSnapshots] = useState<readonly MapSnapshotMetadata[]>([]);
  const [preparingTripIds, setPreparingTripIds] = useState<ReadonlySet<string>>(() => new Set());
  const hasLocalContentSession =
    user !== null && (status === "authenticated" || status === "offline_auth_pending");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !hasLocalContentSession) return;

    let active = true;
    void localMapStore
      .listSnapshots(user.id)
      .then((nextSnapshots) => {
        if (active) setSnapshots(nextSnapshots);
      })
      .catch(() => {
        if (active) setSnapshots([]);
      });

    return () => {
      active = false;
    };
  }, [hasLocalContentSession, snapshotRevision, user]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !repositories ||
      !prefetchKey ||
      priorityTrips.length === 0 ||
      isLoading ||
      isRefreshing ||
      isMapActive
    ) {
      return;
    }

    const activeRepositories = repositories;
    const activePrefetchKey = prefetchKey;
    const activePriorityTrips = priorityTrips;
    const flights = prefetchFlightsRef.current;

    // Claim the key synchronously before the first async yield. TripsDataProvider can
    // replace cached trips with a server hydration while this prefetch is running;
    // a second effect pass for the same freshness key must reuse the in-flight work.
    if (!flights.tryStart(activePrefetchKey)) return;

    const activeTripIds = new Set(activePriorityTrips.map((trip) => trip.id));
    setPreparingTripIds((current) => new Set([...current, ...activeTripIds]));

    async function prefetchPriorityTrips() {
      let succeeded = false;
      try {
        const tasks = activePriorityTrips.flatMap((trip) => [
          activeRepositories.stops.listTripStops(trip),
          activeRepositories.timeline.listTripEvents(trip),
        ]);
        const results = await Promise.allSettled(tasks);
        succeeded = results.every((result) => result.status === "fulfilled");

        if (!mountedRef.current) return;
        setSnapshotRevision((revision) => revision + 1);
      } finally {
        flights.finish(activePrefetchKey, succeeded);
        if (mountedRef.current) {
          setPreparingTripIds((current) => {
            const next = new Set(current);
            for (const tripId of activeTripIds) next.delete(tripId);
            return next;
          });
        }
      }
    }

    void prefetchPriorityTrips();
  }, [isLoading, isMapActive, isRefreshing, prefetchKey, priorityTrips, repositories, status]);

  const value = useMemo<CompanionContextValue>(
    () => ({
      snapshots: hasLocalContentSession ? snapshots : [],
      preparingTripIds: hasLocalContentSession ? preparingTripIds : EMPTY_PREPARING_TRIPS,
    }),
    [hasLocalContentSession, preparingTripIds, snapshots],
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanionAvailability(trip: TripSummary): CompanionAvailability {
  const context = useContext(CompanionContext);
  if (!context) {
    throw new Error("CompanionPrefetchProvider manquant.");
  }

  return useMemo(
    () =>
      deriveCompanionAvailability(trip, context.snapshots, context.preparingTripIds.has(trip.id)),
    [context.preparingTripIds, context.snapshots, trip],
  );
}
