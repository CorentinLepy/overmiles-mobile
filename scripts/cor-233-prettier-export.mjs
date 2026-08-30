import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import { format } from "prettier";

const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
};

const files = [
  ["NAV", "src/features/map/map-overlapping-point-navigation.tsx"],
  ["SCREEN", "src/features/map/screens/map-screen.tsx"],
  ["TEST", "tests/cor-233-map-overlapping-points.test.mjs"],
];

for (const [label, filepath] of files) {
  const source = await readFile(filepath, "utf8");
  const formatted = await format(source, { ...config, filepath });
  console.log(`COR233_${label}=${Buffer.from(formatted).toString("base64")}`);
}

process.exitCode = 1;
