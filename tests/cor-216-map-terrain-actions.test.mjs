import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionSource = await readFile(
  new URL("../src/features/map/map-terrain-actions.tsx", import.meta.url),
  "utf8",
);
const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-216 exposes existing local capture routes from a selected map point", () => {
  assert.match(actionSource, /useRouter/);
  assert.match(actionSource, /`\/trips\/\$\{point\.tripId\}\/journal`/);
  assert.match(actionSource, /`\/trips\/\$\{point\.tripId\}\/photos`/);
  assert.match(actionSource, /pathname: "\/trips\/\[tripId\]\/moment"/);
  assert.match(actionSource, /tripId: point\.tripId/);
  assert.match(actionSource, /Écrire dans le Carnet/);
  assert.match(actionSource, /Ajouter des photos/);
  assert.match(actionSource, /Créer un moment/);
});

test("COR-216 keeps terrain actions accessible and preserves external navigation", () => {
  assert.match(actionSource, /minHeight: 44/);
  assert.match(actionSource, /accessibilityRole="button"/);
  assert.match(actionSource, /Naviguer vers/);
  assert.match(mapScreenSource, /MapTerrainActions/);
  assert.match(mapScreenSource, /resolveExternalNavigationTargets/);
  assert.match(mapScreenSource, /openResolvedExternalNavigationTarget/);
});

test("COR-216 terrain actions stay local-only and do not add direct networking", () => {
  assert.doesNotMatch(actionSource, /\bfetch\s*\(/);
  assert.doesNotMatch(actionSource, /apiClient/);
  assert.doesNotMatch(actionSource, /axios/);
});
