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

import {
  localMapStore,
  type MapSnapshotMetadata,
} from "@/src/features/map/local-map-store";
import { createMapStopsRepository } from "@/src/features/map/map-stops-repository";
import { createMapTimelineRepository } from "@/src/features/map/map-timeline-repository";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import type { TripSummary } from "@/src/features/trips/trips.types";
import { useAuth } from "@/src/providers/auth-provider";

import {
  deriveCompanionAvailability,
  type CompanionAvailability,
} from "./availability";
import { createCompanionPrefetchKey, selectCompanionTrips } from "./selection";

type CompanionContextValue = Readonly<{
  snapshots: readonly MapSnapshotMetadata[];
  preparingTripIds: ReadonlySet<string>;
}>;

const CompanionContext = createContext<CompanionContextValue | null>(null);

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
  const completedKeyRef = useRef<string | null>(null);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const [snapshots, setSnapshots] = useState<readonly MapSnapshotMetadata[]>([]);
  const [preparingTripIds, setPreparingTripIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!user || (status !== "authenticated" && status !== "offline_auth_pending")) {
      setSnapshots([]);
      setPreparingTripIds(new Set());
      completedKeyRef.current = null;
      return;
    }

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
  }, [snapshotRevision, status, user]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !repositories ||
      !prefetchKey ||
      priorityTrips.length === 0 ||
      isLoading ||
      isRefreshing ||
      isMapActive ||
      completedKeyRef.current === prefetchKey
    ) {
      return;
    }

    const activeRepositories = repositories;
    const activePrefetchKey = prefetchKey;
    const activePriorityTrips = priorityTrips;
    let active = true;

    setPreparingTripIds(new Set(activePriorityTrips.map((trip) => trip.id)));

    async function prefetchPriorityTrips() {
      const tasks = activePriorityTrips.flatMap((trip) => [
        activeRepositories.stops.listTripStops(trip),
        activeRepositories.timeline.listTripEvents(trip),
      ]);
      const results = await Promise.allSettled(tasks);
      if (!active) return;

      setPreparingTripIds(new Set());
      setSnapshotRevision((revision) => revision + 1);

      if (results.every((result) => result.status === "fulfilled")) {
        completedKeyRef.current = activePrefetchKey;
      }
    }

    void prefetchPriorityTrips();

    return () => {
      active = false;
    };
  }, [isLoading, isMapActive, isRefreshing, prefetchKey, priorityTrips, repositories, status]);

  const value = useMemo<CompanionContextValue>(
    () => ({ snapshots, preparingTripIds }),
    [preparingTripIds, snapshots],
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanionAvailability(trip: TripSummary): CompanionAvailability {
  const context = useContext(CompanionContext);
  if (!context) {
    throw new Error("useCompanionAvailability doit être utilisé sous CompanionPrefetchProvider.");
  }

  return useMemo(
    () =>
      deriveCompanionAvailability(
        trip,
        context.snapshots,
        context.preparingTripIds.has(trip.id),
      ),
    [context.preparingTripIds, context.snapshots, trip],
  );
}
