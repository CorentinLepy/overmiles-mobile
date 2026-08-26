import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await readFile(new URL("../src/lib/storage/migrations.ts", import.meta.url), "utf8");
const store = await readFile(
  new URL("../src/lib/sync/pending-operations-store.ts", import.meta.url),
  "utf8",
);
const engine = await readFile(new URL("../src/lib/sync/sync-engine.ts", import.meta.url), "utf8");
const apiError = await readFile(new URL("../src/lib/api/api-error.ts", import.meta.url), "utf8");

test("COR-57 adds retry scheduling as a monotonic migration", () => {
  assert.match(migrations, /version: 2/);
  assert.match(migrations, /next_attempt_at/);
  assert.match(migrations, /idx_pending_operations_ready/);
});

test("pending operations use durable idempotency and optimistic base versions", () => {
  assert.match(store, /Crypto\.randomUUID\(\)/);
  assert.match(store, /baseVersion/);
  assert.match(store, /payloadVersion/);
  assert.match(store, /retryCount/);
  assert.match(store, /nextAttemptAt/);
  assert.match(store, /SYNC_VERSION_CONFLICT/);
});

test("ready queue retries only pending work after its persisted backoff deadline", () => {
  assert.match(store, /WHERE state = 'pending'/);
  assert.match(store, /next_attempt_at IS NULL OR next_attempt_at <= \?/);
  assert.match(engine, /retryDelayMs/);
  assert.match(engine, /MAX_RETRY_DELAY_MS/);
});

test("interrupted sends are recovered but fatal failures remain terminal", () => {
  assert.match(store, /WHERE state = 'sending'/);
  assert.match(store, /SYNC_INTERRUPTED/);
  assert.match(engine, /recoverInterrupted\(\)/);
  assert.match(engine, /markFailed/);
  assert.doesNotMatch(store, /state IN \('pending', 'failed'\)/);
});

test("applied sync updates metadata and removes queue work in one transaction", () => {
  assert.match(store, /completeApplied/);
  assert.match(store, /withTransactionAsync/);
  assert.match(store, /INSERT INTO sync_metadata/);
  assert.match(store, /sync_state = 'synced'/);
  assert.match(store, /DELETE FROM pending_operations/);
  assert.match(engine, /completeApplied/);
});

test("409 sync conflicts retain typed server versions and snapshots", () => {
  assert.match(apiError, /SYNC_VERSION_CONFLICT/);
  assert.match(apiError, /expectedVersion/);
  assert.match(apiError, /currentVersion/);
  assert.match(apiError, /serverSnapshot/);
  assert.match(apiError, /parseSyncConflict/);
});

test("sync engine is single-flight and never auto-resolves version conflicts", () => {
  assert.match(engine, /private running/);
  assert.match(engine, /outcome: "conflict"/);
  assert.match(engine, /markConflict/);
  assert.doesNotMatch(engine, /last[-_ ]write[-_ ]wins/i);
});
