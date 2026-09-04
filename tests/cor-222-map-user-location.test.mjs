import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appJson = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-222 configures foreground-only native location permissions", () => {
  assert.equal(packageJson.dependencies["expo-location"], undefined);
  assert.equal(
    appJson.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription,
    "Afficher votre position sur la carte pendant l’utilisation d’OverMiles.",
  );
  assert.deepEqual(appJson.expo.android.permissions, [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
  ]);
  assert.doesNotMatch(JSON.stringify(appJson), /ACCESS_BACKGROUND_LOCATION/);
});

test("COR-222 only requests location after an explicit map action", () => {
  assert.match(mapScreenSource, /async function toggleUserLocation\(\): Promise<void>/);
  assert.match(mapScreenSource, /LocationManager\.requestPermissions\(\)/);
  assert.match(mapScreenSource, /onPress=\{\(\) => void toggleUserLocation\(\)\}/);
  assert.match(mapScreenSource, /Afficher ma position sur la carte/);
  assert.doesNotMatch(mapScreenSource, /useEffect/);
});

test("COR-222 renders MapLibre user location with accuracy and terrain camera tracking", () => {
  assert.match(mapScreenSource, /<UserLocation animated accuracy minDisplacement=\{5\} \/>/);
  assert.match(mapScreenSource, /trackUserLocation: "default" as const/);
  assert.match(mapScreenSource, /zoom: 15/);
  assert.match(mapScreenSource, /Position affichée/);
  assert.match(mapScreenSource, /minHeight: 44/);
});

test("COR-222 keeps denied or unavailable location non-destructive and local-only", () => {
  assert.match(mapScreenSource, /Localisation désactivée/);
  assert.match(mapScreenSource, /Localisation indisponible/);
  assert.match(mapScreenSource, /setIsUserLocationEnabled\(false\)/);
  assert.doesNotMatch(mapScreenSource, /fetch\s*\(|axios|FormData|SQLCipher|SecureStore/);
});
