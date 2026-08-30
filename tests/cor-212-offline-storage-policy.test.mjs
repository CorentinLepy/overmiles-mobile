import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const policySource = await readFile(
  new URL("../src/features/offline-companion/storage-policy.ts", import.meta.url),
  "utf8",
);

function executeTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", output);
  evaluate(module, module.exports);
  return module.exports;
}

function artifact(overrides = {}) {
  return {
    id: "artifact-1",
    accountUserId: "user-1",
    tripId: "trip-1",
    storageClass: "rehydratable_cache",
    tripPriority: "history",
    sizeBytes: 100,
    lastAccessedAt: 1_000,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    freeBytes: 10_000,
    rehydratableBytes: 1_000,
    minimumFreeBytes: 2_000,
    maxRehydratableBytes: 5_000,
    ...overrides,
  };
}

test("COR-212 never makes private unsynced or durable business data evictable", () => {
  const { decideOfflineStorageAction } = executeTypeScript(policySource);
  const severePressure = context({
    freeBytes: 0,
    rehydratableBytes: 9_000,
  });

  assert.equal(
    decideOfflineStorageAction(
      artifact({ storageClass: "private_unsynced", tripPriority: "history" }),
      severePressure,
      "retain",
    ),
    "keep",
  );
  assert.equal(
    decideOfflineStorageAction(
      artifact({ storageClass: "durable_business", tripPriority: "history" }),
      severePressure,
      "retain",
    ),
    "keep",
  );
});

test("COR-212 stops new rehydratable prefetch before violating disk reserve or cache budget", () => {
  const { decideOfflineStorageAction } = executeTypeScript(policySource);
  const candidate = artifact({ sizeBytes: 500, tripPriority: "current" });

  assert.equal(decideOfflineStorageAction(candidate, context(), "prefetch"), "keep");
  assert.equal(
    decideOfflineStorageAction(candidate, context({ freeBytes: 2_400 }), "prefetch"),
    "stop_prefetch",
  );
  assert.equal(
    decideOfflineStorageAction(candidate, context({ rehydratableBytes: 4_600 }), "prefetch"),
    "stop_prefetch",
  );
  assert.equal(
    decideOfflineStorageAction(
      candidate,
      context({ freeBytes: 2_500, rehydratableBytes: 4_500 }),
      "prefetch",
    ),
    "keep",
  );
});

test("COR-212 protects current and upcoming trips before older rehydratable caches", () => {
  const { decideOfflineStorageAction } = executeTypeScript(policySource);
  const pressure = context({ freeBytes: 1_500 });

  assert.equal(
    decideOfflineStorageAction(artifact({ tripPriority: "current" }), pressure, "retain"),
    "keep",
  );
  assert.equal(
    decideOfflineStorageAction(artifact({ tripPriority: "upcoming" }), pressure, "retain"),
    "keep",
  );
  assert.equal(
    decideOfflineStorageAction(artifact({ tripPriority: "prepared_recent" }), pressure, "retain"),
    "evictable",
  );
  assert.equal(
    decideOfflineStorageAction(artifact({ tripPriority: "history" }), pressure, "retain"),
    "evictable",
  );
});

test("COR-212 eviction candidates stay account scoped and prefer old history first", () => {
  const { rankRehydratableEvictionCandidates } = executeTypeScript(policySource);
  const pressure = context({ rehydratableBytes: 6_000 });
  const candidates = rankRehydratableEvictionCandidates(
    [
      artifact({ id: "recent", tripPriority: "prepared_recent", lastAccessedAt: 100 }),
      artifact({ id: "history-new", tripPriority: "history", lastAccessedAt: 500 }),
      artifact({ id: "history-old", tripPriority: "history", lastAccessedAt: 50 }),
      artifact({ id: "current", tripPriority: "current", lastAccessedAt: 1 }),
      artifact({ id: "other-account", accountUserId: "user-2", tripPriority: "history" }),
      artifact({ id: "private", storageClass: "private_unsynced", tripPriority: "history" }),
    ],
    pressure,
    "user-1",
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    ["history-old", "history-new", "recent"],
  );
});

test("COR-212 is policy-only and cannot silently delete local files", () => {
  assert.doesNotMatch(policySource, /File\(|Directory\(|\.delete\(|unlink|removeAsync|deleteAsync/);
  assert.match(policySource, /private_unsynced/);
  assert.match(policySource, /stop_prefetch/);
  assert.match(policySource, /accountUserId/);
  assert.match(policySource, /tripId/);
});
