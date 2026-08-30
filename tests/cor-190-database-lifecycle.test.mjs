import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/storage/local-database.ts", import.meta.url),
  "utf8",
);
const VALID_KEY = "a".repeat(64);
const NEW_KEY = "b".repeat(64);

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function loadLocalDatabase({ sqlite, runLocalMigrations }) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };

  const mockRequire = (specifier) => {
    if (specifier === "expo-sqlite") return sqlite;
    if (specifier === "./migrations") return { runLocalMigrations };
    if (specifier === "./database-key-store") {
      return { DatabaseKeyStore: class DatabaseKeyStore {} };
    }
    throw new Error(`Unexpected dependency: ${specifier}`);
  };

  new Function("require", "module", "exports", compiled)(mockRequire, module, module.exports);
  return module.exports.LocalDatabase;
}

function createDatabaseHandle(name, events) {
  return {
    name,
    async execAsync() {},
    async getFirstAsync() {
      return { count: 1 };
    },
    async closeAsync() {
      events.push(`close:${name}`);
    },
  };
}

function createKeyStore(initialKey, events) {
  let key = initialKey;
  return {
    async readKey() {
      return key;
    },
    async generateKey() {
      events.push("generate-key");
      return NEW_KEY;
    },
    async storeKey(nextKey) {
      events.push("store-key");
      key = nextKey;
    },
    async clearKey() {
      events.push("clear-key");
      key = null;
    },
    currentKey() {
      return key;
    },
  };
}

test("COR-190 purge waits for an in-flight open, closes it, then wipes database and key", async () => {
  const events = [];
  const migrationStarted = deferred();
  const releaseMigration = deferred();
  const handles = [
    createDatabaseHandle("first", events),
    createDatabaseHandle("second", events),
  ];
  let openCount = 0;

  const sqlite = {
    async openDatabaseAsync() {
      const handle = handles[openCount];
      openCount += 1;
      events.push(`open:${handle.name}`);
      return handle;
    },
    async deleteDatabaseAsync() {
      events.push("delete-database");
    },
  };
  const runLocalMigrations = async () => {
    if (openCount === 1) {
      events.push("migration:first:start");
      migrationStarted.resolve();
      await releaseMigration.promise;
      events.push("migration:first:end");
    }
  };
  const keyStore = createKeyStore(VALID_KEY, events);
  const LocalDatabase = loadLocalDatabase({ sqlite, runLocalMigrations });
  const localDatabase = new LocalDatabase(keyStore);

  const firstOpen = localDatabase.open();
  await migrationStarted.promise;

  const purge = localDatabase.purge();
  const openRequestedDuringPurge = localDatabase.open();
  await Promise.resolve();

  assert.equal(openCount, 1, "an open requested during purge must not start early");
  assert.equal(events.includes("delete-database"), false);

  releaseMigration.resolve();
  assert.equal(await firstOpen, handles[0]);
  await purge;

  assert.equal(localDatabase.database, null);
  assert.equal(keyStore.currentKey(), null);
  assert.deepEqual(events.slice(0, 5), [
    "open:first",
    "migration:first:start",
    "migration:first:end",
    "close:first",
    "delete-database",
  ]);
  assert.equal(events[5], "clear-key");

  const reopened = await openRequestedDuringPurge;
  assert.equal(reopened, handles[1]);
  assert.equal(openCount, 2);
  assert.equal(keyStore.currentKey(), NEW_KEY);
  assert.ok(events.indexOf("open:second") > events.indexOf("clear-key"));
});

test("COR-190 keeps concurrent normal opens single-flight", async () => {
  const events = [];
  const migrationStarted = deferred();
  const releaseMigration = deferred();
  const handle = createDatabaseHandle("single", events);
  let openCount = 0;

  const sqlite = {
    async openDatabaseAsync() {
      openCount += 1;
      return handle;
    },
    async deleteDatabaseAsync() {},
  };
  const runLocalMigrations = async () => {
    migrationStarted.resolve();
    await releaseMigration.promise;
  };
  const keyStore = createKeyStore(VALID_KEY, events);
  const LocalDatabase = loadLocalDatabase({ sqlite, runLocalMigrations });
  const localDatabase = new LocalDatabase(keyStore);

  const first = localDatabase.open();
  await migrationStarted.promise;
  const second = localDatabase.open();

  assert.equal(openCount, 1);
  releaseMigration.resolve();
  assert.equal(await first, handle);
  assert.equal(await second, handle);
  assert.equal(openCount, 1);
});

test("COR-190 purge still clears SecureStore when close or delete fails", async () => {
  const events = [];
  const handle = createDatabaseHandle("failing", events);
  handle.closeAsync = async () => {
    events.push("close:failing");
    throw new Error("close failed");
  };

  const sqlite = {
    async openDatabaseAsync() {
      return handle;
    },
    async deleteDatabaseAsync() {
      events.push("delete-database");
      throw new Error("delete failed");
    },
  };
  const keyStore = createKeyStore(VALID_KEY, events);
  const LocalDatabase = loadLocalDatabase({ sqlite, runLocalMigrations: async () => {} });
  const localDatabase = new LocalDatabase(keyStore);

  await localDatabase.open();
  await assert.rejects(localDatabase.purge(), /close failed/);

  assert.equal(localDatabase.database, null);
  assert.equal(keyStore.currentKey(), null);
  assert.ok(events.includes("delete-database"));
  assert.ok(events.includes("clear-key"));
});
