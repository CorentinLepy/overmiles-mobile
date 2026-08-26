import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(
  new URL("../src/features/trips/trips-repository.ts", import.meta.url),
  "utf8",
);
const provider = await readFile(
  new URL("../src/features/trips/trips-data-provider.tsx", import.meta.url),
  "utf8",
);
const home = await readFile(
  new URL("../src/features/app-shell/screens/home-screen.tsx", import.meta.url),
  "utf8",
);
const trips = await readFile(
  new URL("../src/features/trips/screens/trips-screen.tsx", import.meta.url),
  "utf8",
);
const detail = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);
const tripCard = await readFile(
  new URL("../src/features/trips/components/trip-card.tsx", import.meta.url),
  "utf8",
);
const tripCover = await readFile(
  new URL("../src/features/trips/components/trip-cover.tsx", import.meta.url),
  "utf8",
);
const assetUrl = await readFile(new URL("../src/lib/api/asset-url.ts", import.meta.url), "utf8");
const dynamicRoute = await readFile(
  new URL("../app/(tabs)/trips/[tripId].tsx", import.meta.url),
  "utf8",
);
const tabsLayout = await readFile(new URL("../app/(tabs)/_layout.tsx", import.meta.url), "utf8");

test("trips repository uses the centralized authenticated API client", () => {
  assert.match(repository, /apiClient\.request<TripSummary\[]>/);
  assert.match(repository, /path: "\/trips"/);
  assert.match(repository, /path: `\/trips\/\$\{encodeURIComponent\(tripId\)\}`/);
  assert.doesNotMatch(repository, /fetch\(|axios/i);
});

test("authenticated tabs share one trips data provider", () => {
  assert.match(tabsLayout, /TripsDataProvider/);
  assert.match(provider, /repository\.list\(\)/);
  assert.match(provider, /repository\.getById\(tripId\)/);
  assert.match(provider, /ensureTrip/);
});

test("home renders real upcoming trip data instead of a product placeholder", () => {
  assert.match(home, /useTripsData\(\)/);
  assert.match(home, /nextTrip\.name/);
  assert.match(home, /daysUntilTrip/);
  assert.match(home, /pathname: "\/trips\/\[tripId\]"/);
  assert.doesNotMatch(home, /Vos voyages arrivent bientôt ici/);
  assert.doesNotMatch(home, /fetch\(|axios/i);
});

test("trips screen covers loading offline error empty and pull-to-refresh states", () => {
  assert.match(trips, /isLoading/);
  assert.match(trips, /isOffline/);
  assert.match(trips, /errorMessage/);
  assert.match(trips, /trips\.length === 0/);
  assert.match(trips, /onRefresh=\{\(\) => void refresh\(\)\}/);
  assert.match(trips, /TripCard/);
  assert.doesNotMatch(trips, /fetch\(|axios/i);
});

test("trip cards render resilient native covers without bypassing API URL rules", () => {
  assert.match(tripCard, /<TripCover trip=\{trip\} \/>/);
  assert.match(tripCover, /resolveApiAssetUrl/);
  assert.match(tripCover, /onError=\{\(\) => setFailedUri\(uri\)\}/);
  assert.match(tripCover, /accessibilityIgnoresInvertColors/);
  assert.match(assetUrl, /candidate\.startsWith\(API_PREFIX\)/);
  assert.match(assetUrl, /parsed\.protocol === "https:"/);
  assert.match(assetUrl, /isLocalDevelopmentHost/);
  assert.doesNotMatch(tripCover, /fetch\(|axios|WebView/i);
});

test("trip detail supports cached data and direct deep-link resolution", () => {
  assert.match(dynamicRoute, /useLocalSearchParams/);
  assert.match(dynamicRoute, /TripDetailScreen tripId=\{tripId\}/);
  assert.match(detail, /findTrip\(tripId\)/);
  assert.match(detail, /ensureTrip\(tripId\)/);
  assert.match(detail, /Version synchronisée/);
  assert.doesNotMatch(detail, /fetch\(|axios/i);
});
