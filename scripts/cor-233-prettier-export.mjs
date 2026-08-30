import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { format } from "prettier";

const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
};

const files = [
  "src/features/map/map-overlapping-point-navigation.tsx",
  "src/features/map/screens/map-screen.tsx",
  "tests/cor-233-map-overlapping-points.test.mjs",
];

for (const filepath of files) {
  const source = await readFile(filepath, "utf8");
  const formatted = await format(source, { ...config, filepath });
  await writeFile(filepath, formatted, "utf8");
}

execFileSync("git", ["diff", "--", ...files], { stdio: "inherit" });
process.exitCode = 1;
