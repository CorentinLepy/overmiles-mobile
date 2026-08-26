import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authProvider = await readFile(new URL("../src/providers/auth-provider.tsx", import.meta.url), "utf8");
const tripsApi = await readFile(new URL("../src/features/trips/trips-api.ts", import.meta.url), "utf8");
const tripsHook = await readFile(new URL("../src/features/trips/use-trips.ts", import.meta.url), "utf8");
const tripsScreen = await readFile(new URL("../src/features/trips/trips-screen.tsx", import.meta.url), "utf8");
const homeScreen = await readFile(new URL("../src/features/app-shell/screens/home-screen.tsx", import.meta.url), "utf8");
const tripsRoute = await readFile(new URL("../app/(tabs)/trips/index.tsx", import.meta.url), "utf8");

test("authenticated ApiClient remains composed from the in-memory auth session", () => {
  assert.match(authProvider, /createApiClient/);
  assert.match(authProvider, /auth: sessionManager/);
  assert.match(authProvider, /apiClient/);
  assert.doesNotMatch(authProvider, /AsyncStorage|localStorage/);
});

test("trips read model uses the centralized authenticated client", () => {
  assert.match(tripsApi, /path: "\/trips"/);
  assert.match(tripsApi, /method: "GET"/);
  assert.doesNotMatch(tripsApi, /fetch\(|axios/i);
  assert.match(tripsHook, /fetchTrips\(apiClient\)/);
});

test("trips tab is a real native data screen with refresh and empty/error states", () => {
  assert.match(tripsRoute, /TripsScreen/);
  assert.match(tripsScreen, /RefreshControl/);
  assert.match(tripsScreen, /isLoading/);
  assert.match(tripsScreen, /errorMessage/);
  assert.match(tripsScreen, /trips\.length === 0/);
  assert.doesNotMatch(tripsScreen, /WebView/);
});

test("home surfaces a live next trip instead of the old placeholder", () => {
  assert.match(homeScreen, /useTrips\(\)/);
  assert.match(homeScreen, /nextTrip/);
  assert.doesNotMatch(homeScreen, /Vos voyages arrivent bientôt ici/);
});
