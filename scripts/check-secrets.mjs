import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set([".git", ".expo", "node_modules", "android", "ios", "dist"]);
const ignoredFiles = new Set(["pnpm-lock.yaml", "bootstrap-manifest.json"]);
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  "",
]);
const findings = [];

const suspiciousPatterns = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  {
    name: "bearer token literal",
    pattern: /Authorization["']?\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._-]{20,}/i,
  },
  {
    name: "hard-coded password",
    pattern: /(?:password|passwd|pwd)["']?\s*[:=]\s*["'][^"']{8,}["']/i,
  },
];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (ignoredFiles.has(entry.name)) continue;
    const extension = path.extname(entry.name);
    if (!sourceExtensions.has(extension)) continue;
    if ((await stat(absolute)).size > 1_000_000) continue;

    const content = await readFile(absolute, "utf8");
    for (const candidate of suspiciousPatterns) {
      if (candidate.pattern.test(content)) {
        findings.push(`${path.relative(process.cwd(), absolute)}: ${candidate.name}`);
      }
    }
  }
}

await walk(process.cwd());

if (findings.length > 0) {
  console.error(`Secrets potentiels détectés:\n- ${findings.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Aucun motif de secret évident détecté.");
}
