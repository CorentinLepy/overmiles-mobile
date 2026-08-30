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

test("COR-195 local write tokens are valid only for the active server session", () => {
  const LocalDataSessionGuard = loadGuardClass();
  const guard = new LocalDataSessionGuard();

  assert.equal(guard.capture(), null);
  guard.activate();
  const firstToken = guard.capture();
  assert.equal(guard.canCommit(firstToken), true);

  guard.activate();
  assert.equal(guard.capture(), firstToken, "token refresh must not rotate the user session");

  guard.invalidate();
  assert.equal(guard.canCommit(firstToken), false);
  assert.equal(guard.capture(), null);

  guard.activate();
  const secondToken = guard.capture();
  assert.notEqual(secondToken, firstToken);
  assert.equal(guard.canCommit(secondToken), true);
});

test("COR-195 auth invalidates local writes before logout revocation and reactivates on auth", () => {
  const logoutIndex = authSession.indexOf("async logout()");
  const endingIndex = authSession.indexOf("this.endingSession = true", logoutIndex);
  const invalidateIndex = authSession.indexOf("localDataSessionGuard.invalidate()", logoutIndex);
  const revokeIndex = authSession.indexOf("this.logoutTransport", logoutIndex);

  assert.match(authSession, /localDataSessionGuard\.activate\(\)/);
  assert.match(
    authSession,
    /localDataSessionGuard\.invalidate\(\);[\s\S]*return "offline_auth_pending"/,
  );
  assert.ok(
    logoutIndex >= 0 &&
      endingIndex > logoutIndex &&
      invalidateIndex > endingIndex &&
      revokeIndex > invalidateIndex,
  );
});

test("COR-195 stale refreshes cannot republish a cleared or replaced session", () => {
  assert.match(authSession, /private sessionEpoch = 0/);
  assert.match(authSession, /const refreshEpoch = this\.sessionEpoch/);
  assert.match(authSession, /this\.assertRefreshStillCurrent\(refreshEpoch\)/);
  assert.match(authSession, /code: "LOCAL_SESSION_INVALIDATED"/);
  assert.match(authSession, /if \(!this\.endingSession\) \{[\s\S]*localDataSessionGuard\.activate\(\)/);
  assert.match(
    authSession,
    /error\.code !== "LOCAL_SESSION_INVALIDATED"[\s\S]*this\.clearLocalSession\(\)/,
  );
});

test("COR-195 remote hydration commits only through a guarded database open", () => {
  assert.match(database, /async openIf\(shouldOpen: \(\) => boolean\)/);
  assert.match(database, /return shouldOpen\(\) \? database : null/);
  assert.match(tripsStore, /this\.database\.openIf\(shouldWrite\)/);
  assert.match(mapStore, /this\.database\.openIf\(shouldWrite\)/);

  for (const repository of [tripsRepository, stopsRepository, timelineRepository]) {
    assert.match(repository, /localDataSessionGuard\.capture\(\)/);
    assert.match(repository, /localDataSessionGuard\.canCommit\(writeToken\)/);
  }
});

test("COR-195 aborted sync does not write queue state after session invalidation", () => {
  const abortedIndex = syncEngine.indexOf('result.outcome === "aborted"');
  const appliedIndex = syncEngine.indexOf('result.outcome === "applied"', abortedIndex);
  const abortedBranch = syncEngine.slice(abortedIndex, appliedIndex);

  assert.ok(abortedIndex >= 0 && appliedIndex > abortedIndex);
  assert.doesNotMatch(abortedBranch, /store\.(completeApplied|markConflict|markFailed|markPending)/);
  assert.match(tripSyncTransport, /if \(writeToken === null\) return \{ outcome: "aborted" \}/);
  assert.match(tripSyncTransport, /if \(!canPersist\(\)\) return \{ outcome: "aborted" \}/);
  assert.match(tripSyncTransport, /localStore\.upsert\(accountUserId, updatedTrip, canPersist\)/);
});
