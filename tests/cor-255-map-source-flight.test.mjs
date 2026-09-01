import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const flightSource = await readFile(
  new URL("../src/features/map/map-source-flight.ts", import.meta.url),
  "utf8",
);
const stopsSource = await readFile(
  new URL("../src/features/map/map-stops-repository.ts", import.meta.url),
  "utf8",
);
const timelineSource = await readFile(
  new URL("../src/features/map/map-timeline-repository.ts", import.meta.url),
  "utf8",
);

function loadFlightModule() {
  const output = ts.transpileModule(flightSource, {
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

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

test("COR-255 shares one concurrent hydration for the same map source", async () => {
  const { runMapSourceFlight } = loadFlightModule();
  const pending = deferred();
  let calls = 0;
  const identity = {
    accountUserId: "user-1",
    tripId: "trip-1",
    kind: "stop",
    tripVersion: 4,
    tripUpdatedAt: "2026-09-01T10:00:00Z",
  };

  const first = runMapSourceFlight(identity, async () => {
    calls += 1;
    await pending.promise;
    return ["done"];
  });
  const second = runMapSourceFlight(identity, async () => {
    calls += 1;
    return ["duplicate"];
  });

  assert.equal(calls, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(first, second);
  pending.resolve();
  assert.deepEqual(await second, ["done"]);
});

test("COR-255 releases a source flight after completion", async () => {
  const { runMapSourceFlight } = loadFlightModule();
  const identity = {
    accountUserId: "user-1",
    tripId: "trip-1",
    kind: "timeline",
    tripVersion: 4,
    tripUpdatedAt: "2026-09-01T10:00:00Z",
  };
  let calls = 0;

  await runMapSourceFlight(identity, async () => {
    calls += 1;
    return 1;
  });
  await new Promise((resolve) => setImmediate(resolve));
  await runMapSourceFlight(identity, async () => {
    calls += 1;
    return 2;
  });

  assert.equal(calls, 2);
});

test("COR-255 does not combine different versions or source kinds", async () => {
  const { createMapSourceFlightKey } = loadFlightModule();
  const base = {
    accountUserId: "user-1",
    tripId: "trip-1",
    kind: "stop",
    tripVersion: 4,
    tripUpdatedAt: "2026-09-01T10:00:00Z",
  };

  assert.notEqual(
    createMapSourceFlightKey(base),
    createMapSourceFlightKey({ ...base, tripVersion: 5 }),
  );
  assert.notEqual(
    createMapSourceFlightKey(base),
    createMapSourceFlightKey({ ...base, kind: "timeline" }),
  );
});

test("COR-255 both map repositories use the shared source flight", () => {
  assert.match(stopsSource, /runMapSourceFlight/);
  assert.match(stopsSource, /kind: "stop"/);
  assert.match(timelineSource, /runMapSourceFlight/);
  assert.match(timelineSource, /kind: "timeline"/);
});
