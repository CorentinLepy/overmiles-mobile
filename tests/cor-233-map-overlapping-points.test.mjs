import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { check, resolveConfig } from "prettier";

const navigationUrl = new URL(
  "../src/features/map/map-overlapping-point-navigation.tsx",
  import.meta.url,
);
const screenUrl = new URL(
  "../src/features/map/screens/map-screen.tsx",
  import.meta.url,
);
const selfUrl = new URL("./cor-233-map-overlapping-points.test.mjs", import.meta.url);
const navigationSource = await readFile(navigationUrl, "utf8");
const screenSource = await readFile(screenUrl, "utf8");

test("COR-233 only groups points with exactly identical persisted coordinates", () => {
  assert.match(
    navigationSource,
    /candidate\.coordinate\.latitude === point\.coordinate\.latitude/,
  );
  assert.match(
    navigationSource,
    /candidate\.coordinate\.longitude === point\.coordinate\.longitude/,
  );
  assert.doesNotMatch(
    navigationSource,
    /coordinateBucketKey|precision|toFixed\(|haversine/i,
  );
});

test("COR-233 orders overlapping points deterministically and hides controls for a single point", () => {
  assert.match(navigationSource, /siblings\.length < 2/);
  assert.match(navigationSource, /Date\.parse\(left\.occurredAt\)/);
  assert.match(navigationSource, /left\.id\.localeCompare\(right\.id\)/);
  assert.match(navigationSource, /label="Précédent"/);
  assert.match(navigationSource, /label="Suivant"/);
});

test("COR-233 cycles only through currently visible map points without adding network access", () => {
  assert.match(screenSource, /points=\{visiblePoints\}/);
  assert.match(screenSource, /onSelectPoint=\{setSelectedPointId\}/);
  assert.match(screenSource, /<MapOverlappingPointNavigation/);
  assert.doesNotMatch(navigationSource, /fetch\(|apiClient|axios|expo\/fetch/);
});

test("COR-233 verify diagnostic", async () => {
  const config = (await resolveConfig(process.cwd())) ?? {};
  const result = {
    navigation: await check(navigationSource, { ...config, filepath: navigationUrl.pathname }),
    screen: await check(screenSource, { ...config, filepath: screenUrl.pathname }),
    test: await check(await readFile(selfUrl, "utf8"), { ...config, filepath: selfUrl.pathname }),
  };
  assert.fail(`COR233_VERIFY_DIAGNOSTIC ${JSON.stringify(result)}`);
});
