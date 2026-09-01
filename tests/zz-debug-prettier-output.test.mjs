import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryUrl = new URL("../", import.meta.url);
const prettierBinUrl = new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url);
const targetUrl = new URL(
  "../src/features/map/map-snapshot-freshness.ts",
  import.meta.url,
);

test("diagnose exact Prettier output for COR-256", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [prettierBinUrl.pathname, targetUrl.pathname],
    { cwd: repositoryUrl.pathname },
  );

  console.log("COR256_PRETTIER_BEGIN");
  console.log(stdout);
  console.log("COR256_PRETTIER_END");
});
