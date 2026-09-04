import {
  localDatabase,
  type LocalDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";

import {
  assertLocalMomentDraftInput,
  type LocalMomentDraft,
  type LocalMomentDraftState,
  type LocalTimelineEventType,
  type SaveLocalMomentDraftInput,
} from "./local-moment-draft";

type LocalMomentRow = Readonly<{
  account_user_id: string;
  trip_id: string;
  draft_id: string;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  ends_at: string | null;
  all_day: number;
  stop_id: string | null;
  latitude: number | null;
  longitude: number | null;
  state: string;
  created_at: string;
  updated_at: string;
}>;

export class LocalMomentDraftStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async getActive(
    accountUserId: string,
    tripId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<LocalMomentDraft | null> {
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return null;

    const row = await db.getFirstAsync<LocalMomentRow>(
      `SELECT account_user_id, trip_id, draft_id, event_type, title, description,
              occurred_at, ends_at, all_day, stop_id, latitude, longitude,
              state, created_at, updated_at
       FROM local_timeline_event_drafts
       WHERE account_user_id = ? AND trip_id = ? AND state = 'draft_local'
       ORDER BY updated_at DESC
       LIMIT 1`,
      accountUserId,
      tripId,
    );

    if (!row || !this.database.canUseGeneration(generation)) return null;
    return mapMomentRow(row);
  }

  save(
    input: SaveLocalMomentDraftInput,
    generation: LocalDatabaseGeneration | null,
  ): Promise<LocalMomentDraft | null> {
    assertLocalMomentDraftInput(input);

    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return null;

      const now = new Date().toISOString();
      const type = input.type ?? "MANUAL";
      const state = input.state ?? "draft_local";
      await db.runAsync(
        `INSERT INTO local_timeline_event_drafts (
           account_user_id, trip_id, draft_id, event_type, title, description,
           occurred_at, ends_at, all_day, stop_id, latitude, longitude,
           state, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_user_id, draft_id) DO UPDATE SET
           event_type = excluded.event_type,
           title = excluded.title,
           description = excluded.description,
           occurred_at = excluded.occurred_at,
           ends_at = excluded.ends_at,
           all_day = excluded.all_day,
           stop_id = excluded.stop_id,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           state = excluded.state,
           updated_at = excluded.updated_at`,
        input.accountUserId,
        input.tripId,
        input.draftId,
        type,
        input.title,
        input.description ?? null,
        input.occurredAt,
        input.endsAt ?? null,
        input.allDay ? 1 : 0,
        input.stopId ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        state,
        now,
        now,
      );

      if (!this.database.canUseGeneration(generation)) return null;
      const row = await db.getFirstAsync<LocalMomentRow>(
        `SELECT account_user_id, trip_id, draft_id, event_type, title, description,
                occurred_at, ends_at, all_day, stop_id, latitude, longitude,
                state, created_at, updated_at
         FROM local_timeline_event_drafts
         WHERE account_user_id = ? AND draft_id = ?`,
        input.accountUserId,
        input.draftId,
      );

      return row && this.database.canUseGeneration(generation) ? mapMomentRow(row) : null;
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

function mapMomentRow(row: LocalMomentRow): LocalMomentDraft {
  return {
    accountUserId: row.account_user_id,
    tripId: row.trip_id,
    draftId: row.draft_id,
    type: parseType(row.event_type),
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    endsAt: row.ends_at,
    allDay: row.all_day === 1,
    stopId: row.stop_id,
    latitude: row.latitude,
    longitude: row.longitude,
    state: parseState(row.state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseType(value: string): LocalTimelineEventType {
  if (
    value === "MANUAL" ||
    value === "LOCATION" ||
    value === "PHOTO" ||
    value === "NOTE" ||
    value === "EXPENSE" ||
    value === "DOCUMENT" ||
    value === "TRANSPORT" ||
    value === "ACTIVITY"
  ) {
    return value;
  }
  throw new Error("Type de moment local invalide.");
}

function parseState(value: string): LocalMomentDraftState {
  if (
    value === "draft_local" ||
    value === "ready_to_sync" ||
    value === "syncing" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error("État de moment local invalide.");
}

export const localMomentDraftStore = new LocalMomentDraftStore();
