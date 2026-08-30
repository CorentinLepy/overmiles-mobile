import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const formattersSource = await readFile(
  new URL("../src/features/trips/trip-formatters.ts", import.meta.url),
  "utf8",
);
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);
const focusControlSource = await readFile(
  new URL("../src/features/map/map-current-trip-focus.tsx", import.meta.url),
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

function trip(id, overrides = {}) {
  return {
    id,
    ownerId: "user-1",
    name: id === "trip-1" ? "Lisbonne" : "Porto",
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

test("COR-225 only exposes an unambiguous current trip", () => {
  const { findCurrentTrip } = loadFormattersModule();
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  assert.equal(findCurrentTrip([], now), null);
  assert.equal(findCurrentTrip([trip("trip-1")], now)?.id, "trip-1");
  assert.equal(findCurrentTrip([trip("trip-1"), trip("trip-2")], now), null);
  assert.equal(
    findCurrentTrip(
      [trip("trip-1", { startsAt: "2026-09-10T08:00:00.000Z", endsAt: "2026-09-12T20:00:00.000Z" })],
      now,
    ),
    null,
  );
});

test("COR-225 filters only the already-loaded map projection by current trip id", () => {
  assert.match(mapScreenSource, /useTripsData\(\)/);
  assert.match(mapScreenSource, /findCurrentTrip\(trips\)/);
  assert.match(mapScreenSource, /point\.tripId === focusedTripId/);
  assert.match(mapScreenSource, /createVisitedPointsFeatureCollection\(visiblePoints\)/);
  assert.match(mapScreenSource, /getMapInitialViewState\(visiblePoints\)/);
  assert.match(mapScreenSource, /focusedTripId \? currentTrip\?\.name : null/);
  assert.doesNotMatch(mapScreenSource, /apiClient|fetch\s*\(|axios|\.request\(/);
});

test("COR-225 toggles between current trip and all trips without keeping a hidden selected point", () => {
  assert.match(mapScreenSource, /function toggleCurrentTripFocus\(\): void/);
  assert.match(mapScreenSource, /setSelectedPointId\(null\)/);
  assert.match(mapScreenSource, /setIsCurrentTripFocused\(\(current\) => !current\)/);
  assert.match(mapScreenSource, /cameraKey = `\$\{focusedTripId \?\? "all"\}/);
  assert.match(focusControlSource, /Voyage en cours · \$\{trip\.name\}/);
  assert.match(focusControlSource, /Tous les voyages/);
});

test("COR-225 current trip focus stays one-hand accessible and local-only", () => {
  assert.match(focusControlSource, /accessibilityRole="button"/);
  assert.match(focusControlSource, /accessibilityState=\{\{ selected: isFocused \}\}/);
  assert.match(focusControlSource, /minHeight: 44/);
  assert.match(focusControlSource, /flexShrink: 1/);
  assert.doesNotMatch(focusControlSource, /apiClient|fetch\s*\(|axios|\.request\(/);
});
