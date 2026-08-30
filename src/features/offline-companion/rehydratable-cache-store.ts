import {
  localDatabase,
  type LocalDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";

import {
  assertRehydratableCacheInput,
  type RehydratableCacheItem,
  type RehydratableCacheKind,
  type SaveRehydratableCacheItemInput,
} from "./rehydratable-cache-item";

type RehydratableCacheRow = Readonly<{
  account_user_id: string;
  cache_id: string;
  trip_id: string | null;
  cache_kind: string;
  storage_key: string;
  source_fingerprint: string;
  size_bytes: number;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
}>;

type TotalBytesRow = Readonly<{ total_bytes: number }>;

const CACHE_COLUMNS = `account_user_id, cache_id, trip_id, cache_kind, storage_key,
                       source_fingerprint, size_bytes, last_accessed_at, created_at, updated_at`;
const SAFE_SCOPE_VALUE = /^[A-Za-z0-9_-]{1,128}$/;

export class RehydratableCacheStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async listForAccount(
    accountUserId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<readonly RehydratableCacheItem[]> {
    assertScopeValue(accountUserId, "accountUserId");
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return [];

    const rows = await db.getAllAsync<RehydratableCacheRow>(
      `SELECT ${CACHE_COLUMNS}
       FROM rehydratable_cache_inventory
       WHERE account_user_id = ?
       ORDER BY last_accessed_at ASC, cache_id ASC`,
      accountUserId,
    );

    return this.database.canUseGeneration(generation) ? rows.map(mapCacheRow) : [];
  }

  async listForTrip(
    accountUserId: string,
    tripId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<readonly RehydratableCacheItem[]> {
    assertScopeValue(accountUserId, "accountUserId");
    assertScopeValue(tripId, "tripId");
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return [];

    const rows = await db.getAllAsync<RehydratableCacheRow>(
      `SELECT ${CACHE_COLUMNS}
       FROM rehydratable_cache_inventory
       WHERE account_user_id = ? AND trip_id = ?
       ORDER BY last_accessed_at ASC, cache_id ASC`,
      accountUserId,
      tripId,
    );

    return this.database.canUseGeneration(generation) ? rows.map(mapCacheRow) : [];
  }

  async totalBytesForAccount(
    accountUserId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<number> {
    assertScopeValue(accountUserId, "accountUserId");
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return 0;

    const row = await db.getFirstAsync<TotalBytesRow>(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes
       FROM rehydratable_cache_inventory
       WHERE account_user_id = ?`,
      accountUserId,
    );

    if (!this.database.canUseGeneration(generation)) return 0;
    return row?.total_bytes ?? 0;
  }

  save(
    input: SaveRehydratableCacheItemInput,
    generation: LocalDatabaseGeneration | null,
  ): Promise<RehydratableCacheItem | null> {
    assertRehydratableCacheInput(input);

    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return null;

      const now = new Date().toISOString();
      const lastAccessedAt = input.lastAccessedAt ?? now;
      await db.runAsync(
        `INSERT INTO rehydratable_cache_inventory (
           account_user_id, cache_id, trip_id, cache_kind, storage_key,
           source_fingerprint, size_bytes, last_accessed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_user_id, cache_id) DO UPDATE SET
           trip_id = excluded.trip_id,
           cache_kind = excluded.cache_kind,
           storage_key = excluded.storage_key,
           source_fingerprint = excluded.source_fingerprint,
           size_bytes = excluded.size_bytes,
           last_accessed_at = excluded.last_accessed_at,
           updated_at = excluded.updated_at`,
        input.accountUserId,
        input.cacheId,
        input.tripId ?? null,
        input.kind,
        input.storageKey,
        input.sourceFingerprint,
        input.sizeBytes,
        lastAccessedAt,
        now,
        now,
      );

      if (!this.database.canUseGeneration(generation)) return null;
      const row = await db.getFirstAsync<RehydratableCacheRow>(
        `SELECT ${CACHE_COLUMNS}
         FROM rehydratable_cache_inventory
         WHERE account_user_id = ? AND cache_id = ?`,
        input.accountUserId,
        input.cacheId,
      );

      return row && this.database.canUseGeneration(generation) ? mapCacheRow(row) : null;
    });
  }

  touch(
    accountUserId: string,
    cacheId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<boolean> {
    assertScopeValue(accountUserId, "accountUserId");
    assertScopeValue(cacheId, "cacheId");

    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return false;

      const now = new Date().toISOString();
      const result = await db.runAsync(
        `UPDATE rehydratable_cache_inventory
         SET last_accessed_at = ?, updated_at = ?
         WHERE account_user_id = ? AND cache_id = ?`,
        now,
        now,
        accountUserId,
        cacheId,
      );

      return this.database.canUseGeneration(generation) && result.changes > 0;
    });
  }

  removeEntry(
    accountUserId: string,
    cacheId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<boolean> {
    assertScopeValue(accountUserId, "accountUserId");
    assertScopeValue(cacheId, "cacheId");

    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return false;

      const result = await db.runAsync(
        `DELETE FROM rehydratable_cache_inventory
         WHERE account_user_id = ? AND cache_id = ?`,
        accountUserId,
        cacheId,
      );

      return this.database.canUseGeneration(generation) && result.changes > 0;
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(work, work);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function mapCacheRow(row: RehydratableCacheRow): RehydratableCacheItem {
  return {
    accountUserId: row.account_user_id,
    cacheId: row.cache_id,
    tripId: row.trip_id,
    kind: parseCacheKind(row.cache_kind),
    storageKey: row.storage_key,
    sourceFingerprint: row.source_fingerprint,
    sizeBytes: row.size_bytes,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseCacheKind(value: string): RehydratableCacheKind {
  if (value === "remote_media" || value === "document" || value === "map_region") return value;
  throw new Error("Type de cache réhydratable invalide en base locale.");
}

function assertScopeValue(value: string, field: string): void {
  if (!SAFE_SCOPE_VALUE.test(value)) {
    throw new Error(`${field} contient des caractères non autorisés.`);
  }
}

export const rehydratableCacheStore = new RehydratableCacheStore();
