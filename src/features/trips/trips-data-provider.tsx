import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { ApiError } from "@/src/lib/api/api-error";
import { useAuth } from "@/src/providers/auth-provider";

import { createTripsRepository } from "./trips-repository";
import type { TripSummary } from "./trips.types";

type TripsDataContextValue = Readonly<{
  trips: TripSummary[];
  nextTrip: TripSummary | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  errorMessage: string | null;
  refresh(): Promise<void>;
  findTrip(tripId: string): TripSummary | null;
  ensureTrip(tripId: string): Promise<TripSummary | null>;
}>;

const TripsDataContext = createContext<TripsDataContextValue | null>(null);

export function TripsDataProvider({ children }: PropsWithChildren) {
  const { apiClient, status } = useAuth();
  const repository = useMemo(() => (apiClient ? createTripsRepository(apiClient) : null), [apiClient]);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !repository) return;

    const activeRepository = repository;
    let active = true;

    async function loadInitialTrips() {
      try {
        const nextTrips = await activeRepository.list();
        if (!active) return;
        setTrips(sortTrips(nextTrips));
        setErrorMessage(null);
        setIsOffline(false);
      } catch (error) {
        if (!active) return;
        setErrorState(error, setErrorMessage, setIsOffline);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadInitialTrips();

    return () => {
      active = false;
    };
  }, [repository, status]);

  const refresh = useCallback(async () => {
    if (!repository || status !== "authenticated") return;

    setIsRefreshing(true);
    try {
      const nextTrips = await repository.list();
      setTrips(sortTrips(nextTrips));
      setErrorMessage(null);
      setIsOffline(false);
    } catch (error) {
      setErrorState(error, setErrorMessage, setIsOffline);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [repository, status]);

  const findTrip = useCallback(
    (tripId: string) => trips.find((trip) => trip.id === tripId) ?? null,
    [trips],
  );

  const ensureTrip = useCallback(
    async (tripId: string): Promise<TripSummary | null> => {
      const cached = trips.find((trip) => trip.id === tripId);
      if (cached) return cached;
      if (!repository || status !== "authenticated") return null;

      try {
        const loaded = await repository.getById(tripId);
        setTrips((current) => sortTrips(upsertTrip(current, loaded)));
        setErrorMessage(null);
        setIsOffline(false);
        return loaded;
      } catch (error) {
        setErrorState(error, setErrorMessage, setIsOffline);
        return null;
      }
    },
    [repository, status, trips],
  );

  const nextTrip = useMemo(() => findNextTrip(trips), [trips]);

  const value = useMemo<TripsDataContextValue>(
    () => ({
      trips,
      nextTrip,
      isLoading,
      isRefreshing,
      isOffline,
      errorMessage,
      refresh,
      findTrip,
      ensureTrip,
    }),
    [ensureTrip, errorMessage, findTrip, isLoading, isOffline, isRefreshing, nextTrip, refresh, trips],
  );

  return <TripsDataContext.Provider value={value}>{children}</TripsDataContext.Provider>;
}

export function useTripsData(): TripsDataContextValue {
  const context = useContext(TripsDataContext);
  if (!context) {
    throw new Error("useTripsData doit être utilisé sous TripsDataProvider.");
  }
  return context;
}

function setErrorState(
  error: unknown,
  setMessage: (message: string) => void,
  setOffline: (offline: boolean) => void,
): void {
  if (error instanceof ApiError) {
    setMessage(error.userMessage);
    setOffline(error.kind === "network" || error.kind === "timeout");
    return;
  }

  setMessage("Impossible de charger vos voyages pour le moment.");
  setOffline(false);
}

function upsertTrip(trips: TripSummary[], trip: TripSummary): TripSummary[] {
  const index = trips.findIndex((candidate) => candidate.id === trip.id);
  if (index < 0) return [...trips, trip];

  const nextTrips = [...trips];
  nextTrips[index] = trip;
  return nextTrips;
}

function sortTrips(trips: TripSummary[]): TripSummary[] {
  return [...trips].sort((left, right) => tripSortKey(left) - tripSortKey(right));
}

function tripSortKey(trip: TripSummary): number {
  const now = Date.now();
  if (!trip.startsAt) return Number.MAX_SAFE_INTEGER - 1;
  const start = Date.parse(trip.startsAt);
  if (Number.isNaN(start)) return Number.MAX_SAFE_INTEGER;
  return start >= now ? start : Number.MAX_SAFE_INTEGER / 2 + start;
}

function findNextTrip(trips: TripSummary[]): TripSummary | null {
  const now = Date.now();
  return (
    trips.find((trip) => {
      if (!trip.startsAt) return false;
      const startsAt = Date.parse(trip.startsAt);
      const endsAt = trip.endsAt ? Date.parse(trip.endsAt) : startsAt;
      return !Number.isNaN(startsAt) && !Number.isNaN(endsAt) && endsAt >= now;
    }) ?? null
  );
}
