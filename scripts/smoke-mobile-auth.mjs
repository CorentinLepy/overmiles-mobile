const apiBaseUrl = (
  process.env.OVERMILES_SMOKE_API_URL ?? "https://overmiles.app/api/v1"
).replace(/\/$/, "");
const email = process.env.OVERMILES_SMOKE_EMAIL;
const password = process.env.OVERMILES_SMOKE_PASSWORD;

if (!email || !password) {
  console.error("Missing OVERMILES_SMOKE_EMAIL or OVERMILES_SMOKE_PASSWORD.");
  process.exit(2);
}

if (!apiBaseUrl.startsWith("https://")) {
  console.error("Smoke test refuses a non-HTTPS API URL.");
  process.exit(2);
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function tokenShape(value, prefix) {
  return typeof value === "string" && value.startsWith(prefix) && value.length > prefix.length + 20;
}

let firstRefreshToken;
let secondRefreshToken;
let refreshedAccessToken;

try {
  console.log(`1/5 login -> ${apiBaseUrl}/auth/mobile/login`);
  const login = await jsonRequest("/auth/mobile/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(login.response.status === 200, `login returned HTTP ${login.response.status}`);
  assert(tokenShape(login.body.accessToken, ""), "login did not return an access token");
  assert(
    tokenShape(login.body.refreshToken, "omr1_"),
    "login did not return a valid refresh token",
  );
  assert(typeof login.body.sessionId === "string", "login did not return a sessionId");
  firstRefreshToken = login.body.refreshToken;
  console.log("   PASS login/session issued (tokens redacted)");

  console.log("2/5 refresh rotation");
  const refresh = await jsonRequest("/auth/mobile/refresh", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: firstRefreshToken }),
  });
  assert(refresh.response.status === 200, `refresh returned HTTP ${refresh.response.status}`);
  assert(tokenShape(refresh.body.accessToken, ""), "refresh did not return an access token");
  assert(
    tokenShape(refresh.body.refreshToken, "omr1_"),
    "refresh did not return a successor refresh token",
  );
  assert(refresh.body.refreshToken !== firstRefreshToken, "refresh token was not rotated");
  secondRefreshToken = refresh.body.refreshToken;
  refreshedAccessToken = refresh.body.accessToken;
  console.log("   PASS refresh token rotated (tokens redacted)");

  console.log("3/5 authenticated /auth/me");
  const me = await jsonRequest("/auth/me", {
    headers: { Accept: "application/json", Authorization: `Bearer ${refreshedAccessToken}` },
  });
  assert(me.response.status === 200, `/auth/me returned HTTP ${me.response.status}`);
  assert(typeof me.body.id === "string", "/auth/me did not return a user");
  console.log("   PASS access token accepted");

  console.log("4/5 mobile logout");
  const logout = await jsonRequest("/auth/mobile/logout", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${refreshedAccessToken}` },
  });
  assert(logout.response.status === 204, `logout returned HTTP ${logout.response.status}`);
  console.log("   PASS session revoked");

  console.log("5/5 revoked refresh rejection");
  const afterLogout = await jsonRequest("/auth/mobile/refresh", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: secondRefreshToken }),
  });
  assert(
    afterLogout.response.status === 401,
    `revoked refresh returned HTTP ${afterLogout.response.status}, expected 401`,
  );
  console.log("   PASS revoked refresh rejected");

  console.log("COR-55 live auth smoke: PASS");
} catch (error) {
  console.error(
    `COR-55 live auth smoke: FAIL - ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
