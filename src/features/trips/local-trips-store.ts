import { localDatabase, type LocalDatabase } from "@/src/lib/storage/local-database";

import type { TripSummary } from "./trips.types";

type CachedTripRow = Readonly<{
  payload_json: string;
}>;

type LocalWriteGuard = () => boolean;

const ALWAYS_WRITE: LocalWriteGuard = () => true;

export class LocalTripsStore {
  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async list(accountUserId: string): Promise<TripSummary[]> {
    const db = await this.database.open();
    const rows = await db.getAllAsync<CachedTripRow>(
      `SELECT payload_json
       FROM cached_trips
       WHERE account_user_id = ?
       ORDER BY server_updated_at DESC, trip_id ASC`,
      accountUserId,
    );

    return rows.map(({ payload_json }) => parseCachedTrip(payload_json));
  }

  async getById(accountUserId: string, tripId: string): Promise<TripSummary | null> {
    const db = await this.database.open();
    const row = await db.getFirstAsync<CachedTripRow>(
      `SELECT payload_json
       FROM cached_trips
       WHERE account_user_id = ? AND trip_id = ?`,
      accountUserId,
      tripId,
    );

    return row ? parseCachedTrip(row.payload_json) : null;
  }

  async replaceAll(
    accountUserId: string,
    trips: readonly TripSummary[],
    shouldWrite: LocalWriteGuard = ALWAYS_WRITE,
  ): Promise<void> {
    const db = await this.database.openIf(shouldWrite);
    if (!db || !shouldWrite()) return;

    const cachedAt = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM cached_trips WHERE account_user_id = ?", accountUserId);

      for (const trip of trips) {
        if (!shouldWrite()) return;
        await insertTrip(db, accountUserId, trip, cachedAt);
      }
    });
  }

  async upsert(
    accountUserId: string,
    trip: TripSummary,
    shouldWrite: LocalWriteGuard = ALWAYS_WRITE,
  ): Promise<void> {
    const db = await this.database.openIf(shouldWrite);
    if (!db || !shouldWrite()) return;
    await insertTrip(db, accountUserId, trip, new Date().toISOString());
  }

  async clearAccount(accountUserId: string): Promise<void> {
    const db = await this.database.open();
    await db.runAsync("DELETE FROM cached_trips WHERE account_user_id = ?", accountUserId);
  }
}

async function insertTrip(
  db: Awaited<ReturnType<LocalDatabase["open"]>>,
  accountUserId: string,
  trip: TripSummary,
  cachedAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO cached_trips (
       account_user_id,
       trip_id,
       payload_json,
       server_version,
       server_updated_at,
       cached_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_user_id, trip_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       server_version = excluded.server_version,
       server_updated_at = excluded.server_updated_at,
       cached_at = excluded.cached_at`,
    accountUserId,
    trip.id,
    JSON.stringify(trip),
    trip.version ?? null,
    trip.updatedAt,
    cachedAt,
  );
}

function parseCachedTrip(payload: string): TripSummary {
  const parsed = JSON.parse(payload) as Partial<TripSummary>;
  if (
    typeof parsed.id !== "string" ||
    typeof parsed.ownerId !== "string" ||
    typeof parsed.name !== "string" ||
    typeof parsed.status !== "string" ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.updatedAt !== "string" ||
    !Array.isArray(parsed.countries)
  ) {
    throw new Error("Voyage local invalide.");
  }

  return parsed as TripSummary;
}

export const localTripsStore = new LocalTripsStore();
