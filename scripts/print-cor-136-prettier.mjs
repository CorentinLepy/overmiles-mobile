import { readFile } from "node:fs/promises";
import process from "node:process";
import * as prettier from "prettier";

const files = [
  "src/features/app-shell/screens/home-screen.tsx",
  "src/features/trips/components/trip-card.tsx",
  "src/features/trips/screens/trip-detail-screen.tsx",
  "src/features/trips/screens/trips-screen.tsx",
  "src/features/trips/trips-data-provider.tsx",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const formatted = await prettier.format(source, { filepath: file });
  console.log(`COR136_PRETTIER_BEGIN:${file}`);
  process.stdout.write(formatted);
  console.log(`COR136_PRETTIER_END:${file}`);
}

process.exitCode = 1;
