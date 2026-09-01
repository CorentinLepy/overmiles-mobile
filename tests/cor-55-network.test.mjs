import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClient = await readFile(new URL("../src/lib/api/api-client.ts", import.meta.url), "utf8");
const sessionManager = await readFile(
  new URL("../src/lib/auth/auth-session-manager.ts", import.meta.url),
  "utf8",
);
const tokenStore = await readFile(
  new URL("../src/lib/auth/token-store.ts", import.meta.url),
  "utf8",
);
const secureStoreTokenStore = await readFile(
  new URL("../src/lib/auth/secure-store-token-store.ts", import.meta.url),
  "utf8",
);
const mobileAuthTransport = await readFile(
  new URL("../src/lib/auth/mobile-auth-transport.ts", import.meta.url),
  "utf8",
);
const logger = await readFile(
  new URL("../src/lib/api/safe-network-logger.ts", import.meta.url),
  "utf8",
);

test("centralized client uses expo/fetch and never axios", () => {
  assert.match(apiClient, /from "expo\/fetch"/);
  assert.doesNotMatch(apiClient, /axios/i);
});

test("access token stays out of persistent TokenStore contract", () => {
  assert.match(tokenStore, /readRefreshToken/);
  assert.match(tokenStore, /writeRefreshToken/);
  assert.doesNotMatch(tokenStore, /writeAccessToken|readAccessToken/);
  assert.match(sessionManager, /private accessToken: string \| null = null/);
});

test("SecureStore adapter persists only auth recovery state in device-bound secure storage", () => {
  assert.match(secureStoreTokenStore, /from "expo-secure-store"/);
  assert.match(secureStoreTokenStore, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(secureStoreTokenStore, /getItemAsync\(REFRESH_TOKEN_KEY/);
  assert.match(secureStoreTokenStore, /setItemAsync\(REFRESH_TOKEN_KEY, token/);
  assert.match(secureStoreTokenStore, /deleteItemAsync\(REFRESH_TOKEN_KEY/);
  assert.match(secureStoreTokenStore, /LOGOUT_TOMBSTONE_KEY/);
  assert.match(secureStoreTokenStore, /writeLogoutTombstone/);
  assert.match(secureStoreTokenStore, /clearLogoutTombstone/);
  assert.doesNotMatch(secureStoreTokenStore, /accessToken/);
  assert.doesNotMatch(secureStoreTokenStore, /requireAuthentication\s*:\s*true/);
  assert.doesNotMatch(secureStoreTokenStore, /const normalized = token\.trim/);
});

test("refresh is single-flight and successor refresh is persisted before access publication", () => {
  assert.match(sessionManager, /private refreshPromise: Promise<string> \| null = null/);
  assert.match(sessionManager, /if \(!this\.refreshPromise\)/);
  const writeIndex = sessionManager.indexOf(
    "await this.tokenStore.writeRefreshToken(next.refreshToken)",
  );
  const accessIndex = sessionManager.indexOf("this.accessToken = next.accessToken", writeIndex);
  assert.ok(writeIndex >= 0 && accessIndex > writeIndex);
});

test("mobile auth transport targets login refresh and authenticated logout endpoints", () => {
  assert.match(mobileAuthTransport, /"\/auth\/mobile\/login"/);
  assert.match(mobileAuthTransport, /"\/auth\/mobile\/refresh"/);
  assert.match(mobileAuthTransport, /"\/auth\/mobile\/logout"/);
  assert.match(mobileAuthTransport, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(mobileAuthTransport, /from "expo\/fetch"/);
  assert.doesNotMatch(mobileAuthTransport, /cookie/i);
});

test("auth POST transport has a bounded timeout and no automatic retry loop", () => {
  assert.match(mobileAuthTransport, /AUTH_TIMEOUT_MS = 10_000/);
  assert.match(mobileAuthTransport, /controller\.abort\("timeout"\)/);
  assert.doesNotMatch(mobileAuthTransport, /retryDelayMs|shouldRetry|for\s*\(/);
});

test("logout invalidates local credentials before best-effort server revocation", () => {
  const logoutIndex = sessionManager.indexOf("async logout(): Promise<void>");
  const clearIndex = sessionManager.indexOf("await this.clearLocalSession()", logoutIndex);
  const revokeIndex = sessionManager.indexOf(
    "this.revokeAccessTokenBestEffort(accessToken)",
    logoutIndex,
  );
  const logoutBody = sessionManager.slice(
    logoutIndex,
    sessionManager.indexOf("async clearLocalSession", logoutIndex),
  );

  assert.ok(logoutIndex >= 0 && clearIndex > logoutIndex && revokeIndex > clearIndex);
  assert.doesNotMatch(logoutBody, /getOrRefreshAccessToken|await this\.logoutTransport/);
  assert.match(sessionManager, /void this\.logoutTransport\(accessToken\)\.catch/);
});

test("automatic auth replay is restricted by idempotency or explicit opt-in", () => {
  assert.match(apiClient, /isIdempotentMethod\(method\) \|\| request\.allowAuthReplay === true/);
  assert.match(apiClient, /response\.status === 401/);
});

test("mutation idempotency keys are explicit typed headers and validated", () => {
  assert.match(apiClient, /idempotencyKey\?: string/);
  assert.match(apiClient, /headers\.set\("Idempotency-Key", idempotencyKey\)/);
  assert.match(apiClient, /\^\[A-Za-z0-9\._:-\]\{1,128\}\$/);
  assert.doesNotMatch(apiClient, /isIdempotentMethod\(method\) \|\| request\.idempotencyKey/);

  const validationIndex = apiClient.indexOf("validateIdempotencyKey(request.idempotencyKey)");
  const networkTryIndex = apiClient.indexOf("    try {", validationIndex);
  assert.ok(validationIndex >= 0 && networkTryIndex > validationIndex);
});

test("network logger contract excludes bodies, Authorization and tokens", () => {
  assert.doesNotMatch(logger, /body\s*:/);
  assert.doesNotMatch(logger, /authorization/i);
  assert.doesNotMatch(logger, /token/i);
});
