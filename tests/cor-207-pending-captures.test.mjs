import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pendingSource = await readFile(
  new URL("../src/features/capture/pending-captures-card.tsx", import.meta.url),
  "utf8",
);
const detailSource = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);

test("COR-207 reloads local pending captures whenever Trip detail regains focus", () => {
  assert.match(pendingSource, /useFocusEffect/);
  assert.match(pendingSource, /useCallback/);
  assert.match(pendingSource, /localDatabase\.captureGeneration\(\)/);
  assert.match(pendingSource, /localDatabase\.canUseGeneration\(generation\)/);
  assert.match(pendingSource, /Promise\.all\(\[/);
  assert.match(pendingSource, /localJournalDraftStore\.getActive/);
  assert.match(pendingSource, /localMomentDraftStore\.getActive/);
});

test("COR-207 stays invisible when the current trip has no draft to resume", () => {
  assert.match(
    pendingSource,
    /pending\.loadKey !== loadKey \|\| \(!pending\.journal && !pending\.moment\)/,
  );
  assert.match(pendingSource, /return null/);
  assert.doesNotMatch(pendingSource, /badge|counter|error|warning/i);
});

test("COR-207 opens the existing native Journal and Moment editors directly", () => {
  assert.match(pendingSource, /Reprendre le Carnet/);
  assert.match(pendingSource, /Reprendre le moment/);
  assert.match(pendingSource, /pathname: "\/trips\/\[tripId\]\/journal"/);
  assert.match(pendingSource, /pathname: "\/trips\/\[tripId\]\/moment"/);
  assert.match(pendingSource, /accessibilityRole="button"/);
  assert.match(pendingSource, /accessibilityLabel=/);
});

test("COR-207 remains local-only and is mounted before new capture actions", () => {
  assert.doesNotMatch(pendingSource, /apiClient|fetch\(|\.request\(/);
  assert.match(detailSource, /<PendingCapturesCard tripId=\{trip\.id\} \/>/);

  const pendingIndex = detailSource.indexOf("<PendingCapturesCard");
  const enrichIndex = detailSource.indexOf("Enrichir sur le terrain");
  assert.ok(pendingIndex >= 0 && enrichIndex > pendingIndex);
});
