import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const selectionSource = await readFile(
  new URL("../src/features/offline-companion/selection.ts", import.meta.url),
  "utf8",
);
const providerSource = await readFile(
  new URL("../src/features/offline-companion/prefetch-provider.tsx", import.meta.url),
  "utf8",
);
const tabsLayout = await readFile(new URL("../app/(tabs)/_layout.tsx", import.meta.url), "utf8");

function loadSelectionModule() {
  const compiled = ts.transpileModule(selectionSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

function trip(id, startsAt, endsAt, status = "ACTIVE", updatedAt = "2026-08-30T10:00:00Z") {
  return {
    id,
    ownerId: "owner-1",
    name: id,
    description: null,
    status,
    startsAt,
    endsAt,
    countries: [],
    coverImageUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt,
  };
}

test("COR-194 selects current trip first and only the nearest upcoming trip", () => {
  const { selectCompanionTrips } = loadSelectionModule();
  const now = Date.parse("2026-08-30T12:00:00Z");
  const selected = selectCompanionTrips(
    [
      trip("history", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z"),
      trip("later", "2026-09-20T00:00:00Z", "2026-09-25T00:00:00Z"),
      trip("current", "2026-08-28T00:00:00Z", "2026-09-02T00:00:00Z"),
      trip("next", "2026-09-05T00:00:00Z", "2026-09-10T00:00:00Z"),
      trip("archived", "2026-09-01T00:00:00Z", "2026-09-03T00:00:00Z", "ARCHIVED"),
    ],
    now,
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["current", "next"],
  );
});

test("COR-194 selects only the nearest future trip when none is in progress", () => {
  const { selectCompanionTrips } = loadSelectionModule();
  const now = Date.parse("2026-08-30T12:00:00Z");
  const selected = selectCompanionTrips(
    [
      trip("invalid", "not-a-date", null),
      trip("next", "2026-09-03T00:00:00Z", null),
      trip("later", "2026-10-03T00:00:00Z", null),
    ],
    now,
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["next"],
  );
});

test("COR-194 prefetch freshness key tracks server-updated trip identity", () => {
  const { createCompanionPrefetchKey } = loadSelectionModule();
  const first = { ...trip("trip-1", "2026-09-03T00:00:00Z", null), version: 4 };
  const second = { ...first, version: 5, updatedAt: "2026-08-30T11:00:00Z" };

  assert.notEqual(
    createCompanionPrefetchKey("user-1", [first]),
    createCompanionPrefetchKey("user-1", [second]),
  );
});

test("COR-194 prefetch is authenticated-only, silent and skips active Map", () => {
  assert.match(providerSource, /status !== "authenticated"/);
  assert.match(providerSource, /isMapActive/);
  assert.match(providerSource, /createMapStopsRepository/);
  assert.match(providerSource, /createMapTimelineRepository/);
  assert.match(providerSource, /Promise\.allSettled/);
  assert.match(providerSource, /result\.status === "fulfilled"/);
  assert.doesNotMatch(providerSource, /offline_auth_pending/);
  assert.doesNotMatch(providerSource, /photo|document|tile|MapLibre/i);
});

test("COR-194 mounts after Trips context and before the Map provider", () => {
  const tripsIndex = tabsLayout.indexOf("<TripsDataProvider>");
  const companionIndex = tabsLayout.indexOf("<CompanionPrefetchProvider>");
  const mapIndex = tabsLayout.indexOf("<MapDataProvider>");

  assert.ok(tripsIndex >= 0 && companionIndex > tripsIndex && mapIndex > companionIndex);
});
