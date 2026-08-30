import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const revisitSource = await readFile(
  new URL("../src/features/map/map-revisit-context.tsx", import.meta.url),
  "utf8",
);
const actionsSource = await readFile(
  new URL("../src/features/map/map-terrain-actions.tsx", import.meta.url),
  "utf8",
);

test(
  "COR-232 derives revisit context only from exact persisted coordinates",
  () => {
    assert.match(
      revisitSource,
      /candidate\.coordinate\.latitude === point\.coordinate\.latitude/,
    );
    assert.match(
      revisitSource,
      /candidate\.coordinate\.longitude === point\.coordinate\.longitude/,
    );
    assert.doesNotMatch(
      revisitSource,
      /toFixed\(|precision|coordinateBucketKey/,
    );
  },
);

test(
  "COR-232 only surfaces genuine revisits and counts distinct trips locally",
  () => {
    assert.match(revisitSource, /matchingPoints\.length < 2/);
    assert.match(
      revisitSource,
      /new Set\(matchingPoints\.map\(\(candidate\) => candidate\.tripId\)\)\.size/,
    );
    assert.match(revisitSource, /repères OverMiles ici/);
  },
);

test(
  "COR-232 stays inside the existing map context without adding network access",
  () => {
    assert.match(revisitSource, /useMapData\(\)/);
    assert.match(actionsSource, /<MapRevisitContext point=\{point\} \/>/);
    assert.doesNotMatch(revisitSource, /fetch\(|apiClient|axios|expo\/fetch/);
  },
);
