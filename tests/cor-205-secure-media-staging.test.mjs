import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const pathSource = await readFile(
  new URL("../src/features/media/secure-media-path.ts", import.meta.url),
  "utf8",
);
const stagingSource = await readFile(
  new URL("../src/features/media/secure-media-staging.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../src/features/media/local-media-store.ts", import.meta.url),
  "utf8",
);

function loadPathModule() {
  const compiled = ts.transpileModule(pathSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
  return module.exports;
}

test("COR-205 generates account-scoped media keys and rejects traversal", () => {
  const { createLocalMediaStorageKey, parseLocalMediaStorageKey } = loadPathModule();

  assert.equal(
    createLocalMediaStorageKey("user_123", "media-456", "image/jpeg"),
    "media/user_123/media-456.jpg",
  );
  assert.deepEqual(parseLocalMediaStorageKey("media/user_123/media-456.heic"), {
    accountUserId: "user_123",
    filename: "media-456.heic",
  });
  assert.throws(() => createLocalMediaStorageKey("../other", "media-456", "image/jpeg"));
  assert.throws(() => parseLocalMediaStorageKey("media/user_123/../secret.jpg"));
  assert.throws(() => parseLocalMediaStorageKey("file:///tmp/photo.jpg"));
});

test("COR-205 stages durable media under Paths.document before SQLCipher metadata", () => {
  assert.match(stagingSource, /Paths\.document/);
  assert.doesNotMatch(stagingSource, /Paths\.cache/);
  assert.match(stagingSource, /\.staging/);

  const copyIndex = stagingSource.indexOf("source.copy(temporaryFile)");
  const moveIndex = stagingSource.indexOf("temporaryFile.move(stagedFile)");
  const saveIndex = stagingSource.indexOf("this.mediaStore.save(");
  assert.ok(copyIndex >= 0 && moveIndex > copyIndex && saveIndex > moveIndex);
});

test("COR-205 deletes physical media when metadata commit fails or a capture is discarded", () => {
  assert.match(stagingSource, /if \(!saved && stagedFile\.exists\) stagedFile\.delete\(\)/);
  assert.match(stagingSource, /catch \(error\)[\s\S]*stagedFile\.delete\(\)/);
  assert.match(stagingSource, /async discard\(/);
  assert.match(stagingSource, /file\.delete\(\)/);
  assert.match(storeSource, /DELETE FROM local_media_items/);
});

test("COR-205 reconciles crash orphans without evicting referenced pending files", () => {
  assert.match(stagingSource, /async reconcileAccount\(/);
  assert.match(stagingSource, /expectedKeys = new Set/);
  assert.match(stagingSource, /entry\.name\.startsWith\("\."\) \|\| !expectedKeys\.has\(storageKey\)/);
  assert.match(stagingSource, /"failed"/);
  assert.doesNotMatch(stagingSource, /ready_to_upload[\s\S]*delete/);
});

test("COR-205 purge locks new staging and deletes the whole private media root", () => {
  const purgeIndex = stagingSource.indexOf("purgeAllAndLock()");
  const purgeBlock = stagingSource.slice(purgeIndex);

  assert.match(purgeBlock, /this\.lifecycleGeneration \+= 1/);
  assert.match(purgeBlock, /this\.stagingLocked = true/);
  assert.match(purgeBlock, /root\.delete\(\)/);
  assert.match(stagingSource, /allowAfterAuthentication\(\)/);
});
