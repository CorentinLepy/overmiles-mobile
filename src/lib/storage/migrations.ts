import type { SQLiteDatabase } from "expo-sqlite";

export type LocalMigration = Readonly<{
  version: number;
  name: string;
  sql: string;
}>;

export const LOCAL_MIGRATIONS: readonly LocalMigration[] = [
  {
    version: 1,
    name: "technical-offline-foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT,
        updated_by TEXT,
        sync_state TEXT NOT NULL DEFAULT 'synced'
          CHECK (sync_state IN ('synced', 'pending', 'syncing', 'failed', 'conflict')),
        last_synced_at TEXT,
        PRIMARY KEY (entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS pending_operations (
        operation_id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation_kind TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        payload_version INTEGER NOT NULL DEFAULT 1,
        base_version INTEGER,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        state TEXT NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'sending', 'conflict', 'failed'))
      );

      CREATE INDEX IF NOT EXISTS idx_pending_operations_state_created
        ON pending_operations (state, created_at);

      CREATE INDEX IF NOT EXISTS idx_pending_operations_entity
        ON pending_operations (entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: "sync-retry-scheduling",
    sql: `
      ALTER TABLE pending_operations
        ADD COLUMN next_attempt_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_pending_operations_ready
        ON pending_operations (state, next_attempt_at, created_at);
    `,
  },
  {
    version: 3,
    name: "offline-trip-cache",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_trips (
        account_user_id TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        server_version INTEGER,
        server_updated_at TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        PRIMARY KEY (account_user_id, trip_id)
      );

      CREATE INDEX IF NOT EXISTS idx_cached_trips_account_updated
        ON cached_trips (account_user_id, server_updated_at DESC);
    `,
  },
  {
    version: 4,
    name: "offline-map-data-cache",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_map_points (
        account_user_id TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        point_kind TEXT NOT NULL
          CHECK (point_kind IN ('stop', 'timeline', 'location')),
        point_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        PRIMARY KEY (account_user_id, trip_id, point_kind, point_id)
      );

      CREATE INDEX IF NOT EXISTS idx_cached_map_points_trip_kind
        ON cached_map_points (account_user_id, trip_id, point_kind);
    `,
  },
];

export async function runLocalMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );
  const appliedVersions = new Set(applied.map(({ version }) => version));

  for (const migration of LOCAL_MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}
