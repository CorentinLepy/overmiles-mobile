import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const contextSource = await readFile(
  new URL("../src/features/timeline/map-moment-context.ts", import.meta.url),
  "utf8",
);
const screenSource = await readFile(
  new URL("../src/features/timeline/screens/quick-moment-screen.tsx", import.meta.url),
  "utf8",
);
const routeSource = await readFile(
  new URL("../app/(tabs)/trips/[tripId]/moment.tsx", import.meta.url),
  "utf8",
);
const actionsSource = await readFile(
  new URL("../src/features/map/map-terrain-actions.tsx", import.meta.url),
  "utf8",
);

function loadContextModule() {
  const compiled = ts.transpileModule(contextSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

test("COR-228 accepts only bounded map route context", () => {
  const { parseMapMomentContext } = loadContextModule();

  assert.deepEqual(
    parseMapMomentContext({
      source: "map",
      pointLabel: "Praça do Comércio",
      latitude: "38.70775",
      longitude: "-9.13659",
    }),
    {
      label: "Praça do Comércio",
      latitude: 38.70775,
      longitude: -9.13659,
    },
  );
  assert.equal(
    parseMapMomentContext({
      source: "map",
      pointLabel: "x".repeat(181),
      latitude: "38.7",
      longitude: "-9.1",
    }),
    null,
  );
  assert.equal(
    parseMapMomentContext({
      source: "map",
      pointLabel: "Lisbonne",
      latitude: "91",
      longitude: "-9.1",
    }),
    null,
  );
  assert.equal(
    parseMapMomentContext({
      source: "deeplink",
      pointLabel: "Lisbonne",
      latitude: "38.7",
      longitude: "-9.1",
    }),
    null,
  );
});

test("COR-228 sends selected OverMiles point context through the native Moment route", () => {
  assert.match(actionsSource, /pathname: "\/trips\/\[tripId\]\/moment"/);
  assert.match(actionsSource, /source: "map"/);
  assert.match(actionsSource, /pointLabel: point\.label/);
  assert.match(actionsSource, /latitude: String\(point\.coordinate\.latitude\)/);
  assert.match(actionsSource, /longitude: String\(point\.coordinate\.longitude\)/);
  assert.match(routeSource, /parseMapMomentContext\(params\)/);
  assert.match(routeSource, /mapContext=\{mapContext\}/);
  assert.doesNotMatch(actionsSource, /fetch\s*\(|axios|apiClient|\.request\(/);
});

test("COR-228 always restores an existing draft before considering map context", () => {
  const draftBranch = screenSource.indexOf("if (draft) {");
  const mapBranch = screenSource.indexOf("if (mapContext) {");
  assert.ok(draftBranch >= 0);
  assert.ok(mapBranch > draftBranch);
  assert.match(screenSource, /setLatitude\(draft\.latitude\)/);
  assert.match(screenSource, /setLongitude\(draft\.longitude\)/);
  assert.match(screenSource, /setLocationLabel\(null\)/);
});

test("COR-228 seeds only a new local MANUAL draft and preserves coordinates on autosave", () => {
  assert.match(screenSource, /title: mapContext\.label/);
  assert.match(screenSource, /latitude: mapContext\.latitude/);
  assert.match(screenSource, /longitude: mapContext\.longitude/);
  assert.match(screenSource, /type: "MANUAL"/);
  assert.match(screenSource, /latitude,\s*\n\s*longitude,/);
  assert.match(screenSource, /Lieu associé · \$\{locationLabel\}/);
  assert.match(screenSource, /Position associée/);
  assert.doesNotMatch(screenSource, /fetch\s*\(|axios|apiClient|\.request\(/);
});
