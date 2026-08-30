import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { format } from "prettier";

test("print exact COR-232 prettier output", async () => {
  const source = await readFile(
    new URL("./cor-232-map-local-revisit-context.test.mjs", import.meta.url),
    "utf8",
  );
  const formatted = await format(source, { parser: "babel" });
  console.log("COR232_PRETTIER_BEGIN");
  console.log(formatted);
  console.log("COR232_PRETTIER_END");
  assert.fail("diagnostic only");
});
