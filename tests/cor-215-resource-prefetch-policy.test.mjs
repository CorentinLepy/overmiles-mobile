import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const resourcePolicySource = await readFile(
  new URL("../src/features/offline-companion/resource-prefetch-policy.ts", import.meta.url),
  "utf8",
);
const gateSource = await readFile(
  new URL("../src/features/offline-companion/prefetch-gate.ts", import.meta.url),
  "utf8",
);

function executeTypeScript(source, requireFn = () => ({})) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", "require", output);
  evaluate(module, module.exports, requireFn);
  return module.exports;
}

const resourcePolicy = executeTypeScript(resourcePolicySource);
const gate = executeTypeScript(gateSource, (specifier) => {
  if (specifier === "./resource-prefetch-policy") return resourcePolicy;
  return {};
});

const heavyUpcomingCache = {
  storageClass: "rehydratable_cache",
  tripPriority: "upcoming",
  contentWeight: "heavy",
};

test("COR-215 never blocks protected private data or lightweight business data", () => {
  const hostile = { network: "offline", battery: "critical", lowPowerMode: true };

  assert.equal(
    resourcePolicy.decideResourcePrefetch(
      { ...heavyUpcomingCache, storageClass: "private_unsynced" },
      hostile,
    ).decision,
    "allow",
  );
  assert.equal(
    resourcePolicy.decideResourcePrefetch(
      { ...heavyUpcomingCache, storageClass: "durable_business" },
      hostile,
    ).decision,
    "allow",
  );
  assert.equal(
    resourcePolicy.decideResourcePrefetch(
      { ...heavyUpcomingCache, contentWeight: "light" },
      hostile,
    ).decision,
    "allow",
  );
});

test("COR-215 defers heavy rehydratable cache on offline constrained or unknown resources", () => {
  assert.equal(
    resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, {
      network: "offline",
      battery: "normal",
      lowPowerMode: false,
    }).reason,
    "offline",
  );
  assert.equal(
    resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, {
      network: "constrained",
      battery: "normal",
      lowPowerMode: false,
    }).reason,
    "constrained_network",
  );
  assert.equal(
    resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, {
      network: "unknown",
      battery: "unknown",
      lowPowerMode: null,
    }).reason,
    "unknown_resources",
  );
});

test("COR-215 respects critical battery and low-power mode for heavy cache", () => {
  assert.equal(
    resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, {
      network: "wifi",
      battery: "critical",
      lowPowerMode: false,
    }).reason,
    "battery_critical",
  );
  assert.equal(
    resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, {
      network: "wifi",
      battery: "normal",
      lowPowerMode: true,
    }).reason,
    "low_power_mode",
  );
});

test("COR-215 prioritizes current-trip heavy cache on cellular but defers non-current work", () => {
  const resources = { network: "cellular", battery: "normal", lowPowerMode: false };

  assert.equal(
    resourcePolicy.decideResourcePrefetch(
      { ...heavyUpcomingCache, tripPriority: "current" },
      resources,
    ).decision,
    "allow",
  );
  assert.equal(resourcePolicy.decideResourcePrefetch(heavyUpcomingCache, resources).reason, "cellular_non_current");
});

test("COR-215 composes storage pressure before device resource policy", () => {
  const resourceContext = { network: "wifi", battery: "charging", lowPowerMode: false };
  const blocked = gate.decideCompanionPrefetch(
    { decision: "stop_prefetch", context: null, reason: "minimum_free_reserve" },
    heavyUpcomingCache,
    resourceContext,
  );
  const allowed = gate.decideCompanionPrefetch(
    { decision: "keep", context: null, reason: "allowed" },
    heavyUpcomingCache,
    resourceContext,
  );

  assert.equal(blocked.decision, "defer");
  assert.equal(blocked.source, "storage");
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.source, "resources");
});
