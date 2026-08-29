import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const localStore = await readFile(
  new URL("../src/features/trips/local-trips-store.ts", import.meta.url),
  "utf8",
);
const repository = await readFile(
  new URL("../src/features/trips/trips-repository.ts", import.meta.url),
  "utf8",
);
const provider = await readFile(
  new URL("../src/features/trips/trips-data-provider.tsx", import.meta.url),
  "utf8",
);

test("COR-147 caches Trips in SQLCipher with account scoping", () => {
  assert.match(migrations, /version: 3/);
  assert.match(migrations, /offline-trip-cache/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS cached_trips/);
  assert.match(migrations, /account_user_id TEXT NOT NULL/);
  assert.match(migrations, /PRIMARY KEY \(account_user_id, trip_id\)/);
  assert.match(localStore, /WHERE account_user_id = \?/);
});

test("server hydration replaces the account snapshot transactionally before UI reads it", () => {
  assert.match(localStore, /withTransactionAsync/);
  assert.match(localStore, /DELETE FROM cached_trips WHERE account_user_id = \?/);
  assert.match(localStore, /ON CONFLICT\(account_user_id, trip_id\) DO UPDATE/);

  const remoteIndex = repository.indexOf('path: "/trips"');
  const persistIndex = repository.indexOf("localStore.replaceAll", remoteIndex);
  const localReadIndex = repository.indexOf("localStore.list", persistIndex);
  assert.ok(remoteIndex >= 0 && persistIndex > remoteIndex && localReadIndex > persistIndex);
});

test("Trips provider renders encrypted local data before attempting network hydration", () => {
  const localIndex = provider.indexOf("activeRepository.listCached()");
  const refreshIndex = provider.indexOf("activeRepository.refresh()", localIndex);
  assert.ok(localIndex >= 0 && refreshIndex > localIndex);
  assert.match(provider, /setTrips\(sortTrips\(cachedTrips\)\)/);
  assert.match(provider, /if \(cachedTrips\.length > 0\) setIsLoading\(false\)/);
});

test("offline cache stays account-scoped and remote detail loading stays authenticated-only", () => {
  assert.match(
    provider,
    /apiClient && user \? createTripsRepository\(apiClient, user\.id\) : null/,
  );
  assert.match(provider, /status === "offline_auth_pending" && user !== null/);
  assert.match(provider, /if \(status !== "authenticated"\) return null/);
  assert.match(repository, /localStore\.list\(accountUserId\)/);
  assert.match(repository, /localStore\.getById\(accountUserId, tripId\)/);
});

test("trip details populate the same local cache used by Home and Voyages", () => {
  assert.match(repository, /localStore\.upsert\(accountUserId, remoteTrip\)/);
  assert.match(provider, /repository\.getCachedById\(tripId\)/);
  assert.match(provider, /repository\.getById\(tripId\)/);
});
