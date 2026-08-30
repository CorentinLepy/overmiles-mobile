import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const targetSource = await readFile(
  new URL("../src/features/map/external-navigation-targets.ts", import.meta.url),
  "utf8",
);
const controllerSource = await readFile(
  new URL("../src/features/map/external-navigation.ts", import.meta.url),
  "utf8",
);
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);
const appConfig = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));

function executeTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", output);
  evaluate(module, module.exports);
  return module.exports;
}

test("COR-210 builds deterministic safe navigation URLs per platform", () => {
  const { createExternalNavigationTargets } = executeTypeScript(targetSource);
  const input = {
    coordinate: { latitude: 41.14961, longitude: -8.61099 },
    destinationLabel: "Porto & Ribeira",
  };

  const iosTargets = createExternalNavigationTargets({ ...input, platform: "ios" });
  assert.deepEqual(
    iosTargets.map((target) => target.provider),
    ["apple", "google", "waze"],
  );
  assert.match(iosTargets[0].appUrl, /^maps:\/\//);
  assert.match(iosTargets[0].appUrl, /Porto%20%26%20Ribeira/);
  assert.match(iosTargets[1].appUrl, /^comgooglemaps:\/\//);
  assert.match(iosTargets[1].fallbackUrl, /^https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(iosTargets[2].appUrl, /^waze:\/\//);
  assert.match(iosTargets[2].fallbackUrl, /utm_source=overmiles/);

  const androidTargets = createExternalNavigationTargets({ ...input, platform: "android" });
  assert.deepEqual(
    androidTargets.map((target) => target.provider),
    ["google", "waze"],
  );
  assert.ok(androidTargets.every((target) => target.probeUrl === null));
  assert.ok(androidTargets.every((target) => target.fallbackUrl.startsWith("https://")));
});

test("COR-210 refuses invalid coordinates before constructing external URLs", () => {
  const { createExternalNavigationTargets } = executeTypeScript(targetSource);

  assert.throws(() =>
    createExternalNavigationTargets({
      coordinate: { latitude: 91, longitude: 2.35 },
      destinationLabel: "Invalid",
      platform: "ios",
    }),
  );
  assert.throws(() =>
    createExternalNavigationTargets({
      coordinate: { latitude: 48.85, longitude: Number.NaN },
      destinationLabel: "Invalid",
      platform: "android",
    }),
  );
});

test("COR-210 checks third-party iOS schemes and falls back to universal links", () => {
  assert.match(controllerSource, /Linking\.canOpenURL\(target\.probeUrl\)/);
  assert.match(controllerSource, /canOpenApp \? target\.appUrl : target\.fallbackUrl/);
  assert.match(controllerSource, /Linking\.openURL\(target\.url\)/);
  assert.match(controllerSource, /process\.env\.EXPO_OS === "ios"/);
  assert.doesNotMatch(controllerSource, /apiClient|fetch\(|Authorization|token/i);
});

test("COR-210 declares iOS query schemes required by canOpenURL", () => {
  assert.deepEqual(appConfig.expo.ios.infoPlist.LSApplicationQueriesSchemes, [
    "maps",
    "comgooglemaps",
    "waze",
  ]);
});

test("COR-210 exposes one accessible map action without adding OverMiles networking", () => {
  assert.match(mapScreenSource, /resolveExternalNavigationTargets/);
  assert.match(mapScreenSource, /openResolvedExternalNavigationTarget/);
  assert.match(mapScreenSource, /Alert\.alert/);
  assert.match(mapScreenSource, />Naviguer<\/Text>/);
  assert.match(mapScreenSource, /accessibilityLabel=\{`Naviguer vers \$\{point\.label\}`\}/);
  assert.doesNotMatch(mapScreenSource, /apiClient|fetch\(|FormData|\/api\//);
});
