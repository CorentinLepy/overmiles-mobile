import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
const appConfig = await readFile(new URL("../app.json", import.meta.url), "utf8");
const keyStore = await readFile(
  new URL("../src/lib/storage/database-key-store.ts", import.meta.url),
  "utf8",
);
const database = await readFile(
  new URL("../src/lib/storage/local-database.ts", import.meta.url),
  "utf8",
);
const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);

test("COR-56 declares Expo SQLite and enables SQLCipher", () => {
  assert.match(packageJson, /"expo-sqlite": "~57\.0\.1"/);
  assert.match(appConfig, /"expo-sqlite"/);
  assert.match(appConfig, /"useSQLCipher": true/);
});

test("database key is random, device-bound and isolated from auth storage", () => {
  assert.match(keyStore, /getRandomBytesAsync\(DATABASE_KEY_BYTES\)/);
  assert.match(keyStore, /DATABASE_KEY_BYTES = 32/);
  assert.match(keyStore, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(keyStore, /app\.overmiles\.mobile\.storage/);
  assert.doesNotMatch(keyStore, /password|refresh-token|access-token/i);
});

test("SQLCipher key is applied before schema access and never logged", () => {
  const keyIndex = database.indexOf("sqlCipherKeyPragma(key)");
  const schemaIndex = database.indexOf("sqlite_master");
  assert.ok(keyIndex >= 0 && schemaIndex > keyIndex);
  assert.doesNotMatch(database, /console\.(log|debug|info|warn|error)/);
});

test("local schema contains durable sync infrastructure", () => {
  assert.match(migrations, /schema_migrations/);
  assert.match(migrations, /sync_metadata/);
  assert.match(migrations, /pending_operations/);
  assert.match(migrations, /app_state/);
  assert.match(migrations, /operation_id TEXT PRIMARY KEY/);
  assert.match(migrations, /retry_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(migrations, /conflict/);
});

test("migrations use transactions and bound values", () => {
  assert.match(migrations, /withTransactionAsync/);
  assert.match(migrations, /VALUES \(\?, \?, \?\)/);
  assert.match(migrations, /db\.runAsync/);
});

test("explicit purge removes both encrypted DB and its key", () => {
  const deleteDatabaseIndex = database.indexOf("deleteDatabaseAsync(DATABASE_NAME)");
  const clearKeyIndex = database.indexOf("this.keyStore.clearKey()", deleteDatabaseIndex);
  assert.ok(deleteDatabaseIndex >= 0 && clearKeyIndex > deleteDatabaseIndex);
});
