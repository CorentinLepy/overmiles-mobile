import { ApiError } from "@/src/lib/api/api-error";
import type { ApiClient } from "@/src/lib/api/api-client";
import { localDataSessionGuard } from "@/src/lib/storage/local-data-session-guard";
import type { SyncTransport } from "@/src/lib/sync/sync-engine";

import { localTripsStore, type LocalTripsStore } from "./local-trips-store";
import type { TripSummary } from "./trips.types";

const UNSUPPORTED_OPERATION = "SYNC_UNSUPPORTED_OPERATION";
const BASE_VERSION_REQUIRED = "SYNC_TRIP_BASE_VERSION_REQUIRED";
const INVALID_PAYLOAD = "SYNC_TRIP_PAYLOAD_INVALID";
const INVALID_RESPONSE = "SYNC_TRIP_RESPONSE_INVALID";

export function createTripSyncTransport(
  apiClient: ApiClient,
  accountUserId: string,
  localStore: LocalTripsStore = localTripsStore,
): SyncTransport {
  return async (operation) => {
    if (operation.entityType !== "Trip" || operation.operationKind !== "update") {
      return { outcome: "fatal", errorCode: UNSUPPORTED_OPERATION };
    }

    if (!isServerVersion(operation.baseVersion)) {
      return { outcome: "fatal", errorCode: BASE_VERSION_REQUIRED };
    }

    if (!isPlainRecord(operation.payload)) {
      return { outcome: "fatal", errorCode: INVALID_PAYLOAD };
    }

    const writeToken = localDataSessionGuard.capture();
    if (writeToken === null) return { outcome: "aborted" };
    const canPersist = () => localDataSessionGuard.canCommit(writeToken);

    try {
      const updatedTrip = await apiClient.request<TripSummary>({
        path: `/trips/${encodeURIComponent(operation.entityId)}`,
        method: "PATCH",
        kind: "json",
        auth: "required",
        idempotencyKey: operation.operationId,
        allowAuthReplay: true,
        body: {
          ...operation.payload,
          expectedVersion: operation.baseVersion,
        },
      });

      if (!canPersist()) return { outcome: "aborted" };

      if (
        updatedTrip.id !== operation.entityId ||
        !isServerVersion(updatedTrip.version) ||
        typeof updatedTrip.updatedAt !== "string"
      ) {
        return { outcome: "fatal", errorCode: INVALID_RESPONSE };
      }

      await localStore.upsert(accountUserId, updatedTrip, canPersist);
      if (!canPersist()) return { outcome: "aborted" };

      return {
        outcome: "applied",
        serverVersion: updatedTrip.version,
        serverUpdatedAt: updatedTrip.updatedAt,
        serverUpdatedBy: updatedTrip.updatedByUserId ?? null,
      };
    } catch (error) {
      if (!canPersist()) return { outcome: "aborted" };
      if (!(error instanceof ApiError)) throw error;

      if (error.kind === "conflict" && error.code === "SYNC_VERSION_CONFLICT") {
        return { outcome: "conflict", errorCode: error.code };
      }

      const errorCode = error.code ?? `HTTP_${error.status || "NETWORK"}`;
      return error.retryable
        ? { outcome: "retryable", errorCode }
        : { outcome: "fatal", errorCode };
    }
  };
}

function isServerVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
