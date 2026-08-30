import type { ApiClient } from "@/src/lib/api/api-client";
import {
  PendingOperationsStore,
  type PendingOperation,
} from "@/src/lib/sync/pending-operations-store";

import { localTripsStore, type LocalTripsStore } from "./local-trips-store";
import type { TripSummary, TripUpdatePatch } from "./trips.types";

export type TripsRepository = Readonly<{
  listCached(): Promise<TripSummary[]>;
  refresh(): Promise<TripSummary[]>;
  getCachedById(tripId: string): Promise<TripSummary | null>;
  getById(tripId: string): Promise<TripSummary>;
  enqueueUpdate(tripId: string, patch: TripUpdatePatch): Promise<PendingOperation>;
}>;

export function createTripsRepository(
  apiClient: ApiClient,
  accountUserId: string,
  localStore: LocalTripsStore = localTripsStore,
  pendingStore: PendingOperationsStore = new PendingOperationsStore(),
): TripsRepository {
  return {
    listCached(): Promise<TripSummary[]> {
      return localStore.list(accountUserId);
    },

    async refresh(): Promise<TripSummary[]> {
      const trips = await apiClient.request<TripSummary[]>({
        path: "/trips",
        method: "GET",
        kind: "json",
        auth: "required",
      });
      await localStore.replaceAll(accountUserId, trips);
      return localStore.list(accountUserId);
    },

    getCachedById(tripId: string): Promise<TripSummary | null> {
      return localStore.getById(accountUserId, tripId);
    },

    async getById(tripId: string): Promise<TripSummary> {
      const trip = await apiClient.request<TripSummary>({
        path: `/trips/${encodeURIComponent(tripId)}`,
        method: "GET",
        kind: "json",
        auth: "required",
      });
      await localStore.upsert(accountUserId, trip);
      return trip;
    },

    async enqueueUpdate(tripId: string, patch: TripUpdatePatch): Promise<PendingOperation> {
      const current = await localStore.getById(accountUserId, tripId);
      if (!current) {
        throw new Error("Le voyage doit être disponible localement avant modification hors-ligne.");
      }
      if (!isServerVersion(current.version)) {
        throw new Error("La version serveur du voyage est requise avant modification hors-ligne.");
      }

      const payload = cleanUpdatePatch(patch);
      if (Object.keys(payload).length === 0) {
        throw new Error("Aucune modification de voyage à synchroniser.");
      }

      return pendingStore.enqueue({
        entityType: "Trip",
        entityId: tripId,
        operationKind: "update",
        payload,
        baseVersion: current.version,
      });
    },
  };
}

function cleanUpdatePatch(patch: TripUpdatePatch): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function isServerVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
