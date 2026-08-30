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
  {
    version: 5,
    name: "offline-map-snapshot-freshness",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_map_snapshots (
        account_user_id TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        point_kind TEXT NOT NULL
          CHECK (point_kind IN ('stop', 'timeline', 'location')),
        item_count INTEGER NOT NULL CHECK (item_count >= 0),
        trip_version INTEGER,
        trip_updated_at TEXT,
        cached_at TEXT NOT NULL,
        PRIMARY KEY (account_user_id, trip_id, point_kind)
      );

      CREATE INDEX IF NOT EXISTS idx_cached_map_snapshots_account_cached
        ON cached_map_snapshots (account_user_id, cached_at DESC);
    `,
  },
  {
    version: 6,
    name: "offline-journal-drafts",
    sql: `
      CREATE TABLE IF NOT EXISTS local_journal_drafts (
        account_user_id TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        stop_id TEXT,
        state TEXT NOT NULL DEFAULT 'draft_local'
          CHECK (state IN ('draft_local', 'ready_to_sync', 'syncing', 'failed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_user_id, draft_id)
      );

      CREATE INDEX IF NOT EXISTS idx_local_journal_drafts_trip_updated
        ON local_journal_drafts (account_user_id, trip_id, state, updated_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_local_journal_drafts_active_trip
        ON local_journal_drafts (account_user_id, trip_id)
        WHERE state = 'draft_local';
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