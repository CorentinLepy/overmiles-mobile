import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appJson = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const biometricLock = await readFile(
  new URL("../src/lib/security/biometric-lock.ts", import.meta.url),
  "utf8",
);

test("COR-58 installs the Expo 57 local authentication module and Face ID plugin", () => {
  assert.equal(packageJson.dependencies["expo-local-authentication"], "~57.0.2");

  const plugin = appJson.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === "expo-local-authentication",
  );
  assert.ok(plugin);
  assert.match(plugin[1].faceIDPermission, /Face ID/);
  assert.match(plugin[1].faceIDPermission, /déverrouiller OverMiles/);
});

test("biometric lock only accepts strong enrolled biometrics", () => {
  assert.match(biometricLock, /getEnrolledLevelAsync/);
  assert.match(biometricLock, /SecurityLevel\.BIOMETRIC_STRONG/);
  assert.match(biometricLock, /biometricsSecurityLevel: "strong"/);
  assert.match(biometricLock, /hasHardwareAsync/);
  assert.match(biometricLock, /isEnrolledAsync/);
});

test("local lock never falls back silently to the device passcode", () => {
  assert.match(biometricLock, /disableDeviceFallback: true/);
  assert.match(biometricLock, /fallbackLabel: ""/);
  assert.match(biometricLock, /case "lockout"/);
  assert.match(biometricLock, /case "user_fallback"/);
  assert.match(biometricLock, /status: "requires_reauth"/);
});

test("enabling the lock requires a successful biometric challenge before persistence", () => {
  const authenticationIndex = biometricLock.indexOf(
    'this.authenticate("Activer le verrou biométrique OverMiles")',
  );
  const persistenceIndex = biometricLock.indexOf(
    'SecureStore.setItemAsync(\n        BIOMETRIC_LOCK_PREFERENCE_KEY,',
  );
  assert.ok(authenticationIndex >= 0 && persistenceIndex > authenticationIndex);
  assert.match(biometricLock, /catch \{\s*return \{ status: "failed" \};\s*\}/);
});

test("unlock fails closed if SecureStore cannot read the biometric preference", () => {
  const unlockIndex = biometricLock.indexOf("async unlockIfEnabled()");
  const readIndex = biometricLock.indexOf("enabled = await this.isEnabled()", unlockIndex);
  const catchIndex = biometricLock.indexOf("catch", readIndex);
  const reauthIndex = biometricLock.indexOf('return { status: "requires_reauth" }', catchIndex);
  const notEnabledIndex = biometricLock.indexOf('return { status: "not_enabled" }', unlockIndex);

  assert.ok(unlockIndex >= 0);
  assert.ok(readIndex > unlockIndex);
  assert.ok(catchIndex > readIndex);
  assert.ok(reauthIndex > catchIndex);
  assert.ok(notEnabledIndex > reauthIndex);
  assert.doesNotMatch(biometricLock, /isEnabled\(\)[\s\S]{0,160}catch[\s\S]{0,100}return false/);
});

test("biometric preference stays separate from credentials and database keys", () => {
  assert.match(biometricLock, /overmiles\.security\.biometric-lock\.v1/);
  assert.match(biometricLock, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.doesNotMatch(biometricLock, /requireAuthentication\s*:\s*true/);
  assert.doesNotMatch(biometricLock, /refresh.?token|access.?token|password|database-key/i);
});

test("lock service has no hidden timing or background policy", () => {
  assert.doesNotMatch(biometricLock, /AppState|setTimeout|backgroundAt|gracePeriod|minutes/i);
});
