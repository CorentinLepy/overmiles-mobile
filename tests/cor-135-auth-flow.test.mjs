import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const provider = await readFile(
  new URL("../src/providers/auth-provider.tsx", import.meta.url),
  "utf8",
);
const transport = await readFile(
  new URL("../src/lib/auth/mobile-auth-transport.ts", import.meta.url),
  "utf8",
);
const loginScreen = await readFile(
  new URL("../src/features/auth/screens/login-screen.tsx", import.meta.url),
  "utf8",
);
const mfaScreen = await readFile(
  new URL("../src/features/auth/screens/mfa-screen.tsx", import.meta.url),
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
  assert.match(provider, /createApiClient/);
  assert.match(provider, /sessionManager\.restore\(\)/);
  assert.match(provider, /sessionManager\.acceptSession\(response\)/);
  assert.doesNotMatch(provider, /AsyncStorage|localStorage/);
});

test("successful session restore hydrates the current user from the protected profile endpoint", () => {
  assert.match(provider, /loadCurrentUser/);
  assert.match(provider, /path: "\/users\/me"/);
  assert.match(provider, /auth: "required"/);
  assert.match(provider, /if \(active && restoredUser\) setUser\(restoredUser\)/);
  assert.match(provider, /if \(restoredUser\) setUser\(restoredUser\)/);
  assert.doesNotMatch(provider, /decode.*jwt|jwt.*decode/i);
});

test("offline restore keeps a non-destructive pending state", () => {
  assert.match(provider, /offline_auth_pending/);
  assert.match(provider, /const retryRestore = useCallback/);
  assert.match(provider, /retryRestore,/);
  assert.doesNotMatch(provider, /offline_auth_pending[\s\S]{0,200}clearLocalSession/);
});

test("root and tabs routes gate product navigation behind authentication and MFA", () => {
  assert.match(rootRoute, /status === "authenticated"/);
  assert.match(rootRoute, /Redirect href="\/home"/);
  assert.match(rootRoute, /status === "mfa_required"/);
  assert.match(rootRoute, /Redirect href="\/mfa"/);
  assert.match(rootRoute, /Redirect href="\/login"/);
  assert.match(tabsLayout, /status !== "authenticated"/);
  assert.match(tabsLayout, /Redirect href="\/login"/);
});

test("login screen uses accessible native credential controls and normalized email", () => {
  assert.match(loginScreen, /keyboardType="email-address"/);
  assert.match(loginScreen, /secureTextEntry/);
  assert.match(loginScreen, /autoCorrect=\{false\}/);
  assert.match(loginScreen, /accessibilityLabel="Se connecter"/);
  assert.match(loginScreen, /accessibilityState=\{\{/);
  assert.match(loginScreen, /const normalizedEmail = email\.trim\(\)/);
  assert.match(loginScreen, /await login\(normalizedEmail, password\)/);
  assert.match(loginScreen, /status === "mfa_required"/);
  assert.match(loginScreen, /router\.replace\("\/mfa"\)/);
  assert.match(loginScreen, /Votre mot de passe n’est pas conservé/);
  assert.doesNotMatch(loginScreen, /Google et Apple seront ajoutés/);
  assert.doesNotMatch(loginScreen, /fetch\(|axios/i);
});

test("password login cannot persist a session when the backend requires MFA", () => {
  assert.match(transport, /mfaRequired: true/);
  assert.match(transport, /challengeId: string/);
  assert.match(transport, /challengeExpiresAt: string/);
  assert.match(transport, /"\/auth\/mobile\/login\/mfa"/);
  assert.match(provider, /if \(response\.mfaRequired\)/);
  assert.match(provider, /setPendingMfa\(\{/);
  assert.match(provider, /setStatus\("mfa_required"\)/);

  const passwordChallengeBranch = provider.match(
    /if \(response\.mfaRequired\) \{([\s\S]*?)\n        \}/,
  )?.[1];
  assert.ok(passwordChallengeBranch);
  assert.doesNotMatch(passwordChallengeBranch, /acceptSession|writeRefreshToken|accessToken/);
});

test("native MFA screen supports TOTP and one-time recovery codes without direct network access", () => {
  assert.match(mfaScreen, /MobileMfaFactor/);
  assert.match(mfaScreen, /"totp"/);
  assert.match(mfaScreen, /"recovery"/);
  assert.match(mfaScreen, /completeMfa\(factor, normalizedCode\)/);
  assert.match(mfaScreen, /keyboardType=\{isTotp \? "number-pad" : "default"\}/);
  assert.match(mfaScreen, /autoComplete=\{isTotp \? "one-time-code" : "off"\}/);
  assert.match(mfaScreen, /Aucun jeton de session n’est créé ni enregistré/);
  assert.doesNotMatch(mfaScreen, /fetch\(|axios/i);
});

test("MFA completion persists tokens only after the server returns an authenticated response", () => {
  assert.match(provider, /transport\.completeMfa\(\{/);
  assert.match(provider, /challengeId: pendingMfa\.challengeId/);
  assert.match(provider, /await sessionManager\.acceptSession\(response\)/);
  assert.match(provider, /setPendingMfa\(null\)/);
  assert.match(provider, /setStatus\("authenticated"\)/);
  assert.doesNotMatch(provider, /SecureStore.*challenge|challenge.*SecureStore/i);
});

test("server-expired or consumed MFA challenges force a fresh password login", () => {
  assert.match(provider, /error\.code === "MFA_CHALLENGE_EXPIRED"/);
  assert.match(provider, /Date\.parse\(pendingMfa\.expiresAt\) <= Date\.now\(\)/);
  assert.match(provider, /setPendingMfa\(null\)/);
  assert.match(provider, /setStatus\("anonymous"\)/);
  assert.match(provider, /La vérification MFA a expiré\. Reconnectez-vous\./);
});

test("profile exposes hydrated identity and explicit server-revoking logout", () => {
  assert.match(profileScreen, /user\?\.displayName \|\| user\?\.email/);
  assert.match(profileScreen, /secondaryIdentity/);
  assert.match(profileScreen, /accessibilityLabel="Se déconnecter"/);
  assert.match(profileScreen, /accessibilityState=\{\{ disabled: isBusy, busy: isBusy \}\}/);
  assert.match(profileScreen, /void logout\(\)/);
  assert.match(profileScreen, /useAuth\(\)/);
  assert.doesNotMatch(profileScreen, /COR-58/);
});
