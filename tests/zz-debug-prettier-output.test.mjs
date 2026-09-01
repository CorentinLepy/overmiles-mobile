import { readFile } from "node:fs/promises";
import test from "node:test";
import * as prettier from "prettier";

const targetUrl = new URL(
  "../src/features/map/map-snapshot-freshness.ts",
  import.meta.url,
);

test("diagnose exact Prettier output for COR-256", async () => {
  const source = await readFile(targetUrl, "utf8");
  const config = (await prettier.resolveConfig(targetUrl)) ?? {};
  const formatted = await prettier.format(source, {
    ...config,
    filepath: targetUrl.pathname,
  });

  console.log("COR256_PRETTIER_BEGIN");
  console.log(formatted);
  console.log("COR256_PRETTIER_END");
});
