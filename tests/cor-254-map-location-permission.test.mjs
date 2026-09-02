import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const helperSource = await readFile(
  new URL("../src/features/map/map-location-permission.ts", import.meta.url),
  "utf8",
);
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

function loadPermissionHelper() {
  const output = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", output);
  evaluate(module, module.exports);
  return module.exports.requestForegroundMapLocation;
}

function never() {
  return new Promise(() => {});
}

test("COR-254 reuses an already available MapLibre position", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  let permissionRequests = 0;

  const result = await requestForegroundMapLocation(
    {
      async getCurrentPosition() {
        return { coords: { latitude: 48.8566, longitude: 2.3522 } };
      },
      async requestPermissions() {
        permissionRequests += 1;
        return true;
      },
    },
    { currentPositionTimeoutMs: 5, nativeBridgeWarmupMs: 1, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "granted");
  assert.equal(permissionRequests, 0);
});

test("COR-254 retries position once after native bridge warmup", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  let reads = 0;
  let permissionRequests = 0;

  const result = await requestForegroundMapLocation(
    {
      async getCurrentPosition() {
        reads += 1;
        return reads === 1 ? undefined : { coords: { latitude: 48.8566, longitude: 2.3522 } };
      },
      async requestPermissions() {
        permissionRequests += 1;
        return true;
      },
    },
    { currentPositionTimeoutMs: 5, nativeBridgeWarmupMs: 1, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "granted");
  assert.equal(reads, 2);
  assert.equal(permissionRequests, 0);
});

test("COR-254 requests permission when no position is available after warmup", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  let reads = 0;

  const result = await requestForegroundMapLocation(
    {
      async getCurrentPosition() {
        reads += 1;
        return undefined;
      },
      async requestPermissions() {
        return true;
      },
    },
    { currentPositionTimeoutMs: 5, nativeBridgeWarmupMs: 1, permissionTimeoutMs: 5 },
  );

  assert.equal(reads, 2);
  assert.equal(result, "granted");
});

test("COR-254 keeps an explicit denial non-destructive", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  const result = await requestForegroundMapLocation(
    {
      async getCurrentPosition() {
        return undefined;
      },
      async requestPermissions() {
        return false;
      },
    },
    { currentPositionTimeoutMs: 5, nativeBridgeWarmupMs: 1, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "denied");
});

test("COR-254 bounds a stalled native permission bridge", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  const result = await requestForegroundMapLocation(
    {
      getCurrentPosition: never,
      requestPermissions: never,
    },
    { currentPositionTimeoutMs: 5, nativeBridgeWarmupMs: 1, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "unavailable");
});

test("COR-254 remains foreground-only without a new location dependency", () => {
  assert.equal(packageJson.dependencies["expo-location"], undefined);
  assert.match(mapScreenSource, /requestForegroundMapLocation/);
  assert.match(mapScreenSource, /LocationManager\.getCurrentPosition\(\)/);
  assert.match(mapScreenSource, /LocationManager\.requestPermissions\(\)/);
  assert.match(mapScreenSource, /setIsRequestingLocation\(false\)/);
  assert.doesNotMatch(
    helperSource + mapScreenSource,
    /ACCESS_BACKGROUND_LOCATION|startLocationUpdates/,
  );
  assert.doesNotMatch(helperSource, /fetch\s*\(|axios|SecureStore|SQLCipher/);
});
