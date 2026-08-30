import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const distanceSource = await readFile(
  new URL("../src/features/map/map-distance.ts", import.meta.url),
  "utf8",
);
const distanceComponentSource = await readFile(
  new URL("../src/features/map/map-point-distance.tsx", import.meta.url),
  "utf8",
);
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);

function loadDistanceModule() {
  const compiled = ts.transpileModule(distanceSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

test("COR-226 calculates local geodesic distance with bounded coordinates", () => {
  const { calculateMapDistanceMeters } = loadDistanceModule();

  assert.equal(
    calculateMapDistanceMeters(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8566, longitude: 2.3522 },
    ),
    0,
  );

  const shortDistance = calculateMapDistanceMeters(
    { latitude: 48.8566, longitude: 2.3522 },
    { latitude: 48.8576, longitude: 2.3522 },
  );
  assert.ok(shortDistance > 110 && shortDistance < 112);

  const parisToLondon = calculateMapDistanceMeters(
    { latitude: 48.8566, longitude: 2.3522 },
    { latitude: 51.5074, longitude: -0.1278 },
  );
  assert.ok(parisToLondon > 340_000 && parisToLondon < 350_000);

  assert.equal(
    calculateMapDistanceMeters(
      { latitude: 91, longitude: 2.3522 },
      { latitude: 48.8566, longitude: 2.3522 },
    ),
    null,
  );
});

test("COR-226 formats distance without inventing travel duration", () => {
  const { formatMapDistance } = loadDistanceModule();

  assert.equal(formatMapDistance(349.6), "350 m");
  assert.equal(formatMapDistance(2_400), "2,4 km");
  assert.equal(formatMapDistance(12_345), "12 km");
  assert.equal(formatMapDistance(-1), null);
  assert.doesNotMatch(distanceSource, /minute|heure|duration|ETA/i);
});

test("COR-226 reads live position only through the existing MapLibre foreground stack", () => {
  assert.match(distanceComponentSource, /useCurrentPosition\(\)/);
  assert.match(distanceComponentSource, /position\.coords\.latitude/);
  assert.match(distanceComponentSource, /position\.coords\.longitude/);
  assert.match(distanceComponentSource, /À \{distanceLabel\} de vous/);
  assert.doesNotMatch(
    distanceComponentSource,
    /fetch\s*\(|axios|apiClient|SQLCipher|SecureStore|AsyncStorage/,
  );
});

test("COR-226 mounts distance context only while Ma position is explicitly active", () => {
  assert.match(mapScreenSource, /showUserDistance=\{isUserLocationEnabled\}/);
  assert.match(mapScreenSource, /showUserDistance \? <MapPointDistance point=\{point\} \/> : null/);
  assert.match(mapScreenSource, /import \{ MapPointDistance \} from "\.\.\/map-point-distance"/);
});
