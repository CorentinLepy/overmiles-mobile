import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const types = await readFile(new URL("../src/features/map/map.types.ts", import.meta.url), "utf8");
const projection = await readFile(
  new URL("../src/features/map/map-projection.ts", import.meta.url),
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
const destinationRepository = await readFile(
  new URL("../src/features/map/map-destination-repository.ts", import.meta.url),
  "utf8",
);

test("COR-137 map contracts stay independent from a rendering provider", () => {
  assert.match(types, /export type MapCoordinate/);
  assert.match(types, /export type TripMapPoint/);
  assert.match(types, /export type VisitedPlace/);
  assert.match(types, /export type DestinationSuggestion/);
  assert.match(types, /export type SelectedDestination/);
  assert.match(types, /status: "visited" \| "unvisited"/);
  assert.match(types, /status: "offline"/);

  for (const source of [
    types,
    projection,
    stopsRepository,
    timelineRepository,
    destinationRepository,
  ]) {
    assert.doesNotMatch(source, /maplibre|geoapify|openfreemap|google maps|webview/i);
  }
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

test("map stops repository uses the existing authenticated stops endpoint", () => {
  assert.match(stopsRepository, /ApiClient/);
  assert.match(stopsRepository, /apiClient\.request<TripStopResponse\[]>/);
  assert.match(stopsRepository, /`\/trips\/\$\{encodeURIComponent\(trip\.id\)\}\/stops`/);
  assert.match(stopsRepository, /auth: "required"/);
  assert.match(stopsRepository, /kind: "stop" as const/);
  assert.match(stopsRepository, /projectTripMapPoints/);
  assert.doesNotMatch(stopsRepository, /fetch\(|axios/i);
});

test("map timeline repository uses existing geolocated trip events", () => {
  assert.match(timelineRepository, /ApiClient/);
  assert.match(timelineRepository, /apiClient\.request<TimelineEventResponse\[]>/);
  assert.match(timelineRepository, /`\/trips\/\$\{encodeURIComponent\(trip\.id\)\}\/events`/);
  assert.match(timelineRepository, /event\.latitude === null \|\| event\.longitude === null/);
  assert.match(timelineRepository, /kind: "timeline" as const/);
  assert.match(timelineRepository, /projectTripMapPoints/);
  assert.doesNotMatch(timelineRepository, /fetch\(|axios/i);
});

test("destination exploration stays behind the OverMiles places API abstraction", () => {
  assert.match(destinationRepository, /ApiClient/);
  assert.match(destinationRepository, /apiClient\.request<PlaceSuggestionResponse\[]>/);
  assert.match(destinationRepository, /`\/places\/suggestions\?q=\$\{encodeURIComponent/);
  assert.match(destinationRepository, /auth: "required"/);
  assert.match(destinationRepository, /createMapCoordinate/);
  assert.doesNotMatch(destinationRepository, /status:\s*"unvisited"/);
  assert.doesNotMatch(destinationRepository, /fetch\(|axios|geoapify/i);
});
