import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-220 propagates the real offline state into selected point context", () => {
  assert.match(mapScreenSource, /isOffline={state\.status === "offline"}/);
  assert.match(mapScreenSource, /isOffline: boolean/);
  assert.match(mapScreenSource, /isOffline \? \(/);
});

test("COR-220 labels cached point context without claiming provider freshness", () => {
  assert.match(mapScreenSource, /Disponible hors ligne/);
  assert.match(mapScreenSource, /accessibilityLabel="Disponible hors ligne"/);
  assert.doesNotMatch(mapScreenSource, /Ouvert|Fermé|avis|horaires|distance depuis/i);
});

test("COR-220 preserves all existing local terrain actions without networking", () => {
  assert.match(mapScreenSource, /Voir le voyage/);
  assert.match(mapScreenSource, /<MapTerrainActions\s+[\s\S]*?point=\{point\}/);
  assert.doesNotMatch(mapScreenSource, /fetch\s*\(|axios|FormData/);
});
