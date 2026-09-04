import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appJson = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const biometricLock = await readFile(
  new URL("../src/lib/security/biometric-lock.ts", import.meta.url),
  "utf8",
);
const biometricController = await readFile(
  new URL("../src/lib/security/biometric-lock-controller.ts", import.meta.url),
  "utf8",
);
const authProvider = await readFile(
  new URL("../src/providers/auth-provider.tsx", import.meta.url),
  "utf8",
);
const rootLayout = await readFile(new URL("../app/_layout.tsx", import.meta.url), "utf8");
const profileScreen = await readFile(
  new URL("../src/features/auth/screens/profile-account-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-58 installs Expo local authentication and configures Face ID", () => {
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
    "SecureStore.setItemAsync(\n        BIOMETRIC_LOCK_PREFERENCE_KEY,",
  );

  assert.ok(authenticationIndex >= 0 && persistenceIndex > authenticationIndex);
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
});

test("biometric preference stays separate from credentials and database keys", () => {
  assert.match(biometricLock, /overmiles\.security\.biometric-lock\.v1/);
  assert.match(biometricLock, /app\.overmiles\.mobile\.biometric-lock/);
  assert.match(biometricLock, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.doesNotMatch(biometricLock, /refresh.?token|access.?token|password|database-key/i);
});

test("auth lifecycle locks authenticated sessions on background", () => {
  assert.match(authProvider, /AppState\.addEventListener\("change"/);
  assert.match(authProvider, /biometricController\.lock\(\)/);
  assert.match(authProvider, /restoreForAuthenticatedSession/);
  assert.match(authProvider, /acceptExplicitAuthentication/);
  assert.match(authProvider, /reauthenticateFromBiometricLock/);
});

test("root layout blocks authenticated content while locally locked", () => {
  assert.match(rootLayout, /status === "authenticated"/);
  assert.match(rootLayout, /biometricState === "locked"/);
  assert.match(rootLayout, /biometricState === "reauth_required"/);
  assert.match(rootLayout, /<BiometricLockScreen \/>/);
});

test("profile exposes an optional biometric lock without replacing logout", () => {
  assert.match(profileScreen, /Activer le verrou biométrique/);
  assert.match(profileScreen, /Désactiver le verrou biométrique/);
  assert.match(profileScreen, /Il ne remplace jamais votre connexion OverMiles/);
  assert.match(profileScreen, /Se déconnecter/);
});

test("server reauthentication stays authoritative in the controller", () => {
  assert.match(biometricController, /reauth_required/);
  assert.match(biometricController, /requireServerReauthentication/);
  assert.match(biometricController, /restoreForAuthenticatedSession/);
  assert.match(biometricController, /clearAfterLogout/);
  assert.doesNotMatch(biometricController, /accessToken|refreshToken|Authorization/);
});
