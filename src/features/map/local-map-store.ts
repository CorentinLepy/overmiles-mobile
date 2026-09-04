import { localDatabase, type LocalDatabase } from "@/src/lib/storage/local-database";

import type { MapSourceKind, TripMapPoint } from "./map.types";

type CachedMapPointRow = Readonly<{
  payload_json: string;
}>;

type CachedMapSnapshotRow = Readonly<{
  trip_id: string;
  point_kind: MapSourceKind;
  item_count: number;
  trip_version: number | null;
  trip_updated_at: string | null;
  cached_at: string;
}>;

type LocalWriteGuard = () => boolean;

export type MapSnapshotSource = Readonly<{
  tripVersion?: number | null;
  tripUpdatedAt?: string | null;
}>;

export type MapSnapshotMetadata = Readonly<{
  accountUserId: string;
  tripId: string;
  kind: MapSourceKind;
  itemCount: number;
  tripVersion: number | null;
  tripUpdatedAt: string | null;
  cachedAt: string;
}>;

const ALWAYS_WRITE: LocalWriteGuard = () => true;

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

  async listSnapshots(accountUserId: string): Promise<MapSnapshotMetadata[]> {
    const db = await this.database.open();
    const rows = await db.getAllAsync<CachedMapSnapshotRow>(
      `SELECT trip_id, point_kind, item_count, trip_version, trip_updated_at, cached_at
       FROM cached_map_snapshots
       WHERE account_user_id = ?
       ORDER BY trip_id ASC, point_kind ASC`,
      accountUserId,
    );

    return rows.map((row) => ({
      accountUserId,
      tripId: row.trip_id,
      kind: row.point_kind,
      itemCount: row.item_count,
      tripVersion: row.trip_version,
      tripUpdatedAt: row.trip_updated_at,
      cachedAt: row.cached_at,
    }));
  }

  async getSnapshot(
    accountUserId: string,
    tripId: string,
    kind: MapSourceKind,
  ): Promise<MapSnapshotMetadata | null> {
    const db = await this.database.open();
    const row = await db.getFirstAsync<CachedMapSnapshotRow>(
      `SELECT trip_id, point_kind, item_count, trip_version, trip_updated_at, cached_at
       FROM cached_map_snapshots
       WHERE account_user_id = ? AND trip_id = ? AND point_kind = ?`,
      accountUserId,
      tripId,
      kind,
    );

    if (!row) return null;
    return {
      accountUserId,
      tripId: row.trip_id,
      kind: row.point_kind,
      itemCount: row.item_count,
      tripVersion: row.trip_version,
      tripUpdatedAt: row.trip_updated_at,
      cachedAt: row.cached_at,
    };
  }

  replaceTripKind(
    accountUserId: string,
    tripId: string,
    kind: MapSourceKind,
    points: readonly TripMapPoint[],
    shouldWrite: LocalWriteGuard = ALWAYS_WRITE,
    source: MapSnapshotSource = {},
  ): Promise<void> {
    return this.enqueueWrite(async () => {
      const db = await this.database.openIf(shouldWrite);
      if (!db || !shouldWrite()) return;

      const cachedAt = new Date().toISOString();

      // SQLCipher is keyed on LocalDatabase's cached connection. Expo's exclusive
      // transaction helper opens another connection, which does not inherit PRAGMA key.
      // The store-level queue already guarantees one map writer, so keep this snapshot
      // transaction on the keyed connection instead of switching connections.
      await db.withTransactionAsync(async () => {
        if (!shouldWrite()) return;
        await db.runAsync(
          `DELETE FROM cached_map_points
           WHERE account_user_id = ? AND trip_id = ? AND point_kind = ?`,
          accountUserId,
          tripId,
          kind,
        );

        for (const point of points) {
          if (!shouldWrite()) return;
          assertCacheablePoint(point, tripId, kind);
          await db.runAsync(
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

        if (!shouldWrite()) return;
        await db.runAsync(
          `INSERT INTO cached_map_snapshots (
             account_user_id,
             trip_id,
             point_kind,
             item_count,
             trip_version,
             trip_updated_at,
             cached_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(account_user_id, trip_id, point_kind) DO UPDATE SET
             item_count = excluded.item_count,
             trip_version = excluded.trip_version,
             trip_updated_at = excluded.trip_updated_at,
             cached_at = excluded.cached_at`,
          accountUserId,
          tripId,
          kind,
          points.length,
          source.tripVersion ?? null,
          source.tripUpdatedAt ?? null,
          cachedAt,
        );
      });
    });
  }

  clearAccount(accountUserId: string): Promise<void> {
    return this.enqueueWrite(async () => {
      const db = await this.database.open();
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM cached_map_points WHERE account_user_id = ?", accountUserId);
        await db.runAsync(
          "DELETE FROM cached_map_snapshots WHERE account_user_id = ?",
          accountUserId,
        );
      });
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
