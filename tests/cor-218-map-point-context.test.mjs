import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapScreenSource = await readFile(
  new URL("../src/features/map/screens/map-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-218 exposes the existing native trip detail from local map context", () => {
  assert.match(mapScreenSource, /useRouter/);
  assert.match(mapScreenSource, /router\.push\(`\/trips\/\$\{point\.tripId\}`\)/);
  assert.match(mapScreenSource, />\s*Voir le voyage\s*</);
  assert.match(mapScreenSource, /accessibilityLabel={`Voir le voyage \$\{point\.tripName\}`}/);
});

test("COR-218 keeps point context readable and terrain actions together", () => {
  assert.match(mapScreenSource, /kindLabel\(point\.kind\)/);
  assert.match(mapScreenSource, /\{point\.label\}/);
  assert.match(mapScreenSource, /\{point\.tripName\}/);
  assert.match(mapScreenSource, /formatPointDate\(point\.occurredAt\)/);
  assert.match(mapScreenSource, /<MapTerrainActions\s+[\s\S]*?point=\{point\}/);
  assert.match(mapScreenSource, /minHeight: 44/);
});

test("COR-218 adds no new direct network or provider dependency", () => {
  assert.doesNotMatch(mapScreenSource, /axios|FormData|places provider/i);
  assert.doesNotMatch(mapScreenSource, /fetch\s*\(/);
});
