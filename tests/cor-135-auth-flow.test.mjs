import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const provider = await readFile(
  new URL("../src/providers/auth-provider.tsx", import.meta.url),
  "utf8",
);
const loginScreen = await readFile(
  new URL("../src/features/auth/screens/login-screen.tsx", import.meta.url),
  "utf8",
);
const profileScreen = await readFile(
  new URL("../src/features/auth/screens/profile-account-screen.tsx", import.meta.url),
  "utf8",
);
const rootRoute = await readFile(new URL("../app/index.tsx", import.meta.url), "utf8");
const tabsLayout = await readFile(new URL("../app/(tabs)/_layout.tsx", import.meta.url), "utf8");

test("auth provider composes the approved secure token store and mobile transport", () => {
  assert.match(provider, /createSecureStoreTokenStore/);
  assert.match(provider, /createMobileAuthTransport/);
  assert.match(provider, /new AuthSessionManager/);
  assert.match(provider, /sessionManager\.restore\(\)/);
  assert.match(provider, /sessionManager\.acceptSession\(response\)/);
  assert.doesNotMatch(provider, /AsyncStorage|localStorage/);
});

test("offline restore keeps a non-destructive pending state", () => {
  assert.match(provider, /offline_auth_pending/);
  assert.match(provider, /const retryRestore = useCallback/);
  assert.match(provider, /retryRestore,/);
  assert.doesNotMatch(provider, /offline_auth_pending[\s\S]{0,200}clearLocalSession/);
});

test("root and tabs routes gate product navigation behind authentication", () => {
  assert.match(rootRoute, /status === "authenticated"/);
  assert.match(rootRoute, /Redirect href="\/home"/);
  assert.match(rootRoute, /Redirect href="\/login"/);
  assert.match(tabsLayout, /status !== "authenticated"/);
  assert.match(tabsLayout, /Redirect href="\/login"/);
});

test("login screen uses accessible native credential controls", () => {
  assert.match(loginScreen, /keyboardType="email-address"/);
  assert.match(loginScreen, /secureTextEntry/);
  assert.match(loginScreen, /accessibilityLabel="Se connecter"/);
  assert.match(loginScreen, /await login\(email, password\)/);
  assert.doesNotMatch(loginScreen, /fetch\(|axios/i);
});

test("profile exposes explicit server-revoking logout through the auth provider", () => {
  assert.match(profileScreen, /accessibilityLabel="Se déconnecter"/);
  assert.match(profileScreen, /void logout\(\)/);
  assert.match(profileScreen, /useAuth\(\)/);
});
