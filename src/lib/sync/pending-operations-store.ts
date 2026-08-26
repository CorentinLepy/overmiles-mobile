import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import { localDatabase } from "@/src/lib/storage/local-database";

export type PendingOperationState = "pending" | "sending" | "conflict" | "failed";
export type PendingOperationKind = "create" | "update" | "delete";

export type PendingOperation = Readonly<{
  operationId: string;
  entityType: string;
  entityId: string;
  operationKind: PendingOperationKind;
  payload: unknown;
  payloadVersion: number;
  baseVersion: number | null;
  createdAt: string;
  retryCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  state: PendingOperationState;
}>;

export type EnqueueOperationInput = Readonly<{
  entityType: string;
  entityId: string;
  operationKind: PendingOperationKind;
  payload: unknown;
  payloadVersion?: number;
  baseVersion?: number | null;
}>;

export type AppliedSyncMetadata = Readonly<{
  serverVersion: number;
  serverUpdatedAt?: string | null;
  serverUpdatedBy?: string | null;
  syncedAt?: string;
}>;

type PendingOperationRow = Readonly<{
  operation_id: string;
  entity_type: string;
  entity_id: string;
  operation_kind: string;
  payload_json: string;
  payload_version: number;
  base_version: number | null;
  created_at: string;
  retry_count: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  state: string;
}>;

export class PendingOperationsStore {
  constructor(
    private readonly openDatabase: () => Promise<SQLiteDatabase> = () => localDatabase.open(),
  ) {}

  async enqueue(input: EnqueueOperationInput): Promise<PendingOperation> {
    const database = await this.openDatabase();
    const operation: PendingOperation = {
      operationId: Crypto.randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      operationKind: input.operationKind,
      payload: input.payload,
      payloadVersion: input.payloadVersion ?? 1,
      baseVersion: input.baseVersion ?? null,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      state: "pending",
    };

    await database.runAsync(
      `INSERT INTO pending_operations (
        operation_id, entity_type, entity_id, operation_kind, payload_json, payload_version,
        base_version, created_at, retry_count, next_attempt_at, last_error_code, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      operation.operationId,
      operation.entityType,
      operation.entityId,
      operation.operationKind,
      JSON.stringify(operation.payload),
      operation.payloadVersion,
      operation.baseVersion,
      operation.createdAt,
      operation.retryCount,
      operation.nextAttemptAt,
      operation.lastErrorCode,
      operation.state,
    );

    return operation;
  }

  async recoverInterrupted(): Promise<void> {
    const database = await this.openDatabase();
    await database.runAsync(
      `UPDATE pending_operations
       SET state = 'pending',
           last_error_code = 'SYNC_INTERRUPTED',
           next_attempt_at = NULL,
           retry_count = retry_count + 1
       WHERE state = 'sending'`,
    );
  }

  async listReady(limit = 25, now = new Date()): Promise<PendingOperation[]> {
    const database = await this.openDatabase();
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const rows = await database.getAllAsync<PendingOperationRow>(
      `SELECT * FROM pending_operations
       WHERE state = 'pending'
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
      now.toISOString(),
      safeLimit,
    );
    return rows.map(mapRow);
  }

  async markSending(operationId: string): Promise<void> {
    await this.updateState(operationId, "sending", null, null, false);
  }

  async markPending(
    operationId: string,
    errorCode: string | null = null,
    nextAttemptAt: string | null = null,
  ): Promise<void> {
    await this.updateState(operationId, "pending", errorCode, nextAttemptAt, true);
  }

  async markFailed(operationId: string, errorCode: string): Promise<void> {
    await this.updateState(operationId, "failed", errorCode, null, true);
  }

  async markConflict(operationId: string, errorCode = "SYNC_VERSION_CONFLICT"): Promise<void> {
    await this.updateState(operationId, "conflict", errorCode, null, false);
  }

  async completeApplied(
    operation: PendingOperation,
    metadata: AppliedSyncMetadata,
  ): Promise<void> {
    const database = await this.openDatabase();
    const syncedAt = metadata.syncedAt ?? new Date().toISOString();

    await database.withTransactionAsync(async () => {
      await database.runAsync(
        `INSERT INTO sync_metadata (
          entity_type, entity_id, version, updated_at, updated_by, sync_state, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET
          version = excluded.version,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by,
          sync_state = 'synced',
          last_synced_at = excluded.last_synced_at`,
        operation.entityType,
        operation.entityId,
        metadata.serverVersion,
        metadata.serverUpdatedAt ?? null,
        metadata.serverUpdatedBy ?? null,
        syncedAt,
      );
      await database.runAsync(
        "DELETE FROM pending_operations WHERE operation_id = ?",
        operation.operationId,
      );
    });
  }

  private async updateState(
    operationId: string,
    state: PendingOperationState,
    errorCode: string | null,
    nextAttemptAt: string | null,
    incrementRetry: boolean,
  ): Promise<void> {
    const database = await this.openDatabase();
    await database.runAsync(
      `UPDATE pending_operations
       SET state = ?,
           last_error_code = ?,
           next_attempt_at = ?,
           retry_count = retry_count + ?
       WHERE operation_id = ?`,
      state,
      errorCode,
      nextAttemptAt,
      incrementRetry ? 1 : 0,
      operationId,
    );
  }
}

function mapRow(row: PendingOperationRow): PendingOperation {
  return {
    operationId: row.operation_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operationKind: parseOperationKind(row.operation_kind),
    payload: JSON.parse(row.payload_json) as unknown,
    payloadVersion: row.payload_version,
    baseVersion: row.base_version,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    lastErrorCode: row.last_error_code,
    state: parseState(row.state),
  };
}

function parseOperationKind(value: string): PendingOperationKind {
  if (value === "create" || value === "update" || value === "delete") return value;
  throw new Error(`Unsupported pending operation kind: ${value}`);
}

function parseState(value: string): PendingOperationState {
  if (
    value === "pending" ||
    value === "sending" ||
    value === "conflict" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error(`Unsupported pending operation state: ${value}`);
}
