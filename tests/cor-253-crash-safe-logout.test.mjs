import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const authSession = await readFile(
  new URL("../src/lib/auth/auth-session-manager.ts", import.meta.url),
  "utf8",
);
const authProvider = await readFile(
  new URL("../src/providers/auth-provider.tsx", import.meta.url),
  "utf8",
);
const tokenStoreContract = await readFile(
  new URL("../src/lib/auth/token-store.ts", import.meta.url),
  "utf8",
);
const secureStoreTokenStore = await readFile(
  new URL("../src/lib/auth/secure-store-token-store.ts", import.meta.url),
  "utf8",
);

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function loadAuthManager(localDataSessionGuard) {
  const compiled = ts.transpileModule(authSession, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };

  class ApiError extends Error {
    constructor(init) {
      super(init.userMessage);
      Object.assign(this, init);
    }
  }

  const mockRequire = (specifier) => {
    if (specifier === "../api/api-error") return { ApiError };
    if (specifier === "../storage/local-data-session-guard") {
      return { localDataSessionGuard };
    }
    throw new Error(`Unexpected dependency: ${specifier}`);
  };

  new Function("require", "module", "exports", compiled)(mockRequire, module, module.exports);
  return module.exports.AuthSessionManager;
}

function createTokenStore(initialRefreshToken = null) {
  let refreshToken = initialRefreshToken;
  let logoutTombstone = false;
  const events = [];

  return {
    events,
    get refreshToken() {
      return refreshToken;
    },
    get logoutTombstone() {
      return logoutTombstone;
    },
    async readRefreshToken() {
      events.push("read-refresh");
      return refreshToken;
    },
    async writeRefreshToken(token) {
      events.push(`write-refresh:${token}`);
      refreshToken = token;
    },
    async clearRefreshToken() {
      events.push("clear-refresh");
      refreshToken = null;
    },
    async hasLogoutTombstone() {
      events.push("read-tombstone");
      return logoutTombstone;
    },
    async writeLogoutTombstone() {
      events.push("write-tombstone");
      logoutTombstone = true;
    },
    async clearLogoutTombstone() {
      events.push("clear-tombstone");
      logoutTombstone = false;
    },
  };
}

function silentGuard() {
  return {
    activate() {},
    invalidate() {},
  };
}

test("COR-253 local logout becomes durable before remote revocation settles", async () => {
  const store = createTokenStore();
  const revokeStarted = deferred();
  const releaseRevoke = deferred();
  const AuthSessionManager = loadAuthManager(silentGuard());
  const manager = new AuthSessionManager(
    store,
    async () => ({ accessToken: "refresh-access", refreshToken: "refresh-next" }),
    async () => {
      revokeStarted.resolve();
      await releaseRevoke.promise;
    },
  );

  await manager.acceptSession({ accessToken: "access-old", refreshToken: "refresh-old" });
  await manager.logout();
  await revokeStarted.promise;

  assert.equal(manager.getAccessToken(), null);
  assert.equal(store.refreshToken, null);
  assert.equal(store.logoutTombstone, true);
  assert.ok(
    store.events.indexOf("write-tombstone") < store.events.indexOf("clear-refresh"),
  );

  const restarted = new AuthSessionManager(
    store,
    async () => {
      throw new Error("restore must not refresh a logged-out session");
    },
    async () => {},
  );
  assert.equal(await restarted.restore(), "anonymous");
  assert.equal(store.logoutTombstone, true);

  releaseRevoke.resolve();
});

test("COR-253 an in-flight refresh cannot rewrite credentials after logout", async () => {
  const store = createTokenStore("refresh-old");
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  const AuthSessionManager = loadAuthManager(silentGuard());
  const manager = new AuthSessionManager(
    store,
    async () => {
      refreshStarted.resolve();
      await releaseRefresh.promise;
      return { accessToken: "access-new", refreshToken: "refresh-new" };
    },
    async () => {},
  );

  const refresh = manager.refresh();
  await refreshStarted.promise;
  await manager.logout();
  releaseRefresh.resolve();

  await assert.rejects(refresh, (error) => error.code === "LOCAL_SESSION_INVALIDATED");
  assert.equal(manager.getAccessToken(), null);
  assert.equal(store.refreshToken, null);
  assert.equal(store.logoutTombstone, true);
  assert.equal(store.events.includes("write-refresh:refresh-new"), false);
});

test("COR-253 offline revocation failure never reopens or rejects local logout", async () => {
  const store = createTokenStore();
  const AuthSessionManager = loadAuthManager(silentGuard());
  const manager = new AuthSessionManager(
    store,
    async () => ({ accessToken: "access-refresh", refreshToken: "refresh-next" }),
    async () => {
      throw new Error("offline");
    },
  );

  await manager.acceptSession({ accessToken: "access-old", refreshToken: "refresh-old" });
  await assert.doesNotReject(manager.logout());
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(manager.getAccessToken(), null);
  assert.equal(store.refreshToken, null);
  assert.equal(store.logoutTombstone, true);
});

test("COR-253 explicit new authentication clears a previous logout tombstone", async () => {
  const store = createTokenStore("stale-refresh");
  await store.writeLogoutTombstone();
  const AuthSessionManager = loadAuthManager(silentGuard());
  const manager = new AuthSessionManager(
    store,
    async () => {
      throw new Error("unused");
    },
    async () => {},
  );

  await manager.acceptSession({ accessToken: "access-new", refreshToken: "refresh-new" });

  assert.equal(store.logoutTombstone, false);
  assert.equal(store.refreshToken, "refresh-new");
  assert.equal(manager.getAccessToken(), "access-new");
});

test("COR-253 production token store persists a same-service logout tombstone", () => {
  assert.match(tokenStoreContract, /hasLogoutTombstone\?/);
  assert.match(tokenStoreContract, /writeLogoutTombstone\?/);
  assert.match(tokenStoreContract, /clearLogoutTombstone\?/);
  assert.match(secureStoreTokenStore, /LOGOUT_TOMBSTONE_KEY/);
  assert.match(
    secureStoreTokenStore,
    /KEYCHAIN_SERVICE = "app\.overmiles\.mobile\.auth"/,
  );
  assert.match(secureStoreTokenStore, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
});

test("COR-253 AuthProvider purges private data immediately after local session logout", () => {
  const logoutIndex = authProvider.indexOf("const logout = useCallback");
  const sessionLogoutIndex = authProvider.indexOf(
    "await sessionManager.logout()",
    logoutIndex,
  );
  const purgeIndex = authProvider.indexOf("await purgeLocalPrivateData()", sessionLogoutIndex);
  const anonymousIndex = authProvider.indexOf('setStatus("anonymous")', purgeIndex);

  assert.ok(
    logoutIndex >= 0 &&
      sessionLogoutIndex > logoutIndex &&
      purgeIndex > sessionLogoutIndex &&
      anonymousIndex > purgeIndex,
  );
});
