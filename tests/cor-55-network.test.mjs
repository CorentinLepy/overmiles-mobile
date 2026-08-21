import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClient = await readFile(
  new URL("../src/lib/api/api-client.ts", import.meta.url),
  "utf8",
);
const sessionManager = await readFile(
  new URL("../src/lib/auth/auth-session-manager.ts", import.meta.url),
  "utf8",
);
const tokenStore = await readFile(
  new URL("../src/lib/auth/token-store.ts", import.meta.url),
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

test("refresh is single-flight and successor refresh is persisted before access publication", () => {
  assert.match(sessionManager, /private refreshPromise: Promise<string> \| null = null/);
  assert.match(sessionManager, /if \(!this\.refreshPromise\)/);
  const writeIndex = sessionManager.indexOf(
    "await this.tokenStore.writeRefreshToken(next.refreshToken)",
  );
  const accessIndex = sessionManager.indexOf("this.accessToken = next.accessToken", writeIndex);
  assert.ok(writeIndex >= 0 && accessIndex > writeIndex);
});

test("automatic auth replay is restricted by idempotency or explicit opt-in", () => {
  assert.match(apiClient, /isIdempotentMethod\(method\) \|\| request\.allowAuthReplay === true/);
  assert.match(apiClient, /response\.status === 401/);
});

test("network logger contract excludes bodies, Authorization and tokens", () => {
  assert.doesNotMatch(logger, /body\s*:/);
  assert.doesNotMatch(logger, /authorization/i);
  assert.doesNotMatch(logger, /token/i);
});
