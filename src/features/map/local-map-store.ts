import { localDatabase, type LocalDatabase } from "@/src/lib/storage/local-database";

import type { MapSourceKind, TripMapPoint } from "./map.types";

type CachedMapPointRow = Readonly<{
  payload_json: string;
}>;

export class LocalMapStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async list(accountUserId: string, tripId: string, kind: MapSourceKind): Promise<TripMapPoint[]> {
    const db = await this.database.open();
    const rows = await db.getAllAsync<CachedMapPointRow>(
      `SELECT payload_json
       FROM cached_map_points
       WHERE account_user_id = ? AND trip_id = ? AND point_kind = ?
       ORDER BY point_id ASC`,
      accountUserId,
      tripId,
      kind,
    );

    return rows.map(({ payload_json }) => parseCachedMapPoint(payload_json, tripId, kind));
  }

  replaceTripKind(
    accountUserId: string,
    tripId: string,
    kind: MapSourceKind,
    points: readonly TripMapPoint[],
  ): Promise<void> {
    return this.enqueueWrite(async () => {
      const db = await this.database.open();
      const cachedAt = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          `DELETE FROM cached_map_points
           WHERE account_user_id = ? AND trip_id = ? AND point_kind = ?`,
          accountUserId,
          tripId,
          kind,
        );

        for (const point of points) {
          assertCacheablePoint(point, tripId, kind);
          await transaction.runAsync(
            `INSERT INTO cached_map_points (
               account_user_id,
               trip_id,
               point_kind,
               point_id,
               payload_json,
               cached_at
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            accountUserId,
            tripId,
            kind,
            point.id,
            JSON.stringify(point),
            cachedAt,
          );
        }
      });
    });
  }

  clearAccount(accountUserId: string): Promise<void> {
    return this.enqueueWrite(async () => {
      const db = await this.database.open();
      await db.runAsync("DELETE FROM cached_map_points WHERE account_user_id = ?", accountUserId);
    });
  }

  private enqueueWrite(task: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.then(task);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }
}

function assertCacheablePoint(point: TripMapPoint, tripId: string, kind: MapSourceKind): void {
  if (point.tripId !== tripId || point.kind !== kind || point.visited !== true) {
    throw new Error("Repère cartographique local incohérent.");
  }
}

function parseCachedMapPoint(
  payload: string,
  expectedTripId: string,
  expectedKind: MapSourceKind,
): TripMapPoint {
  const parsed = JSON.parse(payload) as Partial<TripMapPoint>;
  const coordinate = parsed.coordinate;
  const invalidOccurredAt =
    parsed.occurredAt !== undefined &&
    parsed.occurredAt !== null &&
    typeof parsed.occurredAt !== "string";

  if (
    typeof parsed.id !== "string" ||
    parsed.tripId !== expectedTripId ||
    typeof parsed.tripName !== "string" ||
    typeof parsed.label !== "string" ||
    parsed.kind !== expectedKind ||
    parsed.visited !== true ||
    !coordinate ||
    typeof coordinate.latitude !== "number" ||
    typeof coordinate.longitude !== "number" ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude) ||
    invalidOccurredAt
  ) {
    throw new Error("Repère cartographique local invalide.");
  }

  return parsed as TripMapPoint;
}

export const localMapStore = new LocalMapStore();
