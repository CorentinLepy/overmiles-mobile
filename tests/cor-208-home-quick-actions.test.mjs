import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const formattersSource = await readFile(
  new URL("../src/features/trips/trip-formatters.ts", import.meta.url),
  "utf8",
);
const homeSource = await readFile(
  new URL("../src/features/app-shell/screens/home-screen.tsx", import.meta.url),
  "utf8",
);
const actionsSource = await readFile(
  new URL("../src/features/capture/current-trip-quick-actions.tsx", import.meta.url),
  "utf8",
);

function loadFormattersModule() {
  const compiled = ts.transpileModule(formattersSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

function trip(overrides = {}) {
  return {
    id: "trip-1",
    ownerId: "user-1",
    name: "Lisbonne",
    description: null,
    status: "ACTIVE",
    startsAt: "2026-08-29T08:00:00.000Z",
    endsAt: "2026-09-02T20:00:00.000Z",
    countries: ["PT"],
    coverImageUrl: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
    ...overrides,
  };
}

test("COR-208 only treats an unambiguous ACTIVE date range as a current trip", () => {
  const { isTripInProgress } = loadFormattersModule();
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  assert.equal(isTripInProgress(trip(), now), true);
  assert.equal(
    isTripInProgress(
      trip({
        startsAt: "2026-09-05T08:00:00.000Z",
        endsAt: "2026-09-10T20:00:00.000Z",
      }),
      now,
    ),
    false,
  );
  assert.equal(
    isTripInProgress(
      trip({
        startsAt: "2026-08-01T08:00:00.000Z",
        endsAt: "2026-08-10T20:00:00.000Z",
      }),
      now,
    ),
    false,
  );
  assert.equal(isTripInProgress(trip({ status: "DRAFT" }), now), false);
  assert.equal(isTripInProgress(trip({ endsAt: null }), now), false);
  assert.equal(isTripInProgress(trip({ endsAt: "not-a-date" }), now), false);
});

test("COR-208 keeps Home Quick Actions contextual to the current trip", () => {
  assert.match(homeSource, /isTripInProgress\(nextTrip\)/);
  assert.match(homeSource, /isCurrentTrip \? "VOYAGE EN COURS" : "PROCHAIN DÉPART"/);
  assert.match(homeSource, /isCurrentTrip \? \(/);
  assert.match(homeSource, /<CurrentTripQuickActions tripId=\{nextTrip\.id\} tripName=\{nextTrip\.name\} \/>/);
});

test("COR-208 routes Carnet and Moment in one accessible tap without networking", () => {
  assert.match(actionsSource, /pathname: "\/trips\/\[tripId\]\/journal"/);
  assert.match(actionsSource, /pathname: "\/trips\/\[tripId\]\/moment"/);
  assert.match(actionsSource, /accessibilityRole="button"/);
  assert.match(actionsSource, /Écrire dans le Carnet/);
  assert.match(actionsSource, /Ajouter un moment/);
  assert.match(actionsSource, /minHeight: 48/);
  assert.doesNotMatch(actionsSource, /apiClient|fetch\(|\.request\(/);
});
