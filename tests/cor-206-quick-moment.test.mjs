import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const migrations = await readFile(
  new URL("../src/lib/storage/migrations.ts", import.meta.url),
  "utf8",
);
const draftSource = await readFile(
  new URL("../src/features/timeline/local-moment-draft.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../src/features/timeline/local-moment-draft-store.ts", import.meta.url),
  "utf8",
);
const screenSource = await readFile(
  new URL("../src/features/timeline/screens/quick-moment-screen.tsx", import.meta.url),
  "utf8",
);
const detailSource = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);
const layoutSource = await readFile(
  new URL("../app/(tabs)/trips/_layout.tsx", import.meta.url),
  "utf8",
);
const routeSource = await readFile(
  new URL("../app/(tabs)/trips/[tripId]/moment.tsx", import.meta.url),
  "utf8",
);

function loadDraftModule() {
  const compiled = ts.transpileModule(draftSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

test("COR-206 adds durable TimelineEvent drafts with the canonical event enum", () => {
  assert.match(migrations, /version: 8/);
  assert.match(migrations, /name: "offline-timeline-event-drafts"/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS local_timeline_event_drafts/);
  assert.match(
    migrations,
    /MANUAL.*LOCATION.*PHOTO.*NOTE.*EXPENSE.*DOCUMENT.*TRANSPORT.*ACTIVITY/s,
  );
  assert.match(migrations, /account_user_id TEXT NOT NULL/);
  assert.match(migrations, /trip_id TEXT NOT NULL/);
  assert.match(migrations, /idx_local_timeline_drafts_active_trip/);
  assert.match(migrations, /WHERE state = 'draft_local'/);
});

test("COR-206 validates TimelineEvent-compatible local drafts without blocking incomplete drafts", () => {
  const { assertLocalMomentDraftInput } = loadDraftModule();
  const base = {
    accountUserId: "user-1",
    tripId: "trip-1",
    draftId: "draft-1",
    title: "",
    occurredAt: "2026-08-30T16:00:00.000Z",
  };

  assert.doesNotThrow(() => assertLocalMomentDraftInput(base));
  assert.doesNotThrow(() =>
    assertLocalMomentDraftInput({
      ...base,
      title: "Balade sur les quais",
      type: "ACTIVITY",
      latitude: 48.8566,
      longitude: 2.3522,
      state: "ready_to_sync",
    }),
  );
  assert.throws(() => assertLocalMomentDraftInput({ ...base, type: "UNKNOWN" }));
  assert.throws(() => assertLocalMomentDraftInput({ ...base, state: "ready_to_sync" }));
  assert.throws(() => assertLocalMomentDraftInput({ ...base, latitude: 48.8566 }));
  assert.throws(() =>
    assertLocalMomentDraftInput({
      ...base,
      endsAt: "2026-08-30T15:00:00.000Z",
    }),
  );
});

test("COR-206 moment store is serialized, account scoped and generation guarded", () => {
  assert.match(storeSource, /private writeQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(storeSource, /openForGeneration\(generation\)/);
  assert.match(storeSource, /canUseGeneration\(generation\)/);
  assert.match(storeSource, /WHERE account_user_id = \? AND trip_id = \?/);
  assert.match(storeSource, /ON CONFLICT\(account_user_id, draft_id\) DO UPDATE/);
  assert.match(storeSource, /assertLocalMomentDraftInput\(input\)/);
  assert.doesNotMatch(storeSource, /apiClient|fetch\(|\.request\(/);
});

test("COR-206 Quick Capture uses MANUAL by default and autosaves without network", () => {
  assert.match(screenSource, /Crypto\.randomUUID\(\)/);
  assert.match(screenSource, /localDatabase\.captureGeneration\(\)/);
  assert.match(screenSource, /localMomentDraftStore\s*\.getActive/);
  assert.match(screenSource, /localMomentDraftStore\s*\.save/);
  assert.match(screenSource, /type: "MANUAL"/);
  assert.match(screenSource, /Ajouter un moment/);
  assert.match(screenSource, /autoFocus/);
  assert.match(screenSource, /automaticallyAdjustKeyboardInsets/);
  assert.match(screenSource, /Enregistré sur cet appareil/);
  assert.doesNotMatch(screenSource, /apiClient|fetch\(|\.request\(/);
});

test("COR-206 is reachable from Trip detail through the native Trips stack", () => {
  assert.match(detailSource, /pathname: "\/trips\/\[tripId\]\/moment"/);
  assert.match(detailSource, /Ajouter un moment/);
  assert.match(layoutSource, /name="\[tripId\]\/moment"/);
  assert.match(routeSource, /QuickMomentScreen/);
  assert.match(routeSource, /useLocalSearchParams/);
});
