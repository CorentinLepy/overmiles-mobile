import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const types = await readFile(new URL("../src/features/map/map.types.ts", import.meta.url), "utf8");
const projection = await readFile(
  new URL("../src/features/map/map-projection.ts", import.meta.url),
  "utf8",
);

test("COR-137 map contracts stay independent from a rendering provider", () => {
  assert.match(types, /export type MapCoordinate/);
  assert.match(types, /export type TripMapPoint/);
  assert.match(types, /export type VisitedPlace/);
  assert.match(types, /export type SelectedDestination/);
  assert.match(types, /status: "visited" \| "unvisited"/);
  assert.match(types, /status: "offline"/);
  assert.doesNotMatch(types, /maplibre|geoapify|openfreemap|google maps|webview/i);
  assert.doesNotMatch(projection, /maplibre|geoapify|openfreemap|google maps|webview/i);
});

test("coordinate projection accepts Prisma decimal serialization and rejects invalid bounds", () => {
  assert.match(types, /latitude: number \| string/);
  assert.match(types, /longitude: number \| string/);
  assert.match(projection, /normalizedLatitude < -90/);
  assert.match(projection, /normalizedLatitude > 90/);
  assert.match(projection, /normalizedLongitude < -180/);
  assert.match(projection, /normalizedLongitude > 180/);
  assert.match(projection, /Number\.isFinite/);
});

test("visited grouping never hides a product decision behind a default threshold", () => {
  assert.match(projection, /precision: number/);
  assert.doesNotMatch(projection, /precision\s*=\s*\d/);
  assert.match(projection, /Number\.isInteger\(precision\)/);
  assert.match(projection, /precision < 1 \|\| precision > 6/);
});

test("map projection preserves trip provenance and visited semantics", () => {
  assert.match(projection, /tripId: point\.tripId/);
  assert.match(projection, /tripName: point\.tripName/);
  assert.match(projection, /kind: point\.kind/);
  assert.match(projection, /visited: true as const/);
  assert.match(projection, /tripIds: Object\.freeze/);
});
