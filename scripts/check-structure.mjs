import { access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredPaths = [
  "app/_layout.tsx",
  "app/index.tsx",
  "app/(auth)/.gitkeep",
  "app/(app)/.gitkeep",
  "src/lib/api/api-client.ts",
  "src/lib/auth/token-store.ts",
  "src/lib/storage/local-database.ts",
  "src/lib/sync/sync-engine.ts",
  "docs/architecture.md",
  "docs/security.md",
  "docs/offline-sync.md",
  ".env.example",
  "eas.json",
];

const missing = [];
for (const path of requiredPaths) {
  try {
    await access(path, constants.R_OK);
  } catch {
    missing.push(path);
  }
}

if (missing.length > 0) {
  console.error(`Structure incomplète:\n- ${missing.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Structure COR-54 validée (${requiredPaths.length} chemins).`);
}
