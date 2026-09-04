import type { ApiClient } from "@/src/lib/api/api-client";
import { PendingOperationsStore } from "@/src/lib/sync/pending-operations-store";
import { OfflineSyncEngine, type SyncEngine } from "@/src/lib/sync/sync-engine";

import { localTripsStore } from "./local-trips-store";
import { createTripSyncTransport } from "./trip-sync-transport";
import { createTripsRepository, type TripsRepository } from "./trips-repository";

export type TripSyncRuntime = Readonly<{
  repository: TripsRepository;
  syncEngine: SyncEngine;
}>;

export function createTripSyncRuntime(
  apiClient: ApiClient,
  accountUserId: string,
): TripSyncRuntime {
  const pendingStore = new PendingOperationsStore();
  const repository = createTripsRepository(apiClient, accountUserId, localTripsStore, pendingStore);
  const transport = createTripSyncTransport(apiClient, accountUserId, localTripsStore);
  const syncEngine = new OfflineSyncEngine(pendingStore, transport);

  return { repository, syncEngine };
}
