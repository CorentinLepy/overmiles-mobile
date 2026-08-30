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

test("map cache snapshots replace one source atomically without erasing another source", () => {
  assert.match(localStore, /withTransactionAsync/);
  assert.match(localStore, /DELETE FROM cached_map_points/);
  assert.match(localStore, /point_kind = \?/);
  assert.match(localStore, /INSERT INTO cached_map_points/);
  assert.match(localStore, /assertCacheablePoint/);
});

test("remote stops and timeline hydration persist projected points before returning", () => {
  assert.match(stopsRepository, /listCachedTripStops/);
  assert.match(stopsRepository, /localStore\.list\(accountUserId, trip\.id, "stop"\)/);
  assert.match(
    stopsRepository,
    /localStore\.replaceTripKind\(accountUserId, trip\.id, "stop", points\)/,
  );
  assert.match(timelineRepository, /listCachedTripEvents/);
  assert.match(timelineRepository, /localStore\.list\(accountUserId, trip\.id, "timeline"\)/);
  assert.match(
    timelineRepository,
    /localStore\.replaceTripKind\(accountUserId, trip\.id, "timeline", points\)/,
  );
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
