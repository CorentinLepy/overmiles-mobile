import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const freshnessSource = await readFile(
  new URL("../src/features/map/map-snapshot-freshness.ts", import.meta.url),
  "utf8",
);
const mapProviderSource = await readFile(
  new URL("../src/features/map/use-map-data.ts", import.meta.url),
  "utf8",
);

function loadFreshnessModule() {
  const compiled = ts.transpileModule(freshnessSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

function trip(id, version = 4, updatedAt = "2026-09-01T10:00:00Z") {
  return {
    id,
    ownerId: "owner-1",
    name: id,
    description: null,
    status: "ACTIVE",
    startsAt: "2026-09-01T00:00:00Z",
    endsAt: "2026-09-10T00:00:00Z",
    countries: [],
    coverImageUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt,
    version,
  };
}

function snapshot(tripId, kind, version = 4, updatedAt = "2026-09-01T10:00:00Z") {
  return {
    accountUserId: "user-1",
    tripId,
    kind,
    itemCount: 0,
    tripVersion: version,
    tripUpdatedAt: updatedAt,
    cachedAt: "2026-09-01T10:05:00Z",
  };
}

test("COR-256 fresh stop and timeline snapshots require no automatic remote source", () => {
  const { selectStaleMapSources } = loadFreshnessModule();
  const currentTrip = trip("trip-1");

  const stale = selectStaleMapSources(
    [currentTrip],
    [snapshot("trip-1", "stop"), snapshot("trip-1", "timeline")],
  );

  assert.deepEqual(stale, []);
});

test("COR-256 only the invalidated source of a trip is selected", () => {
  const { selectStaleMapSources } = loadFreshnessModule();
  const currentTrip = trip("trip-1", 5, "2026-09-01T11:00:00Z");

  const stale = selectStaleMapSources(
    [currentTrip],
    [
      snapshot("trip-1", "stop", 5, "2026-09-01T11:00:00Z"),
      snapshot("trip-1", "timeline", 4, "2026-09-01T10:00:00Z"),
    ],
  );

  assert.deepEqual(
    stale.map(({ trip: selectedTrip, kind }) => `${selectedTrip.id}:${kind}`),
    ["trip-1:timeline"],
  );
});

test("COR-256 a missing zero-item snapshot is stale but an existing empty snapshot is fresh", () => {
  const { selectStaleMapSources } = loadFreshnessModule();
  const currentTrip = trip("trip-1");

  const stale = selectStaleMapSources([currentTrip], [snapshot("trip-1", "stop")]);

  assert.deepEqual(
    stale.map(({ kind }) => kind),
    ["timeline"],
  );
});

test("COR-256 a changed trip version or updatedAt invalidates both map source snapshots", () => {
  const { selectStaleMapSources } = loadFreshnessModule();
  const updatedTrip = trip("trip-1", 5, "2026-09-01T12:00:00Z");

  const stale = selectStaleMapSources(
    [updatedTrip],
    [snapshot("trip-1", "stop"), snapshot("trip-1", "timeline")],
  );

  assert.deepEqual(
    stale.map(({ kind }) => kind),
    ["stop", "timeline"],
  );
});

test("COR-256 explicit refresh still enumerates every source", () => {
  const { createAllMapSources } = loadFreshnessModule();
  const sources = createAllMapSources([trip("trip-1"), trip("trip-2")]);

  assert.deepEqual(
    sources.map(({ trip: selectedTrip, kind }) => `${selectedTrip.id}:${kind}`),
    ["trip-1:stop", "trip-1:timeline", "trip-2:stop", "trip-2:timeline"],
  );
  assert.match(mapProviderSource, /createAllMapSources\(activeTrips\)/);
});

test("COR-256 automatic map load consults persisted snapshots before remote repositories", () => {
  const snapshotsIndex = mapProviderSource.indexOf("listMapSnapshotsSafe(activeAccountUserId)");
  const staleIndex = mapProviderSource.indexOf("selectStaleMapSources(activeTrips, snapshots)");
  const remoteIndex = mapProviderSource.indexOf("collectRemoteMapData(", staleIndex);

  assert.ok(snapshotsIndex >= 0 && staleIndex > snapshotsIndex && remoteIndex > staleIndex);
  assert.match(mapProviderSource, /if \(sources.length === 0\)/);
});
