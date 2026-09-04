import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const migrationSource = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const policySource = await readFile(
  new URL("../src/features/offline-companion/storage-policy.ts", import.meta.url),
  "utf8",
);
const itemSource = await readFile(
  new URL("../src/features/offline-companion/rehydratable-cache-item.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../src/features/offline-companion/rehydratable-cache-store.ts", import.meta.url),
  "utf8",
);

function executeTypeScript(source, modules = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", "require", output);
  evaluate(module, module.exports, (specifier) => {
    if (specifier in modules) return modules[specifier];
    throw new Error(`Module de test non fourni: ${specifier}`);
  });
  return module.exports;
}

test("COR-213 adds a monotonic SQLCipher inventory limited to rehydratable cache kinds", () => {
  assert.match(migrationSource, /version: 9/);
  assert.match(migrationSource, /name: "rehydratable-cache-inventory"/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS rehydratable_cache_inventory/);
  assert.match(migrationSource, /remote_media.*document.*map_region/s);
  assert.match(migrationSource, /size_bytes INTEGER NOT NULL CHECK \(size_bytes >= 0\)/);
  assert.match(migrationSource, /PRIMARY KEY \(account_user_id, cache_id\)/);
  assert.match(migrationSource, /idx_rehydratable_cache_storage_key/);
  assert.match(migrationSource, /idx_rehydratable_cache_trip_kind_accessed/);
});

test("COR-213 storage keys are relative, account-scoped and cannot accept signed URLs as fingerprints", () => {
  const policy = executeTypeScript(policySource);
  const { assertRehydratableCacheInput, createRehydratableCacheStorageKey } = executeTypeScript(
    itemSource,
    { "./storage-policy": policy },
  );

  const storageKey = createRehydratableCacheStorageKey("user-1", "remote_media", "cover-1");
  assert.equal(storageKey, "rehydratable/user-1/remote_media/cover-1");
  assert.doesNotThrow(() =>
    assertRehydratableCacheInput({
      accountUserId: "user-1",
      cacheId: "cover-1",
      tripId: "trip-1",
      kind: "remote_media",
      storageKey,
      sourceFingerprint: "etag:v7.abc-123",
      sizeBytes: 4_096,
      lastAccessedAt: "2026-08-30T18:00:00.000Z",
    }),
  );

  assert.throws(() =>
    assertRehydratableCacheInput({
      accountUserId: "user-1",
      cacheId: "cover-1",
      kind: "remote_media",
      storageKey: "../private/photo.jpg",
      sourceFingerprint: "etag:v7",
      sizeBytes: 1,
    }),
  );
  assert.throws(() =>
    assertRehydratableCacheInput({
      accountUserId: "user-1",
      cacheId: "cover-1",
      kind: "remote_media",
      storageKey: "rehydratable/user-2/remote_media/cover-1",
      sourceFingerprint: "etag:v7",
      sizeBytes: 1,
    }),
  );
  assert.throws(() =>
    assertRehydratableCacheInput({
      accountUserId: "user-1",
      cacheId: "cover-1",
      kind: "remote_media",
      storageKey,
      sourceFingerprint: "https://cdn.example.test/file?token=secret",
      sizeBytes: 1,
    }),
  );
});

test("COR-213 inventory items feed COR-212 only as explicitly rehydratable artifacts", () => {
  const policy = executeTypeScript(policySource);
  const { toOfflineStorageArtifact } = executeTypeScript(itemSource, {
    "./storage-policy": policy,
  });
  const item = {
    accountUserId: "user-1",
    cacheId: "map-porto",
    tripId: "trip-1",
    kind: "map_region",
    storageKey: "rehydratable/user-1/map_region/map-porto",
    sourceFingerprint: "style:v3",
    sizeBytes: 25_000,
    lastAccessedAt: "2026-08-30T18:00:00.000Z",
    createdAt: "2026-08-30T18:00:00.000Z",
    updatedAt: "2026-08-30T18:00:00.000Z",
  };

  const artifact = toOfflineStorageArtifact(item, "history");
  assert.equal(artifact.storageClass, "rehydratable_cache");
  assert.equal(artifact.tripPriority, "history");
  assert.equal(artifact.accountUserId, "user-1");
  assert.equal(artifact.sizeBytes, 25_000);
  assert.equal(
    policy.decideOfflineStorageAction(
      artifact,
      {
        freeBytes: 500,
        rehydratableBytes: 200_000,
        minimumFreeBytes: 1_000,
        maxRehydratableBytes: 100_000,
      },
      "retain",
    ),
    "evictable",
  );
});

test("COR-213 store is serialized, generation guarded and account plus trip scoped", () => {
  assert.match(storeSource, /private writeQueue: Promise<void>/);
  assert.match(storeSource, /openForGeneration\(generation\)/g);
  assert.match(storeSource, /canUseGeneration\(generation\)/g);
  assert.match(storeSource, /WHERE account_user_id = \?/);
  assert.match(storeSource, /WHERE account_user_id = \? AND trip_id = \?/);
  assert.match(storeSource, /WHERE account_user_id = \? AND cache_id = \?/);
  assert.match(storeSource, /ON CONFLICT\(account_user_id, cache_id\) DO UPDATE SET/);
});

test("COR-213 exposes cache byte totals but cannot delete physical files", () => {
  assert.match(storeSource, /COALESCE\(SUM\(size_bytes\), 0\) AS total_bytes/);
  assert.match(storeSource, /removeEntry/);
  assert.match(storeSource, /DELETE FROM rehydratable_cache_inventory/);
  assert.doesNotMatch(storeSource, /expo-file-system|new File|new Directory|\.delete\(\)/);
  assert.doesNotMatch(
    itemSource,
    /local_media_items|local_journal_drafts|local_timeline_event_drafts/,
  );
});
