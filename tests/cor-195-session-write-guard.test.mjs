import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const guardSource = await readFile(
  new URL("../src/lib/storage/local-data-session-guard.ts", import.meta.url),
  "utf8",
);
const database = await readFile(
  new URL("../src/lib/storage/local-database.ts", import.meta.url),
  "utf8",
);
const authSession = await readFile(
  new URL("../src/lib/auth/auth-session-manager.ts", import.meta.url),
  "utf8",
);
const tripsRepository = await readFile(
  new URL("../src/features/trips/trips-repository.ts", import.meta.url),
  "utf8",
);
const tripsStore = await readFile(
  new URL("../src/features/trips/local-trips-store.ts", import.meta.url),
  "utf8",
);
const mapStore = await readFile(
  new URL("../src/features/map/local-map-store.ts", import.meta.url),
  "utf8",
);
const stopsRepository = await readFile(
  new URL("../src/features/map/map-stops-repository.ts", import.meta.url),
  "utf8",
);
const timelineRepository = await readFile(
  new URL("../src/features/map/map-timeline-repository.ts", import.meta.url),
  "utf8",
);
const syncEngine = await readFile(
  new URL("../src/lib/sync/sync-engine.ts", import.meta.url),
  "utf8",
);
const tripSyncTransport = await readFile(
  new URL("../src/features/trips/trip-sync-transport.ts", import.meta.url),
  "utf8",
);

function loadGuardClass() {
  const compiled = ts.transpileModule(guardSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports.LocalDataSessionGuard;
}

test("COR-195 write tokens only belong to the active server session", () => {
  const LocalDataSessionGuard = loadGuardClass();
  const guard = new LocalDataSessionGuard();

  assert.equal(guard.capture(), null);
  guard.activate();
  const firstToken = guard.capture();
  assert.equal(guard.canCommit(firstToken), true);

  guard.activate();
  assert.equal(guard.capture(), firstToken);

  guard.invalidate();
  assert.equal(guard.canCommit(firstToken), false);
  assert.equal(guard.capture(), null);

  guard.activate();
  const secondToken = guard.capture();
  assert.notEqual(secondToken, firstToken);
  assert.equal(guard.canCommit(secondToken), true);
});

test("COR-195 invalidates local writes before logout revocation", () => {
  const logoutIndex = authSession.indexOf("async logout()");
  const endingIndex = authSession.indexOf("this.endingSession = true", logoutIndex);
  const invalidateIndex = authSession.indexOf("localDataSessionGuard.invalidate()", logoutIndex);
  const revokeIndex = authSession.indexOf("this.logoutTransport", logoutIndex);
  const networkIndex = authSession.indexOf('error.kind === "network"');
  const offlineInvalidateIndex = authSession.indexOf(
    "localDataSessionGuard.invalidate()",
    networkIndex,
  );
  const offlineReturnIndex = authSession.indexOf('return "offline_auth_pending"', networkIndex);

  assert.match(authSession, /localDataSessionGuard\.activate\(\)/);
  assert.ok(offlineInvalidateIndex > networkIndex && offlineReturnIndex > offlineInvalidateIndex);
  assert.ok(
    logoutIndex >= 0 &&
      endingIndex > logoutIndex &&
      invalidateIndex > endingIndex &&
      revokeIndex > invalidateIndex,
  );
});

test("COR-195 stale refreshes cannot republish an invalidated session", () => {
  assert.match(authSession, /private sessionEpoch = 0/);
  assert.match(authSession, /const refreshEpoch = this\.sessionEpoch/);
  assert.match(authSession, /assertRefreshStillCurrent/);
  assert.match(authSession, /LOCAL_SESSION_INVALIDATED/);
  assert.match(authSession, /!this\.endingSession/);
  assert.match(authSession, /error\.code !== "LOCAL_SESSION_INVALIDATED"/);
});

test("COR-195 remote hydration uses guarded database opens", () => {
  assert.match(database, /async openIf\(shouldOpen: \(\) => boolean\)/);
  assert.match(database, /return shouldOpen\(\) \? database : null/);
  assert.match(tripsStore, /this\.database\.openIf\(shouldWrite\)/);
  assert.match(mapStore, /this\.database\.openIf\(shouldWrite\)/);

  for (const repository of [tripsRepository, stopsRepository, timelineRepository]) {
    assert.match(repository, /localDataSessionGuard\.capture\(\)/);
    assert.match(repository, /localDataSessionGuard\.canCommit\(writeToken\)/);
  }
});

test("COR-195 aborted sync never persists queue state", () => {
  const abortedIndex = syncEngine.indexOf('result.outcome === "aborted"');
  const appliedIndex = syncEngine.indexOf('result.outcome === "applied"', abortedIndex);
  const abortedBranch = syncEngine.slice(abortedIndex, appliedIndex);
  const queueWrites = /store\.(completeApplied|markConflict|markFailed|markPending)/;

  assert.ok(abortedIndex >= 0 && appliedIndex > abortedIndex);
  assert.doesNotMatch(abortedBranch, queueWrites);
  assert.match(tripSyncTransport, /writeToken === null/);
  assert.match(tripSyncTransport, /outcome: "aborted"/);
  assert.match(tripSyncTransport, /!canPersist\(\)/);
  assert.match(tripSyncTransport, /updatedTrip, canPersist/);
});
