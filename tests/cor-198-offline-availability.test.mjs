import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const availabilitySource = await readFile(
  new URL("../src/features/offline-companion/availability.ts", import.meta.url),
  "utf8",
);
const providerSource = await readFile(
  new URL("../src/features/offline-companion/prefetch-provider.tsx", import.meta.url),
  "utf8",
);
const badgeSource = await readFile(
  new URL("../src/features/offline-companion/availability-badge.tsx", import.meta.url),
  "utf8",
);
const localMapStoreSource = await readFile(
  new URL("../src/features/map/local-map-store.ts", import.meta.url),
  "utf8",
);
const homeSource = await readFile(
  new URL("../src/features/app-shell/screens/home-screen.tsx", import.meta.url),
  "utf8",
);
const tripCardSource = await readFile(
  new URL("../src/features/trips/components/trip-card.tsx", import.meta.url),
  "utf8",
);
const tripDetailSource = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);

function loadAvailabilityModule() {
  const compiled = ts.transpileModule(availabilitySource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("require", "module", "exports", compiled);
  evaluate(() => ({}), module, module.exports);
  return module.exports;
}

const trip = {
  id: "trip-1",
  ownerId: "user-1",
  name: "Lisbonne",
  description: null,
  status: "PLANNED",
  startsAt: "2026-09-10T10:00:00Z",
  endsAt: "2026-09-14T10:00:00Z",
  countries: ["PT"],
  coverImageUrl: null,
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
  version: 7,
};

function snapshot(kind, overrides = {}) {
  return {
    accountUserId: "user-1",
    tripId: "trip-1",
    kind,
    itemCount: 0,
    tripVersion: 7,
    tripUpdatedAt: "2026-08-30T10:00:00Z",
    cachedAt: kind === "stop" ? "2026-08-30T10:01:00Z" : "2026-08-30T10:02:00Z",
    ...overrides,
  };
}

test("COR-198 only marks a trip available when both required snapshots are fresh", () => {
  const { deriveCompanionAvailability } = loadAvailabilityModule();
  const completeSnapshots = [snapshot("stop"), snapshot("timeline")];
  const available = deriveCompanionAvailability(trip, completeSnapshots, false);
  const incomplete = deriveCompanionAvailability(trip, [snapshot("stop")], false);
  const staleSnapshots = [snapshot("stop"), snapshot("timeline", { tripVersion: 6 })];
  const stale = deriveCompanionAvailability(trip, staleSnapshots, false);

  assert.deepEqual(available, {
    state: "available",
    completedAt: "2026-08-30T10:02:00Z",
  });
  assert.equal(incomplete.state, "not_prepared");
  assert.equal(stale.state, "stale");
});

test("COR-198 treats valid empty snapshots as prepared and reports real prefetch activity", () => {
  const { deriveCompanionAvailability } = loadAvailabilityModule();
  const emptySnapshots = [snapshot("stop"), snapshot("timeline")];
  const available = deriveCompanionAvailability(trip, emptySnapshots, false);
  const preparing = deriveCompanionAvailability(trip, [snapshot("stop")], true);

  assert.equal(available.state, "available");
  assert.equal(preparing.state, "preparing");
});

test("COR-198 formats user-facing offline states without claiming unsupported media coverage", () => {
  const { formatCompanionAvailability } = loadAvailabilityModule();
  const now = new Date("2026-08-30T10:14:00Z");
  const available = formatCompanionAvailability(
    { state: "available", completedAt: "2026-08-30T10:02:00Z" },
    now,
  );
  const preparing = formatCompanionAvailability(
    { state: "preparing", completedAt: null },
    now,
  );
  const stale = formatCompanionAvailability({ state: "stale", completedAt: null }, now);

  assert.equal(available, "Disponible hors ligne · actualisé il y a 12 min");
  assert.equal(preparing, "Préparation hors ligne…");
  assert.equal(stale, "À actualiser avant le départ");
});

test("COR-198 loads snapshot metadata locally in one account-scoped query", () => {
  assert.match(localMapStoreSource, /async listSnapshots\(accountUserId: string\)/);
  assert.match(localMapStoreSource, /FROM cached_map_snapshots/);
  assert.match(localMapStoreSource, /WHERE account_user_id = \?/);
  assert.match(providerSource, /localMapStore\s*\.listSnapshots\(user\.id\)/);
  assert.doesNotMatch(providerSource, /fetch\(|apiClient\.request/);
});

test("COR-198 surfaces the same accessible availability state across product entry points", () => {
  const accessibilityPattern = /accessibilityLabel={`Disponibilité hors ligne : \$\{label\}`}/;
  assert.match(badgeSource, accessibilityPattern);
  assert.match(badgeSource, /formatCompanionAvailability/);
  assert.match(homeSource, /<CompanionAvailabilityBadge trip={nextTrip} \/>/);
  assert.match(tripCardSource, /<CompanionAvailabilityBadge trip={trip} \/>/);
  assert.match(tripDetailSource, /<CompanionAvailabilityBadge trip={trip} \/>/);
});
