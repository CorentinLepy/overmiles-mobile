import { readFile } from "node:fs/promises";
import test from "node:test";

import { format, resolveConfig } from "prettier";

const targets = [
  "../src/features/map/screens/map-screen.tsx",
  "./cor-233-map-overlapping-points.test.mjs",
];

test("print COR-233 prettier differences", async () => {
  const config = (await resolveConfig(process.cwd())) ?? {};

  for (const target of targets) {
    const url = new URL(target, import.meta.url);
    const original = await readFile(url, "utf8");
    const formatted = await format(original, { ...config, filepath: url.pathname });
    printChangedRegion(target, original, formatted);
  }

  throw new Error("COR-233 prettier diagnostic only");
});

function printChangedRegion(target, original, formatted) {
  const before = original.split("\n");
  const after = formatted.split("\n");
  let start = 0;

  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;

  let beforeEnd = before.length - 1;
  let afterEnd = after.length - 1;
  while (
    beforeEnd >= start &&
    afterEnd >= start &&
    before[beforeEnd] === after[afterEnd]
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  console.log(`COR233_DIFF_BEGIN ${target}`);
  console.log(`START_LINE ${start + 1}`);
  console.log("ORIGINAL");
  console.log(before.slice(start, beforeEnd + 1).join("\n"));
  console.log("FORMATTED");
  console.log(after.slice(start, afterEnd + 1).join("\n"));
  console.log(`COR233_DIFF_END ${target}`);
}
