import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const profileStore = await readFile(
  new URL("../src/lib/auth/local-auth-profile-store.ts", import.meta.url),
  "utf8",
);
const authProvider = await readFile(
  new URL("../src/providers/auth-provider.tsx", import.meta.url),
  "utf8",
);
const rootLayout = await readFile(new URL("../app/_layout.tsx", import.meta.url), "utf8");
const indexRoute = await readFile(new URL("../app/index.tsx", import.meta.url), "utf8");
const tabsLayout = await readFile(new URL("../app/(tabs)/_layout.tsx", import.meta.url), "utf8");
const tripsProvider = await readFile(
  new URL("../src/features/trips/trips-data-provider.tsx", import.meta.url),
  "utf8",
);

test("cached offline identity lives inside SQLCipher app_state instead of credential storage", () => {
  assert.match(profileStore, /localDatabase/);
  assert.match(profileStore, /FROM app_state WHERE key = \?/);
  assert.match(profileStore, /INSERT INTO app_state/);
  assert.match(profileStore, /auth\.current-user\.v1/);
  assert.doesNotMatch(profileStore, /SecureStore|refreshToken|accessToken|password/);
});

test("offline auth pending only enters product routes when an encrypted cached user exists", () => {
  assert.match(indexRoute, /status === "offline_auth_pending" && user/);
  assert.match(tabsLayout, /status === "offline_auth_pending" && user !== null/);
  assert.match(tabsLayout, /if \(!hasLocalContentSession\)/);
  assert.match(authProvider, /const cachedUser = await readCachedUser\(\)/);
  assert.match(authProvider, /if \(cachedUser\) setUser\(cachedUser\)/);
});

test("biometric privacy gate also protects cached offline sessions", () => {
  assert.match(rootLayout, /status === "offline_auth_pending" && user !== null/);
  assert.match(rootLayout, /biometricState === "locked"/);
  assert.match(rootLayout, /biometricState === "reauth_required"/);
  assert.match(authProvider, /restoreBiometricForLocalContent/);
  assert.match(authProvider, /status === "offline_auth_pending" && user !== null/);
});

test("Trips stay local-only while session verification is offline", () => {
  assert.match(tripsProvider, /const offlineOnly = status === "offline_auth_pending"/);
  assert.match(tripsProvider, /activeRepository\.listCached\(\)/);
  assert.match(tripsProvider, /if \(offlineOnly\)/);
  assert.match(tripsProvider, /await retryRestore\(\)/);

  const offlineBranch = tripsProvider.match(/if \(offlineOnly\) \{([\s\S]*?)\n      \}/)?.[1];
  assert.ok(offlineBranch);
  assert.doesNotMatch(offlineBranch, /activeRepository\.refresh|repository\.getById/);
});

test("logout unauthorized recovery and biometric reauth destroy local private data", () => {
  assert.match(authProvider, /localDatabase\.purge\(\)/);
  assert.match(authProvider, /await sessionManager\.clearLocalSession\(\);\n      await purgeLocalPrivateData\(\)/);
  assert.match(authProvider, /await sessionManager\.logout\(\);[\s\S]*await purgeLocalPrivateData\(\)/);
  assert.match(
    authProvider,
    /await sessionManager\?\.clearLocalSession\(\);\n      await purgeLocalPrivateData\(\)/,
  );
});
