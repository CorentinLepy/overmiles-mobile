import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const registrySource = await readFile(
  new URL("../src/features/offline-companion/prefetch-flight-registry.ts", import.meta.url),
  "utf8",
);
const providerSource = await readFile(
  new URL("../src/features/offline-companion/prefetch-provider.tsx", import.meta.url),
  "utf8",
);

function loadRegistry() {
  const compiled = ts.transpileModule(registrySource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports.CompanionPrefetchFlightRegistry;
}

test("COR-255 claims a freshness key before asynchronous prefetch work", () => {
  const CompanionPrefetchFlightRegistry = loadRegistry();
  const registry = new CompanionPrefetchFlightRegistry();

  assert.equal(registry.tryStart("user:trip:v1"), true);
  assert.equal(registry.isInFlight("user:trip:v1"), true);
  assert.equal(registry.tryStart("user:trip:v1"), false);
});

test("COR-255 successful work remains deduplicated after completion", () => {
  const CompanionPrefetchFlightRegistry = loadRegistry();
  const registry = new CompanionPrefetchFlightRegistry();

  assert.equal(registry.tryStart("user:trip:v1"), true);
  registry.finish("user:trip:v1", true);

  assert.equal(registry.isInFlight("user:trip:v1"), false);
  assert.equal(registry.isCompleted("user:trip:v1"), true);
  assert.equal(registry.tryStart("user:trip:v1"), false);
});

test("COR-255 failed work can be retried on a later eligible effect pass", () => {
  const CompanionPrefetchFlightRegistry = loadRegistry();
  const registry = new CompanionPrefetchFlightRegistry();

  assert.equal(registry.tryStart("user:trip:v1"), true);
  registry.finish("user:trip:v1", false);

  assert.equal(registry.isInFlight("user:trip:v1"), false);
  assert.equal(registry.isCompleted("user:trip:v1"), false);
  assert.equal(registry.tryStart("user:trip:v1"), true);
});

test("COR-255 a newer server freshness key is not blocked by the previous trip version", () => {
  const CompanionPrefetchFlightRegistry = loadRegistry();
  const registry = new CompanionPrefetchFlightRegistry();

  assert.equal(registry.tryStart("user:trip:v1"), true);
  assert.equal(registry.tryStart("user:trip:v2"), true);
});

test("COR-255 provider claims the key synchronously before starting repository calls", () => {
  const claimIndex = providerSource.indexOf("flights.tryStart(activePrefetchKey)");
  const stopsIndex = providerSource.indexOf("activeRepositories.stops.listTripStops", claimIndex);
  const timelineIndex = providerSource.indexOf(
    "activeRepositories.timeline.listTripEvents",
    claimIndex,
  );

  assert.ok(claimIndex >= 0 && stopsIndex > claimIndex && timelineIndex > claimIndex);
  assert.doesNotMatch(providerSource, /completedKeyRef/);
});
