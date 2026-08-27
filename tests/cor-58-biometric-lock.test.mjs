import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const controller = await readFile(
  new URL("../src/lib/security/local-lock.ts", import.meta.url),
  "utf8",
);
const preferences = await readFile(
  new URL("../src/lib/security/local-lock-preferences.ts", import.meta.url),
  "utf8",
);

test("biometric lock never replaces server authentication", () => {
  assert.match(controller, /requireServerReauthentication/);
  assert.match(controller, /reauth_required/);
  assert.doesNotMatch(controller, /accessToken|refreshToken|Authorization/);
});

test("enabling biometric lock requires available biometrics and a successful challenge", () => {
  assert.match(controller, /getCapability\(\)/);
  assert.match(controller, /biometrics\.authenticate\(\)/);
  assert.match(controller, /preferences\.setEnabled\(true\)/);
});

test("locked out or unavailable biometrics require full reauthentication", () => {
  assert.match(controller, /locked_out/);
  assert.match(controller, /unavailable/);
  assert.match(controller, /reauth_required/);
});

test("cancelled or failed local unlock keeps the application locked", () => {
  assert.match(controller, /outcome === "success"/);
  assert.match(controller, /: "locked"/);
});

test("biometric preference uses its own device-bound SecureStore namespace", () => {
  assert.match(preferences, /overmiles\.security\.biometric-lock\.v1/);
  assert.match(preferences, /app\.overmiles\.mobile\.local-lock/);
  assert.match(preferences, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.doesNotMatch(preferences, /database-key|refresh-token/i);
});
