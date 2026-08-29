import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appJson = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const env = await readFile(new URL("../src/config/env.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/(tabs)/map/index.tsx", import.meta.url), "utf8");
const screen = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);
const mapData = await readFile(
  new URL("../src/features/map/use-map-data.ts", import.meta.url),
  "utf8",
);
const geojson = await readFile(
  new URL("../src/features/map/map-geojson.ts", import.meta.url),
  "utf8",
);
const viewport = await readFile(
  new URL("../src/features/map/map-viewport.ts", import.meta.url),
  "utf8",
);

test("COR-137 Phase B installs MapLibre Native through the Expo config plugin", () => {
  assert.equal(packageJson.dependencies["@maplibre/maplibre-react-native"], "11.3.6");
  assert.ok(appJson.expo.plugins.includes("@maplibre/maplibre-react-native"));
  assert.match(packageJson.scripts["map:config"], /expo config --type public/);
});

test("map style remains runtime-configurable with OpenFreeMap Liberty as the safe default", () => {
  assert.match(env, /EXPO_PUBLIC_MAP_STYLE_URL/);
  assert.match(env, /https:\/\/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(env, /mapStyleUrl/);
  assert.match(env, /parsed\.protocol !== "https:"/);
  assert.match(screen, /mapStyle=\{runtimeConfig\.mapStyleUrl\}/);
});

test("map route renders the native product screen instead of a placeholder", () => {
  assert.match(route, /MapScreen/);
  assert.doesNotMatch(route, /SectionPlaceholderScreen/);
  assert.match(screen, /Map,?\s*Camera|Camera,?\s*GeoJSONSource/);
  assert.match(screen, /GeoJSONSource/);
  assert.match(screen, /type="circle"/);
});

test("native map renders only OverMiles data and never calls geocoding providers directly", () => {
  assert.match(mapData, /createMapStopsRepository/);
  assert.match(mapData, /createMapTimelineRepository/);
  assert.match(mapData, /Promise\.allSettled/);
  assert.doesNotMatch(screen, /geoapify|google maps|webview|fetch\(|axios/i);
  assert.doesNotMatch(mapData, /geoapify|google maps|webview|fetch\(|axios/i);
});

test("map detail fan-out is gated by the active map pathname and reuses the same trip snapshot", () => {
  assert.match(screen, /usePathname/);
  assert.match(screen, /pathname === "\/map" \|\| pathname\.startsWith\("\/map\/"\)/);
  assert.match(screen, /useMapData\(isMapActive\)/);
  assert.match(mapData, /export function useMapData\(enabled: boolean\)/);
  assert.match(mapData, /if \(!enabled \|\| status !== "authenticated"/);
  assert.match(mapData, /loadedTripsKeyRef/);
  assert.match(mapData, /inFlightTripsKeyRef/);
  assert.match(mapData, /latestRequestedTripsKeyRef/);
  assert.match(mapData, /loadedTripsKeyRef\.current === tripsKey/);
  assert.match(mapData, /createTripsKey/);
  assert.match(mapData, /trip\.updatedAt/);
  assert.match(mapData, /trip\.version/);
  assert.doesNotMatch(mapData, /useFocusEffect/);
});

test("visited map points preserve longitude-latitude GeoJSON order and provenance", () => {
  assert.match(geojson, /type: "FeatureCollection"/);
  assert.match(geojson, /type: "Point"/);
  assert.match(
    geojson,
    /coordinates: \[point\.coordinate\.longitude, point\.coordinate\.latitude\]/,
  );
  assert.match(geojson, /tripId: point\.tripId/);
  assert.match(geojson, /tripName: point\.tripName/);
  assert.match(geojson, /kind: point\.kind/);
});

test("camera framing handles empty single-point and multi-point histories without hidden clustering", () => {
  assert.match(viewport, /center: \[0, 20\]/);
  assert.match(viewport, /points\.length === 1/);
  assert.match(
    viewport,
    /const bounds: \[number, number, number, number\] = \[west, south, east, north\]/,
  );
  assert.doesNotMatch(screen, /clusterRadius|clusterMaxZoom|clusterMinPoints/);
  assert.doesNotMatch(mapData, /clusterRadius|clusterMaxZoom|clusterMinPoints/);
});

test("Phase B does not request live device location or GPS permissions", () => {
  assert.equal(packageJson.dependencies["expo-location"], undefined);
  assert.doesNotMatch(screen, /UserLocation|trackUserLocation|requestForegroundPermissionsAsync/);
  assert.doesNotMatch(JSON.stringify(appJson), /ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION/);
});

test("partial network failures retain successful map data instead of blanking the map", () => {
  assert.match(
    mapData,
    /result\.successfulPoints\.length > 0 \? result\.successfulPoints : pointsFromState/,
  );
  assert.match(mapData, /status: "offline"/);
  assert.match(mapData, /status: "error"/);
  assert.match(mapData, /error\.kind === "network" \|\| error\.kind === "timeout"/);
});
