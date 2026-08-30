import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
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

function loadLocalMapStore() {
  const compiled = ts.transpileModule(storeSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const mockRequire = (specifier) => {
    if (specifier === "@/src/lib/storage/local-database") return { localDatabase: {} };
    throw new Error(`Unexpected dependency: ${specifier}`);
  };

  new Function("require", "module", "exports", compiled)(mockRequire, module, module.exports);
  return module.exports.LocalMapStore;
}

function createDatabase() {
  const writes = [];
  const database = {
    async open() {
      return database;
    },
    async openIf(shouldOpen) {
      return shouldOpen() ? database : null;
    },
    async withTransactionAsync(task) {
      await task();
    },
    async runAsync(sql, ...args) {
      writes.push({ sql, args });
    },
    async getAllAsync() {
      return [];
    },
    async getFirstAsync() {
      return null;
    },
  };
  return { database, writes };
}

test("COR-197 adds account-scoped snapshot freshness metadata", () => {
  assert.match(migrations, /version: 5/);
  assert.match(migrations, /offline-map-snapshot-freshness/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS cached_map_snapshots/);
  assert.match(migrations, /item_count INTEGER NOT NULL CHECK \(item_count >= 0\)/);
  assert.match(migrations, /trip_version INTEGER/);
  assert.match(migrations, /trip_updated_at TEXT/);
  assert.match(migrations, /PRIMARY KEY \(account_user_id, trip_id, point_kind\)/);
});

test("COR-197 persists an empty snapshot as a completed cache snapshot", async () => {
  const LocalMapStore = loadLocalMapStore();
  const { database, writes } = createDatabase();
  const store = new LocalMapStore(database);

  await store.replaceTripKind("user-1", "trip-1", "stop", [], () => true, {
    tripVersion: 7,
    tripUpdatedAt: "2026-08-30T10:00:00Z",
  });

  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /DELETE FROM cached_map_points/);
  assert.match(writes[1].sql, /INSERT INTO cached_map_snapshots/);
  assert.deepEqual(writes[1].args.slice(0, 6), [
    "user-1",
    "trip-1",
    "stop",
    0,
    7,
    "2026-08-30T10:00:00Z",
  ]);
});

test("COR-197 never marks a snapshot complete after session invalidation", async () => {
  const LocalMapStore = loadLocalMapStore();
  const { database, writes } = createDatabase();
  const store = new LocalMapStore(database);
  let checks = 0;
  const shouldWrite = () => {
    checks += 1;
    return checks < 4;
  };

  await store.replaceTripKind("user-1", "trip-1", "timeline", [], shouldWrite, {
    tripVersion: 8,
  });

  assert.equal(writes.some(({ sql }) => /cached_map_snapshots/.test(sql)), false);
});

test("COR-197 exposes persisted snapshot metadata for future Companion UX", async () => {
  const LocalMapStore = loadLocalMapStore();
  const { database } = createDatabase();
  database.getFirstAsync = async () => ({
    item_count: 0,
    trip_version: 7,
    trip_updated_at: "2026-08-30T10:00:00Z",
    cached_at: "2026-08-30T10:01:00Z",
  });
  const store = new LocalMapStore(database);

  assert.deepEqual(await store.getSnapshot("user-1", "trip-1", "stop"), {
    accountUserId: "user-1",
    tripId: "trip-1",
    kind: "stop",
    itemCount: 0,
    tripVersion: 7,
    tripUpdatedAt: "2026-08-30T10:00:00Z",
    cachedAt: "2026-08-30T10:01:00Z",
  });
});

test("COR-197 clears points and freshness metadata for the account", () => {
  const clearAccount = storeSource.slice(storeSource.indexOf("clearAccount("));
  assert.match(clearAccount, /DELETE FROM cached_map_points WHERE account_user_id = \?/);
  assert.match(clearAccount, /DELETE FROM cached_map_snapshots WHERE account_user_id = \?/);
});

test("COR-197 repositories attach current Trip freshness to snapshots", () => {
  for (const repository of [stopsRepository, timelineRepository]) {
    assert.match(repository, /tripVersion: trip\.version \?\? null/);
    assert.match(repository, /tripUpdatedAt: trip\.updatedAt \?\? null/);
  }
});
