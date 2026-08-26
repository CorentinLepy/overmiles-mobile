import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/src/lib/api/api-error";
import { useAuth } from "@/src/providers/auth-provider";
import { fetchTrips, type TripSummary } from "./trips-api";

export type TripsQueryState = Readonly<{
  trips: TripSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  refresh(): Promise<void>;
}>;

export function useTrips(): TripsQueryState {
  const { apiClient, status } = useAuth();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing: boolean) => {
      if (!apiClient || status !== "authenticated") {
        setIsLoading(false);
        return;
      }

      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      setErrorMessage(null);

      try {
        setTrips(await fetchTrips(apiClient));
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError
            ? error.userMessage
            : "Impossible de charger vos voyages pour le moment.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [apiClient, status],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { trips, isLoading, isRefreshing, errorMessage, refresh };
}
