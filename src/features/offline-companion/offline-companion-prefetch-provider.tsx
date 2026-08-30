import { usePathname } from "expo-router";
import { useEffect, useMemo, useRef, type PropsWithChildren } from "react";

import { createMapStopsRepository } from "@/src/features/map/map-stops-repository";
import { createMapTimelineRepository } from "@/src/features/map/map-timeline-repository";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import { useAuth } from "@/src/providers/auth-provider";

import { createCompanionPrefetchKey, selectCompanionTrips } from "./companion-trip-selection";

export function OfflineCompanionPrefetchProvider({ children }: PropsWithChildren) {
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

    async function prefetchPriorityTrips() {
      const tasks = activePriorityTrips.flatMap((trip) => [
        activeRepositories.stops.listTripStops(trip),
        activeRepositories.timeline.listTripEvents(trip),
      ]);
      const results = await Promise.allSettled(tasks);
      if (!active) return;

      if (results.every((result) => result.status === "fulfilled")) {
        completedKeyRef.current = activePrefetchKey;
      }
    }

    void prefetchPriorityTrips();

    return () => {
      active = false;
    };
  }, [
    isLoading,
    isMapActive,
    isRefreshing,
    prefetchKey,
    priorityTrips,
    repositories,
    status,
  ]);

  return children;
}
