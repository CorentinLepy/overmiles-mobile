import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { format, resolveConfig } from "prettier";

const navigationUrl = new URL(
  "../src/features/map/map-overlapping-point-navigation.tsx",
  import.meta.url,
);
const testUrl = new URL("./cor-233-map-overlapping-points.test.mjs", import.meta.url);

test("COR-233 prettier dump", async () => {
  const config = (await resolveConfig(process.cwd())) ?? {};
  const navigationSource = await readFile(navigationUrl, "utf8");
  const testSource = await readFile(testUrl, "utf8");
  const navigation = await format(navigationSource, {
    ...config,
    filepath: navigationUrl.pathname,
  });
  const testFile = await format(testSource, {
    ...config,
    filepath: testUrl.pathname,
  });

  assert.fail(
    `COR233_PRETTIER_NAV=${Buffer.from(navigation).toString("base64")}\nCOR233_PRETTIER_TEST=${Buffer.from(testFile).toString("base64")}`,
  );
});
