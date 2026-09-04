import type { PendingOperation } from "./pending-operations-store";
import { PendingOperationsStore } from "./pending-operations-store";

export type SyncState = "idle" | "pending" | "syncing" | "failed" | "conflict";

export interface SyncEngine {
  getState(): SyncState;
  requestSync(): Promise<void>;
}

export type SyncTransportResult =
  | Readonly<{
      outcome: "applied";
      serverVersion: number;
      serverUpdatedAt?: string | null;
      serverUpdatedBy?: string | null;
    }>
  | Readonly<{ outcome: "conflict"; errorCode?: string }>
  | Readonly<{ outcome: "retryable"; errorCode: string }>
  | Readonly<{ outcome: "fatal"; errorCode: string }>
  | Readonly<{ outcome: "aborted" }>;

export type SyncTransport = (operation: PendingOperation) => Promise<SyncTransportResult>;

export type SyncRunSummary = Readonly<{
  processed: number;
  applied: number;
  conflicts: number;
  deferred: number;
  failed: number;
}>;

const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 2_000;

export class OfflineSyncEngine implements SyncEngine {
  private running: Promise<SyncRunSummary> | null = null;
  private state: SyncState = "idle";

  constructor(
    private readonly store: PendingOperationsStore,
    private readonly transport: SyncTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getState(): SyncState {
    return this.state;
  }

  async requestSync(): Promise<void> {
    await this.runOnce();
  }

  runOnce(limit = 25): Promise<SyncRunSummary> {
    if (!this.running) {
      this.running = this.performRun(limit).finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async performRun(limit: number): Promise<SyncRunSummary> {
    await this.store.recoverInterrupted();
    const operations = await this.store.listReady(limit, this.now());
    if (operations.length === 0) {
      this.state = "idle";
      return { processed: 0, applied: 0, conflicts: 0, deferred: 0, failed: 0 };
    }

    this.state = "syncing";
    const summary = { processed: 0, applied: 0, conflicts: 0, deferred: 0, failed: 0 };

    for (const operation of operations) {
      summary.processed += 1;
      await this.store.markSending(operation.operationId);

      let result: SyncTransportResult;
      try {
        result = await this.transport(operation);
      } catch {
        result = { outcome: "retryable", errorCode: "SYNC_TRANSPORT_ERROR" };
      }

      if (result.outcome === "aborted") {
        // Do not touch SQLCipher after the authenticated local-write generation is invalidated.
        // A later run recovers this `sending` operation back to pending if the DB was not purged.
        summary.deferred += 1;
        continue;
      }

      if (result.outcome === "applied") {
        await this.store.completeApplied(operation, {
          serverVersion: result.serverVersion,
          serverUpdatedAt: result.serverUpdatedAt ?? null,
          serverUpdatedBy: result.serverUpdatedBy ?? null,
          syncedAt: this.now().toISOString(),
        });
        summary.applied += 1;
        continue;
      }

      if (result.outcome === "conflict") {
        await this.store.markConflict(operation.operationId, result.errorCode);
        summary.conflicts += 1;
        continue;
      }

      if (result.outcome === "fatal") {
        await this.store.markFailed(operation.operationId, result.errorCode);
        summary.failed += 1;
        continue;
      }

      await this.store.markPending(
        operation.operationId,
        result.errorCode,
        nextAttemptIso(this.now(), operation.retryCount + 1),
      );
      summary.deferred += 1;
    }

    this.state =
      summary.conflicts > 0
        ? "conflict"
        : summary.failed > 0
          ? "failed"
          : summary.deferred > 0
            ? "pending"
            : "idle";
    return summary;
  }
}

export function retryDelayMs(retryCount: number): number {
  const boundedRetryCount = Math.max(1, Math.min(Math.trunc(retryCount), 10));
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** (boundedRetryCount - 1), MAX_RETRY_DELAY_MS);
}

function nextAttemptIso(now: Date, retryCount: number): string {
  return new Date(now.getTime() + retryDelayMs(retryCount)).toISOString();
}
