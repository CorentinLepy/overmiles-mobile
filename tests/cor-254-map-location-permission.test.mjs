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
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

function loadPermissionHelper() {
  const compiled = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports.requestForegroundMapLocation;
}

function never() {
  return new Promise(() => {});
}

test("COR-254 reuses an already available foreground MapLibre position", async () => {
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
    { currentPositionTimeoutMs: 5, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "granted");
  assert.equal(permissionRequests, 0);
});

test("COR-254 requests foreground permission when no position is available", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  const result = await requestForegroundMapLocation(
    {
      async getCurrentPosition() {
        return undefined;
      },
      async requestPermissions() {
        return true;
      },
    },
    { currentPositionTimeoutMs: 5, permissionTimeoutMs: 5 },
  );

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
    { currentPositionTimeoutMs: 5, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "denied");
});

test("COR-254 bounds native bridge stalls instead of leaving Localisation pending forever", async () => {
  const requestForegroundMapLocation = loadPermissionHelper();
  const result = await requestForegroundMapLocation(
    {
      getCurrentPosition: never,
      requestPermissions: never,
    },
    { currentPositionTimeoutMs: 5, permissionTimeoutMs: 5 },
  );

  assert.equal(result, "unavailable");
});

test("COR-254 remains inside the existing foreground-only MapLibre stack", () => {
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
