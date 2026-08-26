/* eslint-disable import/namespace */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as prettier from "prettier";

const files = [
  "src/features/app-shell/screens/home-screen.tsx",
  "src/features/trips/components/trip-card.tsx",
  "src/features/trips/screens/trip-detail-screen.tsx",
  "src/features/trips/screens/trips-screen.tsx",
];

test("temporary COR-136 prettier probe", async () => {
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const formatted = await prettier.format(source, { filepath: file });
    console.log(`COR136_PRETTIER_BEGIN:${file}`);
    console.log(formatted);
    console.log(`COR136_PRETTIER_END:${file}`);
  }

  assert.fail("Temporary prettier probe: remove after capturing output.");
});
