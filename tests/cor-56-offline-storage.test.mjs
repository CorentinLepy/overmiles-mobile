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
  assert.match(packageJson, /"expo-sqlite": "~57\.0\.\d+"/);
  assert.match(appConfig, /"expo-sqlite"/);
  assert.match(appConfig, /"useSQLCipher": true/);
  assert.match(appConfig, /@maplibre\/maplibre-react-native/);
});

test("database key is random, device-bound and isolated from auth storage", () => {
  assert.match(keyStore, /getRandomBytesAsync\(DATABASE_KEY_BYTES\)/);
  assert.match(keyStore, /DATABASE_KEY_BYTES = 32/);
  assert.match(keyStore, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(keyStore, /app\.overmiles\.mobile\.storage/);
  assert.match(keyStore, /async generateKey\(\)/);
  assert.match(keyStore, /async storeKey\(key: string\)/);
  assert.doesNotMatch(keyStore, /getOrCreateKey/);
  assert.doesNotMatch(keyStore, /password|refresh-token|access-token/i);
});

test("SQLCipher key is applied before schema access and never logged", () => {
  const keyIndex = database.indexOf("sqlCipherKeyPragma(key)");
  const schemaIndex = database.indexOf("sqlite_master", keyIndex);
  assert.ok(keyIndex >= 0 && schemaIndex > keyIndex);
  assert.doesNotMatch(database, /console\.(log|debug|info|warn|error)/);
});

test("missing-key recovery never reuses an inaccessible encrypted database", () => {
  assert.match(database, /openWithoutStoredKey/);
  assert.match(database, /keyStore\.generateKey\(\)/);
  assert.match(database, /SQLite\.deleteDatabaseAsync\(DATABASE_NAME\)/);
  assert.match(database, /keyStore\.storeKey\(candidateKey\)/);

  const openIndex = database.indexOf("SQLite.openDatabaseAsync(DATABASE_NAME)");
  const deleteIndex = database.indexOf("SQLite.deleteDatabaseAsync(DATABASE_NAME)", openIndex);
  assert.ok(openIndex >= 0 && deleteIndex > openIndex);
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

test("secure purge clears the key even when database deletion fails", () => {
  const purgeIndex = database.indexOf("async purge()");
  const deleteDatabaseIndex = database.indexOf("deleteDatabaseAsync(DATABASE_NAME)", purgeIndex);
  const finallyIndex = database.indexOf("finally", deleteDatabaseIndex);
  const clearKeyIndex = database.indexOf("this.keyStore.clearKey()", finallyIndex);
  assert.ok(
    purgeIndex >= 0 &&
      deleteDatabaseIndex > purgeIndex &&
      finallyIndex > deleteDatabaseIndex &&
      clearKeyIndex > finallyIndex,
  );
});

test("database lifecycle serializes open close and secure purge", () => {
  assert.match(database, /private closing: Promise<void> \| null = null/);
  assert.match(database, /private purging: Promise<void> \| null = null/);
  assert.match(
    database,
    /if \(this\.purging\) \{[\s\S]*await this\.purging[\s\S]*return this\.open\(\)/,
  );
  assert.match(database, /const opening = this\.opening;[\s\S]*await opening\.catch/);
  assert.match(
    database,
    /const database = this\.database;[\s\S]*this\.database = null/,
  );

  const purgeIndex = database.indexOf("async purge()");
  const openingIndex = database.indexOf("const opening = this.opening", purgeIndex);
  const deleteIndex = database.indexOf(
    "SQLite.deleteDatabaseAsync(DATABASE_NAME)",
    purgeIndex,
  );
  assert.ok(
    purgeIndex >= 0 && openingIndex > purgeIndex && deleteIndex > openingIndex,
  );
});

test("SDK 57 purge safety keeps DELETE journaling until Expo WAL cleanup is fixed", () => {
  assert.match(database, /PRAGMA journal_mode = DELETE/);
  assert.doesNotMatch(database, /PRAGMA journal_mode = WAL/);
});
