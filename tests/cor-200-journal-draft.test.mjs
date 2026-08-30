import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const database = await readFile(
  new URL("../src/lib/storage/local-database.ts", import.meta.url),
  "utf8",
);
const draftSource = await readFile(
  new URL("../src/features/journal/journal-draft.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../src/features/journal/journal-draft-store.ts", import.meta.url),
  "utf8",
);
const screenSource = await readFile(
  new URL("../src/features/journal/screens/quick-journal-screen.tsx", import.meta.url),
  "utf8",
);
const tripDetailSource = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);
const tripsLayoutSource = await readFile(
  new URL("../app/(tabs)/trips/_layout.tsx", import.meta.url),
  "utf8",
);
const routeSource = await readFile(
  new URL("../app/(tabs)/trips/[tripId]/journal.tsx", import.meta.url),
  "utf8",
);

function loadDraftModule() {
  const compiled = ts.transpileModule(draftSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

test("COR-200 adds account-scoped durable Journal drafts to SQLCipher", () => {
  assert.match(migrations, /version: 6/);
  assert.match(migrations, /name: "offline-journal-drafts"/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS local_journal_drafts/);
  assert.match(migrations, /account_user_id TEXT NOT NULL/);
  assert.match(migrations, /trip_id TEXT NOT NULL/);
  assert.match(migrations, /draft_id TEXT NOT NULL/);
  assert.match(migrations, /draft_local.*ready_to_sync.*syncing.*failed/s);
  assert.match(migrations, /idx_local_journal_drafts_active_trip/);
  assert.match(migrations, /WHERE state = 'draft_local'/);
});

test("COR-200 invalidates stale local operations before a secure database purge", () => {
  assert.match(database, /captureGeneration\(\): LocalDatabaseGeneration \| null/);
  assert.match(database, /canUseGeneration\(generation: LocalDatabaseGeneration \| null\)/);
  assert.match(database, /openForGeneration/);
  assert.match(database, /private lifecycleGeneration = 0/);
  assert.match(database, /private purgeRequested = false/);

  const purgeIndex = database.indexOf("async purge()");
  const generationIndex = database.indexOf("this.lifecycleGeneration += 1", purgeIndex);
  const requestedIndex = database.indexOf("this.purgeRequested = true", generationIndex);
  const deleteIndex = database.indexOf("SQLite.deleteDatabaseAsync(DATABASE_NAME)", requestedIndex);
  assert.ok(
    purgeIndex >= 0 &&
      generationIndex > purgeIndex &&
      requestedIndex > generationIndex &&
      deleteIndex > requestedIndex,
  );
});

test("COR-200 draft title stays compatible with the canonical Journal contract", () => {
  const { deriveJournalDraftTitle } = loadDraftModule();

  assert.equal(deriveJournalDraftTitle(""), "Note de voyage");
  assert.equal(deriveJournalDraftTitle("x"), "Note de voyage");
  assert.equal(deriveJournalDraftTitle("  Un café\nface à la mer  "), "Un café face à la mer");
  assert.equal(deriveJournalDraftTitle("a".repeat(240)).length, 180);
});

test("COR-200 draft store is local-only, serialized and account plus trip scoped", () => {
  assert.match(storeSource, /private writeQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(storeSource, /openForGeneration\(generation\)/);
  assert.match(storeSource, /canUseGeneration\(generation\)/);
  assert.match(storeSource, /WHERE account_user_id = \? AND trip_id = \?/);
  assert.match(storeSource, /ON CONFLICT\(account_user_id, draft_id\) DO UPDATE/);
  assert.doesNotMatch(storeSource, /apiClient|fetch\(|\.request\(/);
});

test("COR-200 Quick Capture autosaves a keyboard-safe native draft without networking", () => {
  assert.match(screenSource, /Crypto\.randomUUID\(\)/);
  assert.match(screenSource, /localDatabase\.captureGeneration\(\)/);
  assert.match(screenSource, /localJournalDraftStore\s*\.getActive/);
  assert.match(screenSource, /localJournalDraftStore\s*\.save/);
  assert.match(screenSource, /<TextInput/);
  assert.match(screenSource, /autoFocus/);
  assert.match(screenSource, /onChangeText=\{updateContent\}/);
  assert.match(screenSource, /automaticallyAdjustKeyboardInsets/);
  assert.match(screenSource, /keyboardShouldPersistTaps="handled"/);
  assert.match(screenSource, /Enregistré sur cet appareil/);
  assert.doesNotMatch(screenSource, /apiClient|fetch\(|\.request\(/);
});

test("COR-200 is reachable from Trip detail through the native Trips stack", () => {
  assert.match(tripDetailSource, /pathname: "\/trips\/\[tripId\]\/journal"/);
  assert.match(tripDetailSource, /Écrire dans le Carnet/);
  assert.match(tripsLayoutSource, /name="\[tripId\]\/journal"/);
  assert.match(routeSource, /QuickJournalScreen/);
  assert.match(routeSource, /useLocalSearchParams/);
});
