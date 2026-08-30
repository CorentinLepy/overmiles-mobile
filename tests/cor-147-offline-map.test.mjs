import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const localStore = await readFile(
  new URL("../src/features/map/local-map-store.ts", import.meta.url),
  "utf8",
);
const stopsRepository = await readFile(
  new URL("../src/features/map/map-stops-repository.ts", import.meta.url),
  "utf8",
);
const timelineRepository = await readFile(
  new URL("../src/features/map/map-timeline-repository.ts", import.meta.url),
  "utf8",
);
const provider = await readFile(
  new URL("../src/features/map/use-map-data.ts", import.meta.url),
  "utf8",
);

test("COR-147F stores map business points in SQLCipher with account and trip scoping", () => {
  assert.match(migrations, /version: 4/);
  assert.match(migrations, /offline-map-data-cache/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS cached_map_points/);
  assert.match(migrations, /account_user_id TEXT NOT NULL/);
  assert.match(migrations, /point_kind IN \('stop', 'timeline', 'location'\)/);
  assert.match(migrations, /PRIMARY KEY \(account_user_id, trip_id, point_kind, point_id\)/);
  assert.match(localStore, /WHERE account_user_id = \? AND trip_id = \? AND point_kind = \?/);
});

test("map cache snapshots serialize writes on the already-keyed SQLCipher connection", () => {
  assert.match(localStore, /private writeQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(localStore, /return this\.enqueueWrite\(async \(\) =>/);
  assert.match(localStore, /withTransactionAsync/);
  assert.doesNotMatch(localStore, /withExclusiveTransactionAsync/);
  assert.match(localStore, /await db\.runAsync/);
  assert.match(localStore, /DELETE FROM cached_map_points/);
  assert.match(localStore, /point_kind = \?/);
  assert.match(localStore, /INSERT INTO cached_map_points/);
  assert.match(localStore, /assertCacheablePoint/);
  assert.match(localStore, /this\.writeQueue = run\.catch\(\(\) => undefined\)/);
});

test("account cache clearing is ordered behind pending map writes", () => {
  const clearAccount = localStore.slice(localStore.indexOf("clearAccount("));
  assert.match(clearAccount, /return this\.enqueueWrite\(async \(\) =>/);
  assert.match(clearAccount, /DELETE FROM cached_map_points WHERE account_user_id = \?/);
});

test("remote stops and timeline hydration persist projected points before returning", () => {
  const remoteStops = stopsRepository.slice(stopsRepository.indexOf("async listTripStops"));
  const remoteTimeline = timelineRepository.slice(
    timelineRepository.indexOf("async listTripEvents"),
  );

  assert.match(stopsRepository, /listCachedTripStops/);
  assert.match(stopsRepository, /localStore\.list\(accountUserId, trip\.id, "stop"\)/);
  assert.match(
    remoteStops,
    /localStore\.replaceTripKind\(accountUserId, trip\.id, "stop", points, canPersist\)/,
  );
  assert.match(remoteStops, /return points;/);
  assert.doesNotMatch(remoteStops, /return localStore\.list/);

  assert.match(timelineRepository, /listCachedTripEvents/);
  assert.match(timelineRepository, /localStore\.list\(accountUserId, trip\.id, "timeline"\)/);
  assert.match(
    remoteTimeline,
    /localStore\.replaceTripKind\(accountUserId, trip\.id, "timeline", points, canPersist\)/,
  );
  assert.match(remoteTimeline, /return points;/);
  assert.doesNotMatch(remoteTimeline, /return localStore\.list/);
});

test("Map provider reads SQLCipher first and never starts business API fan-out in offline auth", () => {
  assert.match(provider, /status === "offline_auth_pending" && user !== null/);
  const loaderIndex = provider.indexOf("async function loadActiveMapData()");
  const cachedIndex = provider.indexOf("collectCachedMapData", loaderIndex);
  const offlineIndex = provider.indexOf("if (offlineOnly)", cachedIndex);
  const remoteIndex = provider.indexOf("collectRemoteMapData", offlineIndex);

  assert.ok(loaderIndex >= 0 && cachedIndex > loaderIndex);
  assert.ok(offlineIndex > cachedIndex && remoteIndex > offlineIndex);
  assert.match(provider.slice(offlineIndex, remoteIndex), /type: "load-offline"/);
  assert.match(provider.slice(offlineIndex, remoteIndex), /return;/);
});

test("partial remote failures retain the cached points for only the failed trip source", () => {
  assert.match(provider, /fallbackPoints\.filter/);
  assert.match(provider, /point\.tripId === task\.tripId && point\.kind === task\.kind/);
  assert.match(provider, /result\.failures\.every\(isOfflineFailure\)/);
});

test("returning from offline auth creates a distinct load key and rehydrates from server", () => {
  assert.match(
    provider,
    /const loadKey = `\$\{user\?\.id \?\? "anonymous"\}:\$\{status\}:\$\{tripsKey\}`/,
  );
  assert.match(provider, /await retryRestore\(\)/);
  assert.match(provider, /runtime\.loadedTripsKey === loadKey/);
});
