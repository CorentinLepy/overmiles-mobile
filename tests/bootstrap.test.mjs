import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("package.json pins the approved Expo 57 baseline", async () => {
  const pkg = await readJson("package.json");
  assert.equal(pkg.private, true);
  assert.equal(pkg.main, "expo-router/entry");
  assert.match(pkg.dependencies.expo, /^~57\./);
  assert.equal(pkg.dependencies.react, "19.2.3");
  assert.equal(pkg.dependencies["react-native"], "0.86.2");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.match(pkg.scripts.verify, /structure:check/);
});

test("EAS keeps channels separated and production targets the canonical API", async () => {
  const eas = await readJson("eas.json");
  assert.equal(eas.build.development.channel, "development");
  assert.equal(eas.build.preview.channel, "preview");
  assert.equal(eas.build.production.channel, "production");
  assert.equal(eas.build.production.env.EXPO_PUBLIC_API_BASE_URL, "https://overmiles.app/api/v1");
});

test("real environment files are ignored while .env.example stays tracked", async () => {
  const gitignore = await readFile(".gitignore", "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("the bootstrap exposes contracts without implementing token persistence", async () => {
  const tokenStore = await readFile("src/lib/auth/token-store.ts", "utf8");
  assert.match(tokenStore, /interface TokenStore/);
  assert.match(tokenStore, /refresh token/i);
  assert.doesNotMatch(tokenStore, /AsyncStorage/);
});
