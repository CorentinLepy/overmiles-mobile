import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const mediaItemSource = await readFile(
  new URL("../src/features/media/local-media-item.ts", import.meta.url),
  "utf8",
);
const secureMediaPathSource = await readFile(
  new URL("../src/features/media/secure-media-path.ts", import.meta.url),
  "utf8",
);
const mediaStoreSource = await readFile(
  new URL("../src/features/media/local-media-store.ts", import.meta.url),
  "utf8",
);

function compileCommonJs(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function executeCommonJs(source, requireModule = () => ({})) {
  const module = { exports: {} };
  new Function("require", "module", "exports", compileCommonJs(source))(
    requireModule,
    module,
    module.exports,
  );
  return module.exports;
}

function loadMediaItemModule() {
  const secureMediaPath = executeCommonJs(secureMediaPathSource);
  return executeCommonJs(mediaItemSource, (specifier) => {
    if (specifier === "./secure-media-path") return secureMediaPath;
    throw new Error(`Unexpected CommonJS dependency: ${specifier}`);
  });
}

test("COR-204 adds an account-scoped durable local media queue to SQLCipher", () => {
  assert.match(migrations, /version: 7/);
  assert.match(migrations, /name: "offline-media-queue-foundation"/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS local_media_items/);
  assert.match(migrations, /account_user_id TEXT NOT NULL/);
  assert.match(migrations, /trip_id TEXT NOT NULL/);
  assert.match(migrations, /storage_key TEXT NOT NULL/);
  assert.match(migrations, /local_only.*ready_to_upload.*uploading.*failed/s);
  assert.match(migrations, /captured_at TEXT/);
  assert.match(migrations, /latitude REAL/);
  assert.match(migrations, /longitude REAL/);
  assert.match(migrations, /idx_local_media_items_trip_state_updated/);
});

test("COR-204 only accepts OverMiles-owned relative storage keys", () => {
  const { isLocalMediaStorageKey } = loadMediaItemModule();

  assert.equal(isLocalMediaStorageKey("media/user-1/asset-1.heic"), true);
  assert.equal(isLocalMediaStorageKey("file:///tmp/picker/asset-1.heic"), false);
  assert.equal(isLocalMediaStorageKey("media/../private/asset.jpg"), false);
  assert.equal(isLocalMediaStorageKey("/media/asset.jpg"), false);
  assert.equal(isLocalMediaStorageKey(" media/asset.jpg"), false);
});

test("COR-204 validates normalized image metadata before persistence", () => {
  const { assertLocalMediaInput } = loadMediaItemModule();
  const base = {
    accountUserId: "user-1",
    tripId: "trip-1",
    localMediaId: "media-1",
    storageKey: "media/user-1/media-1.jpg",
    mimeType: "image/jpeg",
  };

  assert.doesNotThrow(() =>
    assertLocalMediaInput({
      ...base,
      fileSizeBytes: 1_024,
      width: 1200,
      height: 800,
      latitude: 48.8566,
      longitude: 2.3522,
    }),
  );
  assert.throws(() => assertLocalMediaInput({ ...base, mimeType: "video/mp4" }));
  assert.throws(() => assertLocalMediaInput({ ...base, latitude: 48.8566 }));
  assert.throws(() => assertLocalMediaInput({ ...base, latitude: 120, longitude: 2 }));
  assert.throws(() => assertLocalMediaInput({ ...base, width: 0 }));
  assert.throws(() => assertLocalMediaInput({ ...base, storageKey: "media/user-2/media-1.jpg" }));
});

test("COR-204 media store is serialized, generation-guarded and local-only", () => {
  assert.match(mediaStoreSource, /private writeQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(mediaStoreSource, /openForGeneration\(generation\)/);
  assert.match(mediaStoreSource, /canUseGeneration\(generation\)/);
  assert.match(mediaStoreSource, /WHERE account_user_id = \? AND trip_id = \?/);
  assert.match(mediaStoreSource, /ON CONFLICT\(account_user_id, local_media_id\) DO UPDATE/);
  assert.match(mediaStoreSource, /assertLocalMediaInput\(input\)/);
  assert.doesNotMatch(mediaStoreSource, /apiClient|fetch\(|\.request\(|FormData/);
});

test("COR-204 persists storage keys instead of temporary picker URIs", () => {
  assert.match(mediaStoreSource, /input\.storageKey/);
  assert.match(mediaStoreSource, /storage_key/);
  assert.doesNotMatch(mediaStoreSource, /sourceUri|pickerUri|temporaryUri/);
});
