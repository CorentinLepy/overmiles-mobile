import {
  localDatabase,
  type LocalDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";

import {
  deriveJournalDraftTitle,
  type LocalJournalDraft,
  type LocalJournalDraftState,
  type SaveLocalJournalDraftInput,
} from "./journal-draft";

type LocalJournalDraftRow = Readonly<{
  account_user_id: string;
  trip_id: string;
  draft_id: string;
  title: string;
  content: string;
  occurred_at: string;
  stop_id: string | null;
  state: string;
  created_at: string;
  updated_at: string;
}>;

export class LocalJournalDraftStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async getActive(
    accountUserId: string,
    tripId: string,
    generation: LocalDatabaseGeneration | null,
  ): Promise<LocalJournalDraft | null> {
    await this.writeQueue.catch(() => undefined);
    const db = await this.database.openForGeneration(generation);
    if (!db) return null;

    const row = await db.getFirstAsync<LocalJournalDraftRow>(
      `SELECT account_user_id, trip_id, draft_id, title, content, occurred_at, stop_id,
              state, created_at, updated_at
       FROM local_journal_drafts
       WHERE account_user_id = ? AND trip_id = ? AND state = 'draft_local'
       ORDER BY updated_at DESC
       LIMIT 1`,
      accountUserId,
      tripId,
    );

    if (!row || !this.database.canUseGeneration(generation)) return null;
    return mapDraftRow(row);
  }

  save(
    input: SaveLocalJournalDraftInput,
    generation: LocalDatabaseGeneration | null,
  ): Promise<LocalJournalDraft | null> {
    return this.enqueue(async () => {
      const db = await this.database.openForGeneration(generation);
      if (!db || !this.database.canUseGeneration(generation)) return null;

      const now = new Date().toISOString();
      const state = input.state ?? "draft_local";
      await db.runAsync(
        `INSERT INTO local_journal_drafts (
           account_user_id, trip_id, draft_id, title, content, occurred_at, stop_id,
           state, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_user_id, draft_id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           occurred_at = excluded.occurred_at,
           stop_id = excluded.stop_id,
           state = excluded.state,
           updated_at = excluded.updated_at`,
        input.accountUserId,
        input.tripId,
        input.draftId,
        deriveJournalDraftTitle(input.content),
        input.content,
        input.occurredAt,
        input.stopId ?? null,
        state,
        now,
        now,
      );

      if (!this.database.canUseGeneration(generation)) return null;
      const row = await db.getFirstAsync<LocalJournalDraftRow>(
        `SELECT account_user_id, trip_id, draft_id, title, content, occurred_at, stop_id,
                state, created_at, updated_at
         FROM local_journal_drafts
         WHERE account_user_id = ? AND draft_id = ?`,
        input.accountUserId,
        input.draftId,
      );

      return row && this.database.canUseGeneration(generation) ? mapDraftRow(row) : null;
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

function mapDraftRow(row: LocalJournalDraftRow): LocalJournalDraft {
  return {
    accountUserId: row.account_user_id,
    tripId: row.trip_id,
    draftId: row.draft_id,
    title: row.title,
    content: row.content,
    occurredAt: row.occurred_at,
    stopId: row.stop_id,
    state: parseState(row.state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseState(value: string): LocalJournalDraftState {
  if (
    value === "draft_local" ||
    value === "ready_to_sync" ||
    value === "syncing" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error("État de brouillon Carnet local invalide.");
}

export const localJournalDraftStore = new LocalJournalDraftStore();