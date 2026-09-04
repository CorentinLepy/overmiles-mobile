import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const transport = await readFile(
  new URL("../src/features/trips/trip-sync-transport.ts", import.meta.url),
  "utf8",
);
const repository = await readFile(
  new URL("../src/features/trips/trips-repository.ts", import.meta.url),
  "utf8",
);
const runtime = await readFile(
  new URL("../src/features/trips/trip-sync-runtime.ts", import.meta.url),
  "utf8",
);
const types = await readFile(
  new URL("../src/features/trips/trips.types.ts", import.meta.url),
  "utf8",
);
const provider = await readFile(
  new URL("../src/features/trips/trips-data-provider.tsx", import.meta.url),
  "utf8",
);

test("COR-193 sends versioned idempotent Trip updates", () => {
  assert.match(transport, /operation\.entityType !== "Trip"/);
  assert.match(transport, /operation\.operationKind !== "update"/);
  assert.match(transport, /method: "PATCH"/);
  assert.match(transport, /idempotencyKey: operation\.operationId/);
  assert.match(transport, /allowAuthReplay: true/);
  assert.match(transport, /expectedVersion: operation\.baseVersion/);
});

test("COR-193 caches the authoritative Trip before completion", () => {
  const cacheIndex = transport.indexOf(
    "await localStore.upsert(accountUserId, updatedTrip, canPersist)",
  );
  const appliedIndex = transport.indexOf('outcome: "applied"', cacheIndex);

  assert.ok(cacheIndex >= 0);
  assert.ok(appliedIndex > cacheIndex);
  assert.match(transport, /serverVersion: updatedTrip\.version/);
  assert.match(transport, /serverUpdatedBy: updatedTrip\.updatedByUserId \?\? null/);
});

test("COR-193 preserves conflict and retry semantics", () => {
  assert.match(transport, /error\.code === "SYNC_VERSION_CONFLICT"/);
  assert.match(transport, /outcome: "conflict"/);
  assert.match(transport, /error\.retryable/);
  assert.match(transport, /outcome: "retryable"/);
  assert.match(transport, /outcome: "fatal"/);
});

test("COR-193 refuses blind offline Trip updates", () => {
  assert.match(repository, /localStore\.getById\(accountUserId, tripId\)/);
  assert.match(repository, /isServerVersion\(current\.version\)/);
  assert.match(repository, /baseVersion: current\.version/);
  assert.match(repository, /operationKind: "update"/);
  assert.doesNotMatch(repository, /operationKind: "delete"/);
  assert.match(types, /export type TripUpdatePatch/);
  assert.match(types, /updatedByUserId\?: string \| null/);
});

test("COR-193 composes sync without activating it before backend rollout", () => {
  assert.match(runtime, /new PendingOperationsStore\(\)/);
  assert.match(runtime, /new OfflineSyncEngine\(pendingStore, transport\)/);
  assert.match(runtime, /createTripSyncTransport/);
  assert.doesNotMatch(provider, /createTripSyncRuntime/);
  assert.doesNotMatch(transport, /operationKind === "delete"/);
});
