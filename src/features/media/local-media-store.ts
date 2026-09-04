import {
  localDatabase,
  type LocalDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";

import {
  assertLocalMediaInput,
  type LocalMediaItem,
  type LocalMediaState,
  type SaveLocalMediaItemInput,
} from "./local-media-item";

type LocalMediaRow = Readonly<{
  account_user_id: string;
  trip_id: string;
  local_media_id: string;
  storage_key: string;
  original_filename: string | null;
  mime_type: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  latitude: number | null;
  longitude: number | null;
  orientation: number | null;
  stop_id: string | null;
  caption: string | null;
  state: string;
  created_at: string;
  updated_at: string;
}>;

const MEDIA_COLUMNS = `account_user_id, trip_id, local_media_id, storage_key, original_filename,
                       mime_type, file_size_bytes, width, height, captured_at, latitude, longitude,
                       orientation, stop_id, caption, state, created_at, updated_at`;

export class LocalMediaStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async listForTrip(
    accountUserId: string,
    tripId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<readonly LocalMediaItem[]> {
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return [];

    const rows = await db.getAllAsync<LocalMediaRow>(
      `SELECT ${MEDIA_COLUMNS}
       FROM local_media_items
       WHERE account_user_id = ? AND trip_id = ?
       ORDER BY updated_at DESC`,
      accountUserId,
      tripId,
    );

    return this.database.canUseGeneration(generation) ? rows.map(mapMediaRow) : [];
  }

  async listForAccount(
    accountUserId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<readonly LocalMediaItem[]> {
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return [];

    const rows = await db.getAllAsync<LocalMediaRow>(
      `SELECT ${MEDIA_COLUMNS}
       FROM local_media_items
       WHERE account_user_id = ?
       ORDER BY updated_at DESC`,
      accountUserId,
    );

    return this.database.canUseGeneration(generation) ? rows.map(mapMediaRow) : [];
  }

  save(
    input: SaveLocalMediaItemInput,
    generation: LocalDatabaseGeneration | null,
  ): Promise<LocalMediaItem | null> {
    assertLocalMediaInput(input);

    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return null;

      const now = new Date().toISOString();
      const state = input.state ?? "local_only";
      await db.runAsync(
        `INSERT INTO local_media_items (
           account_user_id, trip_id, local_media_id, storage_key, original_filename,
           mime_type, file_size_bytes, width, height, captured_at, latitude, longitude,
           orientation, stop_id, caption, state, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_user_id, local_media_id) DO UPDATE SET
           trip_id = excluded.trip_id,
           storage_key = excluded.storage_key,
           original_filename = excluded.original_filename,
           mime_type = excluded.mime_type,
           file_size_bytes = excluded.file_size_bytes,
           width = excluded.width,
           height = excluded.height,
           captured_at = excluded.captured_at,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           orientation = excluded.orientation,
           stop_id = excluded.stop_id,
           caption = excluded.caption,
           state = excluded.state,
           updated_at = excluded.updated_at`,
        input.accountUserId,
        input.tripId,
        input.localMediaId,
        input.storageKey,
        input.originalFilename ?? null,
        input.mimeType,
        input.fileSizeBytes ?? null,
        input.width ?? null,
        input.height ?? null,
        input.capturedAt ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.orientation ?? null,
        input.stopId ?? null,
        input.caption ?? null,
        state,
        now,
        now,
      );

      if (!this.database.canUseGeneration(generation)) return null;
      const row = await db.getFirstAsync<LocalMediaRow>(
        `SELECT ${MEDIA_COLUMNS}
         FROM local_media_items
         WHERE account_user_id = ? AND local_media_id = ?`,
        input.accountUserId,
        input.localMediaId,
      );

      return row && this.database.canUseGeneration(generation) ? mapMediaRow(row) : null;
    });
  }

  remove(
    accountUserId: string,
    localMediaId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<boolean> {
    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return false;

      const result = await db.runAsync(
        `DELETE FROM local_media_items
         WHERE account_user_id = ? AND local_media_id = ?`,
        accountUserId,
        localMediaId,
      );

      return this.database.canUseGeneration(generation) && result.changes > 0;
    });
  }

  setState(
    accountUserId: string,
    localMediaId: string,
    state: LocalMediaState,
    generation: LocalDatabaseGeneration | null,
  ): Promise<boolean> {
    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return false;

      const result = await db.runAsync(
        `UPDATE local_media_items
         SET state = ?, updated_at = ?
         WHERE account_user_id = ? AND local_media_id = ?`,
        state,
        new Date().toISOString(),
        accountUserId,
        localMediaId,
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

function mapMediaRow(row: LocalMediaRow): LocalMediaItem {
  return {
    accountUserId: row.account_user_id,
    tripId: row.trip_id,
    localMediaId: row.local_media_id,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    width: row.width,
    height: row.height,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    orientation: row.orientation,
    stopId: row.stop_id,
    caption: row.caption,
    state: parseState(row.state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseState(value: string): LocalMediaState {
  if (
    value === "local_only" ||
    value === "ready_to_upload" ||
    value === "uploading" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error("État de média local invalide.");
}

export const localMediaStore = new LocalMediaStore();
