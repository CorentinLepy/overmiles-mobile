import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const storagePolicySource = await readFile(
  new URL("../src/features/offline-companion/storage-policy.ts", import.meta.url),
  "utf8",
);
const pressurePolicySource = await readFile(
  new URL("../src/features/offline-companion/storage-pressure-policy.ts", import.meta.url),
  "utf8",
);
const pressureServiceSource = await readFile(
  new URL("../src/features/offline-companion/storage-pressure-service.ts", import.meta.url),
  "utf8",
);

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function execute(source, requireFn = () => {
  throw new Error("Unexpected require");
}) {
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", "require", transpile(source));
  evaluate(module, module.exports, requireFn);
  return module.exports;
}

const storagePolicy = execute(storagePolicySource);
const pressurePolicy = execute(pressurePolicySource, (specifier) => {
  if (specifier === "./storage-policy") return storagePolicy;
  throw new Error(`Unexpected require: ${specifier}`);
});

const GIB = 1024 ** 3;
const candidate = {
  id: "map-porto",
  accountUserId: "user-1",
  tripId: "trip-1",
  storageClass: "rehydratable_cache",
  tripPriority: "upcoming",
  sizeBytes: 256 * 1024 ** 2,
  lastAccessedAt: null,
};

test("COR-214 allows rehydratable prefetch when reserve and budget stay healthy", () => {
  const result = pressurePolicy.decidePrefetchStoragePressure(
    candidate,
    { availableBytes: 20 * GIB, totalBytes: 128 * GIB },
    1 * GIB,
  );

  assert.equal(result.decision, "keep");
  assert.equal(result.reason, "allowed");
});

test("COR-214 stops new rehydratable prefetch before crossing the free-space reserve", () => {
  const result = pressurePolicy.decidePrefetchStoragePressure(
    candidate,
    { availableBytes: 1.1 * GIB, totalBytes: 64 * GIB },
    512 * 1024 ** 2,
  );

  assert.equal(result.decision, "stop_prefetch");
  assert.equal(result.reason, "minimum_free_reserve");
});

test("COR-214 stops new rehydratable prefetch when the centralized cache budget would be exceeded", () => {
  const result = pressurePolicy.decidePrefetchStoragePressure(
    candidate,
    { availableBytes: 20 * GIB, totalBytes: 64 * GIB },
    3.9 * GIB,
  );

  assert.equal(result.decision, "stop_prefetch");
  assert.equal(result.reason, "rehydratable_budget");
});

test("COR-214 fails conservatively only for new rehydratable cache when measurement is unavailable", () => {
  const cacheResult = pressurePolicy.decidePrefetchStoragePressure(candidate, null, null);
  const privateResult = pressurePolicy.decidePrefetchStoragePressure(
    { ...candidate, storageClass: "private_unsynced" },
    null,
    null,
  );
  const businessResult = pressurePolicy.decidePrefetchStoragePressure(
    { ...candidate, storageClass: "durable_business" },
    null,
    null,
  );

  assert.equal(cacheResult.decision, "stop_prefetch");
  assert.equal(cacheResult.reason, "measurement_unavailable");
  assert.equal(privateResult.decision, "keep");
  assert.equal(businessResult.decision, "keep");
});

test("COR-214 measures modern Expo disk space and consumes the SQLCipher inventory without deletion", () => {
  assert.match(pressureServiceSource, /Paths\.availableDiskSpace/);
  assert.match(pressureServiceSource, /Paths\.totalDiskSpace/);
  assert.match(pressureServiceSource, /rehydratableCacheStore\.totalBytesForAccount/);
  assert.match(pressureServiceSource, /decidePrefetchStoragePressure/);
  assert.doesNotMatch(pressureServiceSource, /delete|removeEntry|unlink|\.delete\(/i);
  assert.doesNotMatch(pressureServiceSource, /react|useEffect|useState/i);
});
