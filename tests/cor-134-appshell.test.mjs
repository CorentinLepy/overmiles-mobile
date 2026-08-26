import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootRoute = await readFile(new URL("../app/index.tsx", import.meta.url), "utf8");
const tabLayout = await readFile(new URL("../app/(tabs)/_layout.tsx", import.meta.url), "utf8");
const tokens = await readFile(new URL("../src/theme/tokens.ts", import.meta.url), "utf8");
const home = await readFile(
  new URL("../src/features/app-shell/screens/home-screen.tsx", import.meta.url),
  "utf8",
);
const appScreen = await readFile(
  new URL("../src/components/ui/app-screen.tsx", import.meta.url),
  "utf8",
);

test("root route enters the product app instead of technical bootstrap", () => {
  assert.match(rootRoute, /Redirect/);
  assert.match(rootRoute, /href="\/home"/);
  assert.doesNotMatch(rootRoute, /TechnicalBootstrapScreen/);
});

test("mobile shell uses native tabs for the four product sections", () => {
  assert.match(tabLayout, /expo-router\/unstable-native-tabs/);
  for (const route of ["home", "trips", "map", "profile"]) {
    assert.match(tabLayout, new RegExp(`name="${route}"`));
  }
  assert.match(tabLayout, /minimizeBehavior="onScrollDown"/);
});

test("design tokens provide light and dark OverMiles themes", () => {
  assert.match(tokens, /export const theme/);
  assert.match(tokens, /export const darkTheme/);
  assert.match(tokens, /canvas: "#F4EBDD"/);
  assert.match(tokens, /canvas: "#111A18"/);
});

test("product screens use automatic insets and do not expose web primitives", () => {
  assert.match(appScreen, /contentInsetAdjustmentBehavior="automatic"/);
  assert.doesNotMatch(home, /<div|<img|className=/);
});
